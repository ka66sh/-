import { describe, expect, it } from 'vitest';
import {
  REGIME_AXES,
  REGIME_AXIS_LABELS,
  REGIME_AXIS_OPTIONS,
  enumerateRegimes,
  isValidRegimeOption,
  regimeCombinationCount,
  regimeKey,
  regimeOptionLabel,
} from '../src/engine/politics/regime';
import { ERA_IDS, ERA_LABELS, eraOrder } from '../src/engine/eras';
import { METRIC_KEYS, isMetricKey } from '../src/engine/metrics';
import { createInitialState } from '../src/engine/state';
import { simulateMonths } from '../src/engine/tick';

describe('체제 5개 축', () => {
  it('조합은 4×3×3×3×3 = 324가지다', () => {
    expect(regimeCombinationCount()).toBe(324);
    expect(enumerateRegimes()).toHaveLength(324);
  });

  it('선택지는 모두 16개다', () => {
    const total = REGIME_AXES.reduce((sum, axis) => sum + REGIME_AXIS_OPTIONS[axis].length, 0);
    expect(total).toBe(16);
  });

  it('324개 조합의 키가 모두 다르다', () => {
    const keys = new Set(enumerateRegimes().map(regimeKey));
    expect(keys.size).toBe(324);
  });

  it('모든 축과 선택지에 한국어 이름이 있다', () => {
    for (const axis of REGIME_AXES) {
      expect(REGIME_AXIS_LABELS[axis]).toMatch(/[가-힣]/);
      for (const option of REGIME_AXIS_OPTIONS[axis]) {
        expect(regimeOptionLabel(axis, option)).toMatch(/[가-힣]/);
      }
    }
  });

  it('축에 없는 선택지는 거부한다', () => {
    expect(isValidRegimeOption('press', 'free')).toBe(true);
    expect(isValidRegimeOption('press', 'market')).toBe(false);
    expect(isValidRegimeOption('economy', 'planned')).toBe(true);
    expect(isValidRegimeOption('economy', 'election')).toBe(false);
  });

  it('324개 조합 모두 시뮬레이션에서 오류가 없다', () => {
    for (const regime of enumerateRegimes()) {
      const state = createInitialState({ seed: 11 });
      state.regime = regime;
      expect(() => simulateMonths(state, 12)).not.toThrow();
      expect(state.monthIndex).toBe(12);
    }
  });
});

describe('시대', () => {
  it('4개 시대가 순서를 가진다', () => {
    expect(ERA_IDS).toHaveLength(4);
    expect(eraOrder('founding')).toBe(0);
    expect(eraOrder('greatPower')).toBe(3);
    expect(eraOrder('highGrowth')).toBeGreaterThan(eraOrder('industrialization'));
  });

  it('모든 시대에 한국어 이름이 있다', () => {
    for (const era of ERA_IDS) expect(ERA_LABELS[era]).toMatch(/[가-힣]/);
  });
});

describe('지표 키', () => {
  it('중복이 없다', () => {
    expect(new Set(METRIC_KEYS).size).toBe(METRIC_KEYS.length);
  });

  it('§5.4의 핵심 지표를 포함한다', () => {
    for (const key of ['gdpGrowth', 'gdpPerCapita', 'unemployment', 'inflation', 'stability', 'debtRatio', 'tfr', 'lifeExpectancy', 'urbanization', 'coupRisk']) {
      expect(isMetricKey(key)).toBe(true);
    }
    expect(isMetricKey('nope')).toBe(false);
  });
});
