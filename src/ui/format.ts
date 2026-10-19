// 숫자·날짜 표기 (PROMPT.md §10.4)
//  - 한국식 단위(만·억·조), 화폐는 기준 달러($), 비율은 소수 첫째 자리 %
//  - 색만으로 구분하지 않기 위해 변화는 ▲▼ 기호를 함께 쓴다 (§8.2)

const GROUP = /\B(?=(\d{3})+(?!\d))/g;

function withThousands(value: string): string {
  const [intPart, fracPart] = value.split('.');
  const grouped = intPart.replace(GROUP, ',');
  return fracPart === undefined ? grouped : `${grouped}.${fracPart}`;
}

function scaled(value: number, digitsRule: (abs: number) => number): string {
  const digits = digitsRule(Math.abs(value));
  return withThousands(value.toFixed(digits));
}

const defaultDigits = (abs: number): number => (abs >= 100 ? 0 : abs >= 10 ? 1 : 2);

/** 한국식 단위로 큰 수를 줄여 쓴다. 예: 25,000,000 → 2,500만 */
export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs < 10_000) return withThousands(Math.round(value).toString());
  if (abs < 100_000_000) return `${scaled(value / 10_000, defaultDigits)}만`;
  if (abs < 1_000_000_000_000) return `${scaled(value / 100_000_000, defaultDigits)}억`;
  return `${scaled(value / 1_000_000_000_000, defaultDigits)}조`;
}

/** 기준 달러 금액 */
export function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `$${formatCount(value)}`;
}

/** 0~1 소수를 %로. 기본 소수 첫째 자리 */
export function formatPercent(ratio: number, digits = 1): string {
  if (!Number.isFinite(ratio)) return '—';
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** 이미 %p 단위인 값 */
export function formatPoints(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}%p`;
}

export function formatIndex(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

export type DeltaDirection = 'up' | 'down' | 'flat';

export interface DeltaView {
  direction: DeltaDirection;
  /** ▲ ▼ – */
  symbol: string;
  text: string;
}

/** 전월 대비 변화 표시 (§10.2) */
export function formatDelta(delta: number, format: (value: number) => string, epsilon = 1e-9): DeltaView {
  if (!Number.isFinite(delta) || Math.abs(delta) <= epsilon) {
    return { direction: 'flat', symbol: '–', text: '변화 없음' };
  }
  const direction: DeltaDirection = delta > 0 ? 'up' : 'down';
  return {
    direction,
    symbol: delta > 0 ? '▲' : '▼',
    text: format(Math.abs(delta)),
  };
}

/** 1950년 1월 1일 */
export function formatGameDate(year: number, month: number, day: number): string {
  return `${year}년 ${month}월 ${day}일`;
}

export function formatYearMonth(year: number, month: number): string {
  return `${year}년 ${month}월`;
}

/** 값이 아직 계산되지 않은 자리 */
export const PLACEHOLDER = '—';
