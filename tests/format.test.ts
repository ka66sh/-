import { describe, expect, it } from 'vitest';
import {
  PLACEHOLDER,
  formatCount,
  formatDelta,
  formatGameDate,
  formatIndex,
  formatMoney,
  formatPercent,
  formatPoints,
  formatYearMonth,
} from '../src/ui/format';

describe('한국식 숫자 표기 (§10.4)', () => {
  it('만 미만은 천 단위로 끊는다', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(42)).toBe('42');
    expect(formatCount(9999)).toBe('9,999');
  });

  it('만 단위를 쓴다', () => {
    expect(formatCount(10_000)).toBe('1.00만');
    expect(formatCount(250_000)).toBe('25.0만');
    expect(formatCount(25_000_000)).toBe('2,500만');
  });

  it('억·조 단위를 쓴다', () => {
    expect(formatCount(123_456_789)).toBe('1.23억');
    expect(formatCount(5_000_000_000)).toBe('50.0억');
    expect(formatCount(2_500_000_000_000)).toBe('2.50조');
  });

  it('음수와 비유한수를 처리한다', () => {
    expect(formatCount(-25_000_000)).toBe('-2,500만');
    expect(formatCount(Number.NaN)).toBe(PLACEHOLDER);
    expect(formatCount(Number.POSITIVE_INFINITY)).toBe(PLACEHOLDER);
  });

  it('화폐는 기준 달러로 쓴다', () => {
    expect(formatMoney(420)).toBe('$420');
    expect(formatMoney(12_500_000_000)).toBe('$125억');
  });

  it('비율은 소수 첫째 자리 %로 쓴다', () => {
    expect(formatPercent(0.184)).toBe('18.4%');
    expect(formatPercent(0.07, 2)).toBe('7.00%');
    expect(formatPercent(Number.NaN)).toBe(PLACEHOLDER);
    expect(formatPoints(1.25)).toBe('1.3%p');
    expect(formatIndex(63.44)).toBe('63.4');
  });
});

describe('변화 표시 (§8.2)', () => {
  it('색이 아니라 기호로도 방향을 알 수 있다', () => {
    const up = formatDelta(0.012, (v) => formatPercent(v));
    expect(up.direction).toBe('up');
    expect(up.symbol).toBe('▲');
    expect(up.text).toBe('1.2%');

    const down = formatDelta(-0.012, (v) => formatPercent(v));
    expect(down.direction).toBe('down');
    expect(down.symbol).toBe('▼');

    const flat = formatDelta(0, (v) => formatPercent(v));
    expect(flat.direction).toBe('flat');
    expect(flat.symbol).toBe('–');
  });

  it('아주 작은 변화는 변화 없음으로 본다', () => {
    expect(formatDelta(1e-12, (v) => String(v)).direction).toBe('flat');
  });
});

describe('날짜 표기', () => {
  it('한국어 날짜를 만든다', () => {
    expect(formatGameDate(1950, 1, 1)).toBe('1950년 1월 1일');
    expect(formatYearMonth(2049, 12)).toBe('2049년 12월');
  });
});
