import { describe, expect, it } from 'vitest';
import { chance, cloneRng, createRng, deriveRng, nextClampedNormal, nextFloat, nextInt, nextNormal, pick } from '../src/engine/rng';

describe('시드 기반 난수', () => {
  it('같은 시드는 같은 수열을 낸다', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 200 }, () => nextFloat(a));
    const seqB = Array.from({ length: 200 }, () => nextFloat(b));
    expect(seqA).toEqual(seqB);
  });

  it('다른 시드는 다른 수열을 낸다', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 50 }, () => nextFloat(a));
    const seqB = Array.from({ length: 50 }, () => nextFloat(b));
    expect(seqA).not.toEqual(seqB);
  });

  it('시드 0도 퇴화하지 않는다', () => {
    const rng = createRng(0);
    const values = Array.from({ length: 20 }, () => nextFloat(rng));
    expect(new Set(values).size).toBeGreaterThan(15);
  });

  it('값은 [0, 1) 범위에 있고 NaN이 없다', () => {
    const rng = createRng(777);
    for (let i = 0; i < 20000; i += 1) {
      const v = nextFloat(rng);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('평균이 0.5 근처다', () => {
    const rng = createRng(31337);
    let sum = 0;
    const n = 100000;
    for (let i = 0; i < n; i += 1) sum += nextFloat(rng);
    expect(Math.abs(sum / n - 0.5)).toBeLessThan(0.01);
  });

  it('cloneRng는 수열을 복제한다', () => {
    const a = createRng(99);
    nextFloat(a);
    const b = cloneRng(a);
    expect(nextFloat(a)).toBe(nextFloat(b));
  });

  it('deriveRng는 독립 스트림을 만든다', () => {
    const base = createRng(555);
    const left = deriveRng(base, 1);
    const right = deriveRng(base, 2);
    expect(left.s).not.toBe(right.s);
    expect(nextFloat(left)).not.toBe(nextFloat(right));
  });

  it('nextInt는 범위를 지킨다', () => {
    const rng = createRng(4242);
    for (let i = 0; i < 5000; i += 1) {
      const v = nextInt(rng, 3, 7);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThan(7);
    }
    expect(nextInt(rng, 5, 5)).toBe(5);
  });

  it('chance는 경계값을 처리한다', () => {
    const rng = createRng(1);
    expect(chance(rng, 0)).toBe(false);
    expect(chance(rng, 1)).toBe(true);
  });

  it('정규분포의 평균·표준편차가 대략 맞다', () => {
    const rng = createRng(2024);
    const n = 50000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i += 1) {
      const v = nextNormal(rng, 2, 3);
      expect(Number.isFinite(v)).toBe(true);
      sum += v;
      sumSq += v * v;
    }
    const mean = sum / n;
    const sd = Math.sqrt(sumSq / n - mean * mean);
    expect(Math.abs(mean - 2)).toBeLessThan(0.1);
    expect(Math.abs(sd - 3)).toBeLessThan(0.1);
  });

  it('nextClampedNormal은 꼬리를 자른다', () => {
    const rng = createRng(8);
    for (let i = 0; i < 20000; i += 1) {
      const v = nextClampedNormal(rng, 0, 1, 2);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThanOrEqual(2);
    }
  });

  it('pick은 빈 배열에서 undefined를 낸다', () => {
    const rng = createRng(3);
    expect(pick(rng, [])).toBeUndefined();
    expect(pick(rng, ['a'])).toBe('a');
  });
});
