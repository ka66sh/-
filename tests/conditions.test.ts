import { describe, expect, it } from 'vitest';
import type { Condition, ConditionContext } from '../src/engine/conditions';
import { evaluateAll, evaluateCondition, validateCondition } from '../src/engine/conditions';

const ctx: ConditionContext = {
  year: 1975,
  era: 'industrialization',
  regime: { power: 'election', checks: 'weak', press: 'censored', economy: 'mixed', rights: 'restricted' },
  metric: (key) => (key === 'gdpPerCapita' ? 1200 : key === 'urbanization' ? 0.35 : 0),
  isPolicyActive: (id) => id === 'compulsory_primary',
};

describe('조건 평가', () => {
  it('지표를 비교한다', () => {
    expect(evaluateCondition({ kind: 'metric', key: 'gdpPerCapita', op: '>', value: 1000 }, ctx)).toBe(true);
    expect(evaluateCondition({ kind: 'metric', key: 'gdpPerCapita', op: '<', value: 1000 }, ctx)).toBe(false);
    expect(evaluateCondition({ kind: 'metric', key: 'urbanization', op: '>=', value: 0.35 }, ctx)).toBe(true);
    expect(evaluateCondition({ kind: 'metric', key: 'urbanization', op: '==', value: 0.35 }, ctx)).toBe(true);
  });

  it('시대는 이상(atLeast)으로 비교한다', () => {
    expect(evaluateCondition({ kind: 'era', atLeast: 'founding' }, ctx)).toBe(true);
    expect(evaluateCondition({ kind: 'era', atLeast: 'industrialization' }, ctx)).toBe(true);
    expect(evaluateCondition({ kind: 'era', atLeast: 'greatPower' }, ctx)).toBe(false);
  });

  it('체제 축의 선택지 포함 여부를 본다', () => {
    expect(evaluateCondition({ kind: 'regime', axis: 'press', in: ['censored', 'state'] }, ctx)).toBe(true);
    expect(evaluateCondition({ kind: 'regime', axis: 'press', in: ['free'] }, ctx)).toBe(false);
  });

  it('정책 활성 여부를 본다', () => {
    expect(evaluateCondition({ kind: 'policyActive', policyId: 'compulsory_primary', active: true }, ctx)).toBe(true);
    expect(evaluateCondition({ kind: 'policyActive', policyId: 'land_reform', active: false }, ctx)).toBe(true);
  });

  it('연도 범위를 본다', () => {
    expect(evaluateCondition({ kind: 'year', atLeast: 1970 }, ctx)).toBe(true);
    expect(evaluateCondition({ kind: 'year', atMost: 1970 }, ctx)).toBe(false);
    expect(evaluateCondition({ kind: 'year', atLeast: 1970, atMost: 1980 }, ctx)).toBe(true);
  });

  it('not과 any를 조합한다', () => {
    const condition: Condition = {
      kind: 'any',
      conditions: [
        { kind: 'metric', key: 'gdpPerCapita', op: '>', value: 99999 },
        { kind: 'not', condition: { kind: 'era', atLeast: 'greatPower' } },
      ],
    };
    expect(evaluateCondition(condition, ctx)).toBe(true);
  });

  it('조건 배열은 AND로 묶인다', () => {
    expect(
      evaluateAll(
        [
          { kind: 'year', atLeast: 1970 },
          { kind: 'metric', key: 'gdpPerCapita', op: '>', value: 1000 },
        ],
        ctx,
      ),
    ).toBe(true);
    expect(
      evaluateAll(
        [
          { kind: 'year', atLeast: 1970 },
          { kind: 'metric', key: 'gdpPerCapita', op: '>', value: 99999 },
        ],
        ctx,
      ),
    ).toBe(false);
    expect(evaluateAll([], ctx)).toBe(true);
    expect(evaluateAll(undefined, ctx)).toBe(true);
  });
});

describe('조건 검증', () => {
  it('올바른 조건은 문제가 없다', () => {
    expect(validateCondition({ kind: 'metric', key: 'gdp', op: '>', value: 1 })).toHaveLength(0);
    expect(validateCondition({ kind: 'regime', axis: 'economy', in: ['market', 'mixed'] })).toHaveLength(0);
  });

  it('없는 지표 키를 잡아낸다', () => {
    const problems = validateCondition({
      kind: 'metric',
      key: 'nonsense' as 'gdp',
      op: '>',
      value: 1,
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('nonsense');
  });

  it('축에 맞지 않는 체제 선택지를 잡아낸다', () => {
    const problems = validateCondition({ kind: 'regime', axis: 'press', in: ['market'] });
    expect(problems).toHaveLength(1);
  });

  it('빈 any와 내용 없는 year를 잡아낸다', () => {
    expect(validateCondition({ kind: 'any', conditions: [] })).toHaveLength(1);
    expect(validateCondition({ kind: 'year' })).toHaveLength(1);
  });

  it('중첩된 조건도 검증한다', () => {
    const problems = validateCondition({
      kind: 'not',
      condition: { kind: 'metric', key: 'bogus' as 'gdp', op: '>', value: 1 },
    });
    expect(problems[0]).toContain('condition.condition');
  });
});
