import { describe, expect, it } from 'vitest';
import {
  TOTAL_MONTHS,
  START_YEAR,
  END_YEAR,
  createInitialState,
  dateFromMonthIndex,
  daysInMonth,
  monthIndexFromDate,
  isPolicyActive,
} from '../src/engine/state';
import { simulateMonth, simulateMonths } from '../src/engine/tick';
import { DRIVERS, DRIVER_KEYS, clampDriver, isDriverKey } from '../src/engine/drivers';

describe('날짜', () => {
  it('100년 = 1200개월', () => {
    expect(TOTAL_MONTHS).toBe(1200);
    expect(START_YEAR).toBe(1950);
    expect(END_YEAR).toBe(2049);
  });

  it('monthIndex 0은 1950년 1월', () => {
    expect(dateFromMonthIndex(0)).toEqual({ year: 1950, month: 1 });
  });

  it('monthIndex 1199는 2049년 12월', () => {
    expect(dateFromMonthIndex(1199)).toEqual({ year: 2049, month: 12 });
  });

  it('왕복 변환이 일치한다', () => {
    for (let i = 0; i <= TOTAL_MONTHS; i += 1) {
      expect(monthIndexFromDate(dateFromMonthIndex(i))).toBe(i);
    }
  });

  it('윤년을 계산한다', () => {
    expect(daysInMonth(1950, 2)).toBe(28);
    expect(daysInMonth(1952, 2)).toBe(29);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2049, 12)).toBe(31);
  });
});

describe('초기 상태', () => {
  it('1950년 1월에서 시작한다', () => {
    const state = createInitialState({ seed: 1 });
    expect(state.date).toEqual({ year: 1950, month: 1 });
    expect(state.monthIndex).toBe(0);
    expect(state.finished).toBe(false);
    expect(state.era).toBe('founding');
  });

  it('동인은 모두 기본값으로 시작한다', () => {
    const state = createInitialState({ seed: 1 });
    for (const key of DRIVER_KEYS) {
      expect(state.drivers[key]).toBe(DRIVERS[key].base);
    }
  });

  it('활성 정책이 없다', () => {
    const state = createInitialState({ seed: 1 });
    expect(isPolicyActive(state, 'anything')).toBe(false);
  });

  it('알 수 없는 시나리오는 거부한다', () => {
    expect(() => createInitialState({ scenarioId: 'nope' })).toThrow();
  });
});

describe('틱 진행', () => {
  it('한 달 뒤 날짜가 넘어간다', () => {
    const state = createInitialState({ seed: 7 });
    const outcome = simulateMonth(state);
    expect(outcome.monthIndex).toBe(0);
    expect(state.monthIndex).toBe(1);
    expect(state.date).toEqual({ year: 1950, month: 2 });
  });

  it('1200개월을 돌리면 2049년 12월까지 끝나고 finished가 된다', () => {
    const state = createInitialState({ seed: 7 });
    simulateMonths(state, TOTAL_MONTHS);
    expect(state.monthIndex).toBe(TOTAL_MONTHS);
    expect(state.finished).toBe(true);
    expect(state.date).toEqual({ year: 2050, month: 1 });
  });

  it('1199개월째에는 아직 끝나지 않는다', () => {
    const state = createInitialState({ seed: 7 });
    simulateMonths(state, TOTAL_MONTHS - 1);
    expect(state.finished).toBe(false);
    expect(state.date).toEqual({ year: 2049, month: 12 });
  });

  it('월 기록은 최근 36개월만 남고 연 기록은 100개가 쌓인다', () => {
    const state = createInitialState({ seed: 7 });
    simulateMonths(state, TOTAL_MONTHS);
    expect(state.history.monthly.length).toBe(36);
    expect(state.history.yearly.length).toBe(100);
    expect(state.history.yearly[0].year).toBe(1950);
    expect(state.history.yearly[99].year).toBe(2049);
  });

  it('뉴스 피드는 50개를 넘지 않는다', () => {
    const state = createInitialState({ seed: 7 });
    for (let i = 0; i < 300; i += 1) {
      state.news.push({ monthIndex: i, year: 1950, month: 1, headline: `h${i}`, tone: 'neutral' });
    }
    simulateMonth(state);
    expect(state.news.length).toBeLessThanOrEqual(50);
  });
});

describe('동인 화이트리스트', () => {
  it('모든 동인의 기본값이 허용 범위 안에 있다', () => {
    for (const key of DRIVER_KEYS) {
      const spec = DRIVERS[key];
      expect(spec.min).toBeLessThanOrEqual(spec.base);
      expect(spec.base).toBeLessThanOrEqual(spec.max);
      expect(spec.min).toBeLessThan(spec.max);
    }
  });

  it('모든 동인에 한국어 이름이 있다', () => {
    for (const key of DRIVER_KEYS) {
      expect(DRIVERS[key].label.length).toBeGreaterThan(0);
      expect(DRIVERS[key].label).toMatch(/[가-힣]/);
    }
  });

  it('kind에 맞는 기본값을 쓴다', () => {
    for (const key of DRIVER_KEYS) {
      const spec = DRIVERS[key];
      if (spec.kind === 'factor') expect(spec.base).toBe(1);
      if (spec.kind === 'offset') expect(spec.base).toBe(0);
    }
  });

  it('clampDriver는 범위를 지키고 NaN을 기본값으로 되돌린다', () => {
    expect(clampDriver('fertilityAdj', 99)).toBe(DRIVERS.fertilityAdj.max);
    expect(clampDriver('fertilityAdj', -99)).toBe(DRIVERS.fertilityAdj.min);
    expect(clampDriver('fertilityAdj', Number.NaN)).toBe(DRIVERS.fertilityAdj.base);
  });

  it('화이트리스트 밖의 키는 거부한다', () => {
    expect(isDriverKey('fertilityAdj')).toBe(true);
    expect(isDriverKey('gdp')).toBe(false);
    expect(isDriverKey('population')).toBe(false);
    expect(isDriverKey('debt')).toBe(false);
  });
});
