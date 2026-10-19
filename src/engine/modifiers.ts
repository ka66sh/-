// 수정자(Modifier) 시스템 — 자유도의 핵심 (PROMPT.md §4.4)
//
// 집계식: 최종 동인 값 = (기본값 + Σadd) × Πmul  →  동인별 허용 범위로 clamp.
// 스톡(인구·GDP·자본·부채)은 수정자의 대상이 될 수 없다. 일회성 변화는 Shock으로만 한다.

import type { DriverKey } from './drivers';
import { DRIVER_KEYS, DRIVERS, clampDriver } from './drivers';

export type ModifierOp = 'add' | 'mul';

export interface Modifier {
  /** 동인 화이트리스트(§5.3)에 있는 키만 허용 */
  target: DriverKey;
  op: ModifierOp;
  value: number;
  /** 효과가 시작되기까지의 지연 (기본 0) */
  delayMonths?: number;
  /** 0% → 100%에 도달하는 기간 (기본 0 = 즉시) */
  rampMonths?: number;
  /** 없으면 출처가 사라질 때까지 유지 */
  durationMonths?: number;
}

export type ModifierSourceKind = 'policy' | 'regime' | 'event' | 'era' | 'minister' | 'treaty' | 'war';

export interface ModifierSource {
  id: string;
  kind: ModifierSourceKind;
  /** 툴팁에 표시할 한국어 이름 */
  label: string;
  modifiers: Modifier[];
}

/** 일회성 스톡 변화. 허용 종류는 여기에 화이트리스트로 둔다 (§4.4). */
export const SHOCK_KINDS = [
  'capitalLossShare',
  'infrastructureLossShare',
  'populationLossShare',
  'tfpLossShare',
  'resourceLossShare',
  'pollutionChange',
  'debtChange',
  'reservesChange',
  'politicalCapitalChange',
] as const;

export type ShockKind = (typeof SHOCK_KINDS)[number];

export interface Shock {
  kind: ShockKind;
  /**
   * *LossShare — 해당 스톡의 비율 손실(0~1).
   * debtChange / reservesChange — GDP 대비 비율 포인트 변화.
   * pollutionChange / politicalCapitalChange — 지수·포인트 절대 변화.
   */
  value: number;
}

export function isShockKind(kind: string): kind is ShockKind {
  return (SHOCK_KINDS as readonly string[]).includes(kind);
}

/** 출처가 사라진 뒤 효과가 0으로 줄어드는 기본 기간 */
export const DEFAULT_RAMP_DOWN_MONTHS = 12;

/** GameState에 저장되는 활성 출처. 수정자를 그대로 품어 저장 호환성을 지킨다. */
export interface ActiveSource {
  /** 인스턴스 id. 예: 'policy:compulsory_primary' */
  id: string;
  /** 원본 데이터 id (정책 id, 이벤트 선택지 id 등) */
  defId: string;
  kind: ModifierSourceKind;
  label: string;
  startedMonthIndex: number;
  /** 폐지·만료된 달. null이면 활성 */
  removedMonthIndex: number | null;
  rampDownMonths: number;
  modifiers: Modifier[];
}

export interface DriverContribution {
  sourceId: string;
  label: string;
  kind: ModifierSourceKind;
  op: ModifierOp;
  /** 데이터에 적힌 원래 값 */
  raw: number;
  /** 지연·ramp 반영 가중치 (0~1) */
  weight: number;
  /** 실제로 적용된 값 (add면 더해진 양, mul이면 곱해진 배수) */
  applied: number;
}

export interface DriverBreakdown {
  key: DriverKey;
  label: string;
  base: number;
  value: number;
  contributions: DriverContribution[];
}

export type DriverTable = Record<DriverKey, number>;

/** 이번 달에 이 수정자가 몇 % 반영되는지 (지연 → ramp-up → 만료 → ramp-down) */
export function modifierWeight(mod: Modifier, source: ActiveSource, monthIndex: number): number {
  // 출처가 폐지되었으면 폐지 시점의 반영률을 얼려 두고 거기서부터 감쇠시킨다.
  const liveElapsed = monthIndex - source.startedMonthIndex;
  if (liveElapsed < 0) return 0;

  const removed = source.removedMonthIndex;
  const elapsed = removed === null ? liveElapsed : removed - source.startedMonthIndex;

  const delay = mod.delayMonths ?? 0;
  const t = elapsed - delay;
  if (t < 0) return 0;

  const duration = mod.durationMonths;
  if (duration !== undefined && duration >= 0) {
    // 만료는 실제 경과 시간으로 판정한다 (폐지와 무관하게 수명이 끝나면 0).
    const liveT = liveElapsed - delay;
    if (liveT >= duration) return 0;
  }

  const ramp = mod.rampMonths ?? 0;
  const up = ramp > 0 ? Math.min(1, (t + 1) / ramp) : 1;

  if (removed === null) return up;

  const since = monthIndex - removed;
  const down = source.rampDownMonths > 0 ? Math.max(0, 1 - since / source.rampDownMonths) : 0;
  return up * down;
}

/** 더 이상 어떤 효과도 남지 않은 출처인가 (프루닝 판정) */
export function isSourceExhausted(source: ActiveSource, monthIndex: number): boolean {
  for (const mod of source.modifiers) {
    if (modifierWeight(mod, source, monthIndex) > 1e-9) return false;
  }
  // 아직 지연 대기 중인 수정자가 있으면 살려 둔다.
  if (source.removedMonthIndex === null) {
    for (const mod of source.modifiers) {
      const delay = mod.delayMonths ?? 0;
      if (monthIndex - source.startedMonthIndex < delay) return false;
    }
  }
  return true;
}

function emptyTable(): DriverTable {
  const table = {} as DriverTable;
  for (const key of DRIVER_KEYS) table[key] = DRIVERS[key].base;
  return table;
}

/**
 * 활성 출처 전체를 집계해 동인 값 표를 만든다. 틱에서 매달 1회 호출한다.
 * 성능 때문에 기여도 분해는 하지 않는다 (툴팁은 computeBreakdown을 따로 호출).
 */
export function aggregateDrivers(sources: readonly ActiveSource[], monthIndex: number): DriverTable {
  const addSum = {} as Record<DriverKey, number>;
  const mulProd = {} as Record<DriverKey, number>;
  for (const key of DRIVER_KEYS) {
    addSum[key] = 0;
    mulProd[key] = 1;
  }

  for (const source of sources) {
    for (const mod of source.modifiers) {
      const weight = modifierWeight(mod, source, monthIndex);
      if (weight <= 1e-9) continue;
      if (mod.op === 'add') {
        addSum[mod.target] += mod.value * weight;
      } else {
        // 배수는 가중치에 따라 1에서 선형 보간한다 (×1.2를 50% 반영 → ×1.1).
        mulProd[mod.target] *= 1 + (mod.value - 1) * weight;
      }
    }
  }

  const table = emptyTable();
  for (const key of DRIVER_KEYS) {
    table[key] = clampDriver(key, (DRIVERS[key].base + addSum[key]) * mulProd[key]);
  }
  return table;
}

/** "이 값은 왜?" 툴팁용 기여도 분해 (§4.4 추적 가능성) */
export function computeBreakdown(
  sources: readonly ActiveSource[],
  monthIndex: number,
  key: DriverKey,
): DriverBreakdown {
  const spec = DRIVERS[key];
  const contributions: DriverContribution[] = [];
  let addSum = 0;
  let mulProd = 1;

  for (const source of sources) {
    for (const mod of source.modifiers) {
      if (mod.target !== key) continue;
      const weight = modifierWeight(mod, source, monthIndex);
      if (weight <= 1e-9) continue;
      const applied = mod.op === 'add' ? mod.value * weight : 1 + (mod.value - 1) * weight;
      if (mod.op === 'add') addSum += applied;
      else mulProd *= applied;
      contributions.push({
        sourceId: source.id,
        label: source.label,
        kind: source.kind,
        op: mod.op,
        raw: mod.value,
        weight,
        applied,
      });
    }
  }

  return {
    key,
    label: spec.label,
    base: spec.base,
    value: clampDriver(key, (spec.base + addSum) * mulProd),
    contributions,
  };
}
