// 시드 기반 결정론 난수 (PROMPT.md §4.5)
// - Math.random() 사용 금지. 난수 상태는 GameState 안에 저장되는 일반 객체다.
// - 상태를 제자리에서 갱신하므로 호출 순서가 결과를 결정한다. 엔진의 실행 순서를 바꾸면
//   난수 소비 순서도 바뀐다는 점을 유의하라.

export interface RngState {
  /** mulberry32 내부 상태 (32비트 부호 없는 정수) */
  s: number;
}

/** 시드에서 난수 상태를 만든다. 같은 시드 = 같은 난수열. */
export function createRng(seed: number): RngState {
  // 0 시드가 들어와도 퇴화하지 않도록 섞어 준다.
  return { s: (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0) || 0x6d2b79f5 };
}

/** 난수 상태를 복제한다 (분기 시뮬레이션·미리보기용). */
export function cloneRng(rng: RngState): RngState {
  return { s: rng.s };
}

/**
 * 독립적인 난수 스트림을 파생한다. 서로 다른 시스템이 서로의 난수 소비에
 * 영향을 주지 않아야 할 때 쓴다 (예: 세계 경기 vs 이벤트 판정).
 */
export function deriveRng(rng: RngState, salt: number): RngState {
  return { s: (Math.imul(rng.s ^ (salt + 0x9e3779b9), 0x6d2b79f5) >>> 0) || 0x9e3779b9 };
}

/** [0, 1) 균등분포 */
export function nextFloat(rng: RngState): number {
  rng.s = (rng.s + 0x6d2b79f5) >>> 0;
  let t = rng.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** [min, max) 균등분포 */
export function nextRange(rng: RngState, min: number, max: number): number {
  return min + nextFloat(rng) * (max - min);
}

/** [minInclusive, maxExclusive) 정수 */
export function nextInt(rng: RngState, minInclusive: number, maxExclusive: number): number {
  const span = Math.max(0, Math.floor(maxExclusive) - Math.ceil(minInclusive));
  if (span <= 0) return Math.ceil(minInclusive);
  return Math.ceil(minInclusive) + Math.floor(nextFloat(rng) * span);
}

/** 확률 p로 true */
export function chance(rng: RngState, p: number): boolean {
  if (p <= 0) return false;
  if (p >= 1) return true;
  return nextFloat(rng) < p;
}

/**
 * 정규분포 (Box–Muller). 캐시를 두지 않는다 — 캐시를 GameState에 넣으면
 * 직렬화 경계에서 결정론이 깨질 수 있다.
 */
export function nextNormal(rng: RngState, mean = 0, sd = 1): number {
  const u1 = Math.max(nextFloat(rng), 1e-12);
  const u2 = nextFloat(rng);
  return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** 꼬리를 자른 정규분포 — 극단적 충격이 시뮬레이션을 깨뜨리지 않게 한다. */
export function nextClampedNormal(rng: RngState, mean: number, sd: number, maxSigma = 3): number {
  const z = nextNormal(rng, 0, 1);
  const clamped = Math.max(-maxSigma, Math.min(maxSigma, z));
  return mean + sd * clamped;
}

/** 배열에서 하나를 고른다. 빈 배열이면 undefined. */
export function pick<T>(rng: RngState, items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[nextInt(rng, 0, items.length)];
}
