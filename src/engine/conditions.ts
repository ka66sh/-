// 조건(Condition) 평가기 (PROMPT.md §7.1)
// 문자열 eval은 금지. 타입이 있는 조건 객체만 쓴다.

import type { MetricKey } from './metrics';
import { isMetricKey } from './metrics';
import type { EraId } from './eras';
import { eraOrder } from './eras';
import type { Regime, RegimeAxis, RegimeOption } from './politics/regime';
import { REGIME_AXES, isValidRegimeOption } from './politics/regime';

export type ComparisonOp = '>' | '>=' | '<' | '<=' | '==';

export type Condition =
  | { kind: 'metric'; key: MetricKey; op: ComparisonOp; value: number }
  | { kind: 'era'; atLeast: EraId }
  | { kind: 'regime'; axis: RegimeAxis; in: RegimeOption[] }
  | { kind: 'policyActive'; policyId: string; active: boolean }
  | { kind: 'year'; atLeast?: number; atMost?: number }
  | { kind: 'not'; condition: Condition }
  | { kind: 'any'; conditions: Condition[] };

/** 평가에 필요한 최소 정보. 엔진이 GameState에서 만들어 넘긴다. */
export interface ConditionContext {
  year: number;
  era: EraId;
  regime: Regime;
  metric: (key: MetricKey) => number;
  isPolicyActive: (policyId: string) => boolean;
}

function compare(left: number, op: ComparisonOp, right: number): boolean {
  switch (op) {
    case '>':
      return left > right;
    case '>=':
      return left >= right;
    case '<':
      return left < right;
    case '<=':
      return left <= right;
    case '==':
      // 부동소수 비교는 허용 오차를 둔다.
      return Math.abs(left - right) < 1e-9;
    default:
      return false;
  }
}

export function evaluateCondition(condition: Condition, ctx: ConditionContext): boolean {
  switch (condition.kind) {
    case 'metric':
      return compare(ctx.metric(condition.key), condition.op, condition.value);
    case 'era':
      return eraOrder(ctx.era) >= eraOrder(condition.atLeast);
    case 'regime':
      return (condition.in as readonly string[]).includes(ctx.regime[condition.axis]);
    case 'policyActive':
      return ctx.isPolicyActive(condition.policyId) === condition.active;
    case 'year': {
      if (condition.atLeast !== undefined && ctx.year < condition.atLeast) return false;
      if (condition.atMost !== undefined && ctx.year > condition.atMost) return false;
      return true;
    }
    case 'not':
      return !evaluateCondition(condition.condition, ctx);
    case 'any':
      return condition.conditions.some((c) => evaluateCondition(c, ctx));
    default:
      return false;
  }
}

/** 조건 배열은 AND로 묶는다 (requires, trigger.conditions). */
export function evaluateAll(conditions: readonly Condition[] | undefined, ctx: ConditionContext): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((c) => evaluateCondition(c, ctx));
}

/** 데이터 검증용: 조건 객체가 구조적으로 유효한지 확인하고 문제를 한국어로 돌려준다. */
export function validateCondition(condition: Condition, path = 'condition'): string[] {
  const problems: string[] = [];
  switch (condition.kind) {
    case 'metric':
      if (!isMetricKey(condition.key)) problems.push(`${path}: 알 수 없는 지표 키 '${condition.key}'`);
      if (!Number.isFinite(condition.value)) problems.push(`${path}: value가 유한수가 아님`);
      break;
    case 'regime':
      if (!(REGIME_AXES as readonly string[]).includes(condition.axis)) {
        problems.push(`${path}: 알 수 없는 체제 축 '${condition.axis}'`);
        break;
      }
      if (condition.in.length === 0) problems.push(`${path}: in이 빈 배열`);
      for (const option of condition.in) {
        if (!isValidRegimeOption(condition.axis, option)) {
          problems.push(`${path}: '${condition.axis}' 축에 없는 선택지 '${option}'`);
        }
      }
      break;
    case 'year':
      if (condition.atLeast === undefined && condition.atMost === undefined) {
        problems.push(`${path}: year 조건에 atLeast/atMost가 모두 없음`);
      }
      break;
    case 'not':
      problems.push(...validateCondition(condition.condition, `${path}.condition`));
      break;
    case 'any':
      if (condition.conditions.length === 0) problems.push(`${path}: 선택(any) 조건이 빈 배열`);
      condition.conditions.forEach((c, i) => problems.push(...validateCondition(c, `${path}.any[${i}]`)));
      break;
    case 'era':
    case 'policyActive':
      break;
    default:
      problems.push(`${path}: 알 수 없는 조건 종류`);
  }
  return problems;
}
