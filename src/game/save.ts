// 저장·불러오기 (PROMPT.md §11)
//  - localStorage 수동 슬롯 3개 + 자동저장 1개
//  - JSON 파일 내보내기/가져오기
//  - schemaVersion 마이그레이션. 변환할 수 없으면 안전하게 거부한다.

import type { GameState } from '../engine/state';
import { SCHEMA_VERSION } from '../engine/state';
import type { StorageAdapter } from './storage';

export const SAVE_KEY_PREFIX = 'nara.save.';
export const MANUAL_SLOT_IDS = ['slot1', 'slot2', 'slot3'] as const;
export const AUTOSAVE_SLOT_ID = 'auto';
export type SlotId = (typeof MANUAL_SLOT_IDS)[number] | typeof AUTOSAVE_SLOT_ID;

export const ALL_SLOT_IDS: readonly SlotId[] = [...MANUAL_SLOT_IDS, AUTOSAVE_SLOT_ID];

export interface SaveFile {
  format: 'nara-save';
  schemaVersion: number;
  /** 저장 시각 (ISO 문자열, 표시용) */
  savedAt: string;
  state: GameState;
}

export interface SaveMeta {
  slot: SlotId;
  nationName: string;
  year: number;
  month: number;
  savedAt: string;
  schemaVersion: number;
}

export type LoadResult =
  | { ok: true; state: GameState; migratedFrom?: number }
  | { ok: false; reason: string };

function slotKey(slot: SlotId): string {
  return `${SAVE_KEY_PREFIX}${slot}`;
}

export function serializeSave(state: GameState, savedAt: string): string {
  const file: SaveFile = {
    format: 'nara-save',
    schemaVersion: SCHEMA_VERSION,
    savedAt,
    state,
  };
  return JSON.stringify(file);
}

/**
 * 스키마 마이그레이션. 버전이 올라갈 때마다 변환 단계를 추가한다.
 * 변환할 수 없으면 null을 돌려주고 호출자가 이유를 보여준다.
 */
const MIGRATIONS: Record<number, (state: GameState) => GameState> = {
  // 예시) 1: (state) => ({ ...state, newField: 0, schemaVersion: 2 }),
};

function migrate(state: GameState, fromVersion: number): { state: GameState; ok: boolean } {
  let current = state;
  let version = fromVersion;
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return { state: current, ok: false };
    current = step(current);
    version += 1;
  }
  return { state: current, ok: true };
}

export function parseSave(text: string): LoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: '저장 파일을 읽을 수 없습니다 (JSON 형식이 아닙니다).' };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, reason: '저장 파일의 구조가 올바르지 않습니다.' };
  }
  const file = parsed as Partial<SaveFile>;
  if (file.format !== 'nara-save' || typeof file.schemaVersion !== 'number' || !file.state) {
    return { ok: false, reason: '이 게임의 저장 파일이 아닙니다.' };
  }
  if (file.schemaVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      reason: `더 새로운 버전(v${file.schemaVersion})의 저장 파일입니다. 현재 빌드는 v${SCHEMA_VERSION}까지 읽을 수 있습니다.`,
    };
  }
  if (file.schemaVersion < SCHEMA_VERSION) {
    const migrated = migrate(file.state, file.schemaVersion);
    if (!migrated.ok) {
      return {
        ok: false,
        reason: `v${file.schemaVersion} 저장 파일을 v${SCHEMA_VERSION}으로 변환할 수 없습니다.`,
      };
    }
    return { ok: true, state: migrated.state, migratedFrom: file.schemaVersion };
  }
  return { ok: true, state: file.state };
}

export function saveToSlot(
  storage: StorageAdapter,
  slot: SlotId,
  state: GameState,
  savedAt: string,
): { ok: boolean; reason?: string } {
  const text = serializeSave(state, savedAt);
  const ok = storage.set(slotKey(slot), text);
  if (!ok) return { ok: false, reason: '저장소에 쓸 수 없습니다 (용량 초과 또는 접근 거부).' };
  return { ok: true };
}

export function loadFromSlot(storage: StorageAdapter, slot: SlotId): LoadResult {
  const text = storage.get(slotKey(slot));
  if (text === null) return { ok: false, reason: '빈 슬롯입니다.' };
  return parseSave(text);
}

export function deleteSlot(storage: StorageAdapter, slot: SlotId): void {
  storage.remove(slotKey(slot));
}

export function readSlotMeta(storage: StorageAdapter, slot: SlotId): SaveMeta | null {
  const text = storage.get(slotKey(slot));
  if (text === null) return null;
  try {
    const file = JSON.parse(text) as Partial<SaveFile>;
    if (!file.state || typeof file.schemaVersion !== 'number') return null;
    return {
      slot,
      nationName: file.state.nationName,
      year: file.state.date.year,
      month: file.state.date.month,
      savedAt: file.savedAt ?? '',
      schemaVersion: file.schemaVersion,
    };
  } catch {
    return null;
  }
}

export function listSaves(storage: StorageAdapter): SaveMeta[] {
  const out: SaveMeta[] = [];
  for (const slot of ALL_SLOT_IDS) {
    const meta = readSlotMeta(storage, slot);
    if (meta) out.push(meta);
  }
  return out;
}

/** 내보낼 파일 이름 */
export function suggestFileName(state: GameState): string {
  const month = String(state.date.month).padStart(2, '0');
  return `${state.nationName}_${state.date.year}-${month}.json`;
}
