import { describe, expect, it } from 'vitest';
import type { GameState } from '../src/engine/state';
import { SCHEMA_VERSION, TOTAL_MONTHS, createInitialState } from '../src/engine/state';
import { simulateMonth, simulateMonths } from '../src/engine/tick';
import { submitCommand } from '../src/engine/commands';
import type { Command } from '../src/engine/commands';
import { parseSave, serializeSave } from '../src/game/save';

/** (monthIndex, 명령) 대본. 결정론 검증은 이 대본을 두 번 재생해 비교한다. */
const SCRIPT: ReadonlyArray<readonly [number, Command]> = [
  [0, { type: 'RENAME_NATION', name: '하노 공화국' }],
  [3, { type: 'SET_TAX', tax: 'income', rate: 0.18 }],
  [12, { type: 'SET_SPENDING', item: 'education', gdpShare: 0.04 }],
  [60, { type: 'SET_POLICY_RATE', rate: 0.09 }],
  [120, { type: 'SET_FX_REGIME', fxRegime: 'float' }],
  [240, { type: 'SET_DEFICIT_FINANCING', moneyShare: 0.1 }],
  [600, { type: 'SET_TAX', tax: 'vat', rate: 0.1 }],
];

function playScript(seed: number, months: number): GameState {
  const state = createInitialState({ seed });
  for (let month = 0; month < months; month += 1) {
    for (const [at, command] of SCRIPT) {
      if (at === month) submitCommand(state, command, { paused: true });
    }
    simulateMonth(state);
  }
  return state;
}

/** 금지된 값이 상태 안에 있는지 재귀적으로 확인한다 (§4.1, §12.1) */
function scanState(value: unknown, path: string, problems: string[], seen = new Set<unknown>()): void {
  if (value === null) return;
  const type = typeof value;
  if (type === 'number') {
    if (!Number.isFinite(value as number)) problems.push(`${path}: 유한수가 아님 (${String(value)})`);
    return;
  }
  if (type === 'string' || type === 'boolean') return;
  if (type === 'undefined') {
    problems.push(`${path}: undefined`);
    return;
  }
  if (type === 'function') {
    problems.push(`${path}: 함수`);
    return;
  }
  if (type !== 'object') {
    problems.push(`${path}: 직렬화할 수 없는 타입 ${type}`);
    return;
  }
  if (seen.has(value)) {
    problems.push(`${path}: 순환 참조`);
    return;
  }
  seen.add(value);

  if (value instanceof Date) {
    problems.push(`${path}: Date 객체`);
    return;
  }
  if (value instanceof Map || value instanceof Set) {
    problems.push(`${path}: Map/Set`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanState(item, `${path}[${index}]`, problems, seen));
    return;
  }
  const proto = Object.getPrototypeOf(value) as unknown;
  if (proto !== Object.prototype && proto !== null) {
    problems.push(`${path}: 일반 객체가 아님 (클래스 인스턴스)`);
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    scanState(child, `${path}.${key}`, problems, seen);
  }
}

describe('결정론 (§12.1)', () => {
  it('같은 시드·같은 명령이면 100년 결과가 완전히 같다', () => {
    const a = playScript(4242, TOTAL_MONTHS);
    const b = playScript(4242, TOTAL_MONTHS);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('시드가 다르면 난수 상태가 갈라진다', () => {
    const a = playScript(1, 240);
    const b = playScript(2, 240);
    expect(a.rng.s).not.toBe(b.rng.s);
  });

  it('명령이 다르면 결과도 다르다', () => {
    const withCommand = playScript(9, 24);
    const without = createInitialState({ seed: 9 });
    simulateMonths(without, 24);
    expect(JSON.stringify(withCommand)).not.toBe(JSON.stringify(without));
    expect(withCommand.knobs.taxes.income).toBeCloseTo(0.18, 10);
    expect(without.knobs.taxes.income).toBeCloseTo(0.08, 10);
  });

  it('명령 순서(seq)는 접수 순서를 따른다', () => {
    const state = createInitialState({ seed: 3 });
    submitCommand(state, { type: 'SET_TAX', tax: 'income', rate: 0.2 }, { paused: false });
    submitCommand(state, { type: 'SET_TAX', tax: 'income', rate: 0.3 }, { paused: false });
    expect(state.pending.map((p) => p.seq)).toEqual([0, 1]);
    simulateMonth(state);
    // 나중 명령이 이긴다.
    expect(state.knobs.taxes.income).toBeCloseTo(0.3, 10);
    expect(state.pending).toHaveLength(0);
  });

  it('일시정지 중 명령은 즉시 적용된다', () => {
    const state = createInitialState({ seed: 3 });
    submitCommand(state, { type: 'RENAME_NATION', name: '즉시' }, { paused: true });
    expect(state.nationName).toBe('즉시');
    expect(state.pending).toHaveLength(0);
  });
});

describe('직렬화와 보존 (§4.1, §12.1)', () => {
  it('100년 뒤 상태에 NaN·Infinity·금지 타입이 없다', () => {
    const state = playScript(777, TOTAL_MONTHS);
    const problems: string[] = [];
    scanState(state, 'state', problems);
    expect(problems).toEqual([]);
  });

  it('JSON 왕복 후에도 구조가 같다', () => {
    const state = playScript(55, 120);
    const roundTrip = JSON.parse(JSON.stringify(state)) as GameState;
    expect(roundTrip).toEqual(state);
  });

  it('비율 조작값은 허용 범위 안에 머문다', () => {
    const state = playScript(55, 120);
    for (const rate of Object.values(state.knobs.taxes)) {
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    }
    for (const share of Object.values(state.knobs.spending)) {
      expect(share).toBeGreaterThanOrEqual(0);
      expect(share).toBeLessThanOrEqual(0.3);
    }
    expect(state.knobs.moneyFinanceShare).toBeGreaterThanOrEqual(0);
    expect(state.knobs.moneyFinanceShare).toBeLessThanOrEqual(1);
  });
});

describe('저장 (§11, §12.1)', () => {
  it('저장 → 불러오기 → 이어서 진행한 결과가 저장 없이 진행한 결과와 같다', () => {
    const direct = createInitialState({ seed: 31415 });
    simulateMonths(direct, 600);

    const saved = createInitialState({ seed: 31415 });
    simulateMonths(saved, 300);
    const text = serializeSave(saved, '1950-01-01T00:00:00.000Z');
    const loaded = parseSave(text);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    simulateMonths(loaded.state, 300);

    expect(JSON.stringify(loaded.state)).toBe(JSON.stringify(direct));
  });

  it('난수 상태가 저장에 포함된다', () => {
    const state = createInitialState({ seed: 1 });
    simulateMonths(state, 10);
    const parsed = parseSave(serializeSave(state, 'x'));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.state.rng.s).toBe(state.rng.s);
    expect(parsed.state.worldRng.s).toBe(state.worldRng.s);
    expect(parsed.state.eventRng.s).toBe(state.eventRng.s);
  });

  it('더 새로운 스키마 버전은 안전하게 거부한다', () => {
    const state = createInitialState({ seed: 1 });
    const text = serializeSave(state, 'x').replace(
      `"schemaVersion":${SCHEMA_VERSION}`,
      `"schemaVersion":${SCHEMA_VERSION + 5}`,
    );
    const result = parseSave(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('새로운 버전');
  });

  it('남의 파일·깨진 파일을 거부한다', () => {
    expect(parseSave('{not json').ok).toBe(false);
    expect(parseSave('{"format":"other"}').ok).toBe(false);
    expect(parseSave('null').ok).toBe(false);
  });

  it('저장 파일 크기가 1MB 이하다', () => {
    const state = playScript(2, TOTAL_MONTHS);
    const bytes = new TextEncoder().encode(serializeSave(state, 'x')).length;
    expect(bytes).toBeLessThan(1_000_000);
  });
});
