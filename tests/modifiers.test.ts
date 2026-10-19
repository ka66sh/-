import { describe, expect, it } from 'vitest';
import type { ActiveSource, Modifier } from '../src/engine/modifiers';
import {
  DEFAULT_RAMP_DOWN_MONTHS,
  aggregateDrivers,
  computeBreakdown,
  isShockKind,
  isSourceExhausted,
  modifierWeight,
} from '../src/engine/modifiers';
import { DRIVERS } from '../src/engine/drivers';

function source(modifiers: Modifier[], overrides: Partial<ActiveSource> = {}): ActiveSource {
  return {
    id: 'policy:test',
    defId: 'test',
    kind: 'policy',
    label: '시험 정책',
    startedMonthIndex: 0,
    removedMonthIndex: null,
    rampDownMonths: DEFAULT_RAMP_DOWN_MONTHS,
    modifiers,
    ...overrides,
  };
}

describe('집계식 (기본값 + Σadd) × Πmul', () => {
  it('add와 mul을 순서대로 적용한다', () => {
    const sources = [
      source([{ target: 'savingsAdj', op: 'add', value: 0.04 }]),
      source([{ target: 'savingsAdj', op: 'add', value: 0.02 }], { id: 'policy:b' }),
    ];
    // 기본값 0 + 0.04 + 0.02 = 0.06
    expect(aggregateDrivers(sources, 0).savingsAdj).toBeCloseTo(0.06, 10);
  });

  it('배수는 곱해진다', () => {
    const sources = [
      source([{ target: 'investmentClimate', op: 'mul', value: 1.2 }]),
      source([{ target: 'investmentClimate', op: 'mul', value: 1.5 }], { id: 'policy:b' }),
    ];
    expect(aggregateDrivers(sources, 0).investmentClimate).toBeCloseTo(1.8, 10);
  });

  it('허용 범위를 넘으면 clamp된다', () => {
    const sources = [source([{ target: 'fertilityAdj', op: 'mul', value: 10 }])];
    expect(aggregateDrivers(sources, 0).fertilityAdj).toBe(DRIVERS.fertilityAdj.max);
  });

  it('출처가 없으면 모든 동인이 기본값이다', () => {
    const table = aggregateDrivers([], 0);
    expect(table.savingsAdj).toBe(0);
    expect(table.investmentClimate).toBe(1);
  });
});

describe('지연과 점진 반영', () => {
  it('delayMonths 동안은 효과가 0이다', () => {
    const src = source([{ target: 'tfpGrowthAdj', op: 'add', value: 0.01, delayMonths: 6 }]);
    expect(modifierWeight(src.modifiers[0], src, 0)).toBe(0);
    expect(modifierWeight(src.modifiers[0], src, 5)).toBe(0);
    expect(modifierWeight(src.modifiers[0], src, 6)).toBe(1);
  });

  it('rampMonths에 걸쳐 0에서 1로 올라간다', () => {
    const src = source([{ target: 'tfpGrowthAdj', op: 'add', value: 0.01, rampMonths: 4 }]);
    const weights = [0, 1, 2, 3, 4].map((m) => modifierWeight(src.modifiers[0], src, m));
    expect(weights).toEqual([0.25, 0.5, 0.75, 1, 1]);
  });

  it('지연과 ramp를 함께 쓴다', () => {
    const src = source([
      { target: 'tfpGrowthAdj', op: 'add', value: 0.01, delayMonths: 12, rampMonths: 12 },
    ]);
    expect(modifierWeight(src.modifiers[0], src, 11)).toBe(0);
    expect(modifierWeight(src.modifiers[0], src, 12)).toBeCloseTo(1 / 12, 10);
    expect(modifierWeight(src.modifiers[0], src, 23)).toBe(1);
  });

  it('durationMonths가 지나면 만료된다', () => {
    const src = source([{ target: 'confidenceAdj', op: 'add', value: 0.2, durationMonths: 6 }]);
    expect(modifierWeight(src.modifiers[0], src, 5)).toBe(1);
    expect(modifierWeight(src.modifiers[0], src, 6)).toBe(0);
  });

  it('배수는 가중치만큼 1에서 보간된다', () => {
    const sources = [source([{ target: 'investmentClimate', op: 'mul', value: 1.2, rampMonths: 2 }])];
    // 1개월차 가중치 0.5 → ×1.1
    expect(aggregateDrivers(sources, 0).investmentClimate).toBeCloseTo(1.1, 10);
  });
});

describe('폐지 후 감쇠 (ramp-down)', () => {
  it('폐지 시점의 반영률에서 0으로 줄어든다', () => {
    const src = source([{ target: 'savingsAdj', op: 'add', value: 0.1 }], {
      removedMonthIndex: 10,
      rampDownMonths: 10,
    });
    expect(modifierWeight(src.modifiers[0], src, 10)).toBe(1);
    expect(modifierWeight(src.modifiers[0], src, 15)).toBeCloseTo(0.5, 10);
    expect(modifierWeight(src.modifiers[0], src, 20)).toBe(0);
  });

  it('ramp-up 중에 폐지되면 그 수준에서부터 줄어든다', () => {
    const src = source([{ target: 'savingsAdj', op: 'add', value: 0.1, rampMonths: 10 }], {
      removedMonthIndex: 4,
      rampDownMonths: 10,
    });
    // 폐지 시점 반영률 0.5, 5개월 뒤 감쇠 0.5 → 0.25
    expect(modifierWeight(src.modifiers[0], src, 4)).toBeCloseTo(0.5, 10);
    expect(modifierWeight(src.modifiers[0], src, 9)).toBeCloseTo(0.25, 10);
  });

  it('완전히 사라진 출처는 프루닝 대상이다', () => {
    const src = source([{ target: 'savingsAdj', op: 'add', value: 0.1 }], {
      removedMonthIndex: 0,
      rampDownMonths: 6,
    });
    expect(isSourceExhausted(src, 3)).toBe(false);
    expect(isSourceExhausted(src, 6)).toBe(true);
  });

  it('아직 지연 대기 중인 출처는 살려 둔다', () => {
    const src = source([{ target: 'savingsAdj', op: 'add', value: 0.1, delayMonths: 24 }]);
    expect(isSourceExhausted(src, 5)).toBe(false);
  });
});

describe('추적 가능성 — 기여도 분해', () => {
  it('기본값과 출처별 기여를 분해해 보여준다', () => {
    const sources = [
      source([{ target: 'savingsAdj', op: 'add', value: 0.04 }], { label: '강제저축' }),
      source([{ target: 'savingsAdj', op: 'add', value: 0.024 }], { id: 'policy:rate', label: '금리 효과' }),
      source([{ target: 'investmentClimate', op: 'mul', value: 1.1 }], { id: 'policy:other' }),
    ];
    const breakdown = computeBreakdown(sources, 0, 'savingsAdj');
    expect(breakdown.base).toBe(0);
    expect(breakdown.value).toBeCloseTo(0.064, 10);
    expect(breakdown.contributions).toHaveLength(2);
    expect(breakdown.contributions[0].label).toBe('강제저축');
    expect(breakdown.contributions[0].applied).toBeCloseTo(0.04, 10);
    expect(breakdown.label).toBe(DRIVERS.savingsAdj.label);
  });

  it('분해 결과의 값은 집계 결과와 같다', () => {
    const sources = [
      source([{ target: 'investmentClimate', op: 'mul', value: 1.2, rampMonths: 5 }]),
      source([{ target: 'investmentClimate', op: 'add', value: 0.1 }], { id: 'policy:b' }),
    ];
    for (const month of [0, 1, 2, 3, 4, 5, 10]) {
      expect(computeBreakdown(sources, month, 'investmentClimate').value).toBeCloseTo(
        aggregateDrivers(sources, month).investmentClimate,
        10,
      );
    }
  });

  it('반영률이 0인 출처는 기여 목록에 넣지 않는다', () => {
    const sources = [source([{ target: 'savingsAdj', op: 'add', value: 0.1, delayMonths: 10 }])];
    expect(computeBreakdown(sources, 0, 'savingsAdj').contributions).toHaveLength(0);
  });
});

describe('Shock 화이트리스트', () => {
  it('허용된 종류만 통과한다', () => {
    expect(isShockKind('populationLossShare')).toBe(true);
    expect(isShockKind('debtChange')).toBe(true);
    expect(isShockKind('gdpChange')).toBe(false);
    expect(isShockKind('tfpGrowthAdj')).toBe(false);
  });
});
