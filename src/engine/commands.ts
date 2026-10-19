// 플레이어 명령 (PROMPT.md §4.2)
//
// UI는 상태를 직접 수정하지 않는다. 모든 입력은 명령으로 엔진에 전달된다.
//  - 일시정지 중의 명령: 즉시 적용
//  - 진행 중의 명령: 다음 틱 시작 시 적용
// 어느 쪽이든 (monthIndex, seq)가 기록되므로 재현 가능하다.

import type { GameState, TaxKey, SpendingKey, FxRegime, QueuedCommand } from './state';
import type { RegimeAxis, RegimeOption } from './politics/regime';
import { isValidRegimeOption } from './politics/regime';

export type MinistryId = 'finance' | 'monetary' | 'industry' | 'social' | 'defense' | 'foreign';

export type Command =
  | { type: 'RENAME_NATION'; name: string }
  | { type: 'SET_TAX'; tax: TaxKey; rate: number }
  | { type: 'SET_SPENDING'; item: SpendingKey; gdpShare: number }
  | { type: 'SET_POLICY_RATE'; rate: number }
  | { type: 'SET_FX_REGIME'; fxRegime: FxRegime }
  | { type: 'SET_DEFICIT_FINANCING'; moneyShare: number }
  | { type: 'ENACT_POLICY'; policyId: string }
  | { type: 'REPEAL_POLICY'; policyId: string }
  | { type: 'REFORM_REGIME'; axis: RegimeAxis; option: RegimeOption }
  | { type: 'RESOLVE_EVENT'; eventId: string; choiceIndex: number }
  | { type: 'SET_DELEGATION'; ministry: MinistryId; enabled: boolean; stance: string };

export interface CommandResult {
  ok: boolean;
  /** 실패했을 때 플레이어에게 보여줄 한국어 설명 */
  message?: string;
}

const OK: CommandResult = { ok: true };

/** 아직 해당 마일스톤에서 구현되지 않은 명령 */
function notYet(what: string): CommandResult {
  return { ok: false, message: `${what}은 아직 이 빌드에서 처리할 수 없습니다.` };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

const TAX_LIMITS: Readonly<Record<TaxKey, [number, number]>> = {
  income: [0, 0.75],
  corporate: [0, 0.7],
  vat: [0, 0.4],
  tariff: [0, 0.6],
  progressivity: [0, 1],
};

/** 지출 항목 하나의 GDP 대비 상한 */
const SPENDING_LIMIT = 0.3;

export function applyCommand(state: GameState, command: Command): CommandResult {
  switch (command.type) {
    case 'RENAME_NATION': {
      const name = command.name.trim().slice(0, 24);
      if (name.length === 0) return { ok: false, message: '국가명이 비어 있습니다.' };
      state.nationName = name;
      return OK;
    }

    case 'SET_TAX': {
      const limits = TAX_LIMITS[command.tax];
      if (!limits) return { ok: false, message: `알 수 없는 세목: ${command.tax}` };
      state.knobs.taxes[command.tax] = clamp(command.rate, limits[0], limits[1]);
      return OK;
    }

    case 'SET_SPENDING': {
      if (!(command.item in state.knobs.spending)) {
        return { ok: false, message: `알 수 없는 지출 항목: ${command.item}` };
      }
      state.knobs.spending[command.item] = clamp(command.gdpShare, 0, SPENDING_LIMIT);
      return OK;
    }

    case 'SET_POLICY_RATE': {
      state.knobs.policyRate = clamp(command.rate, 0, 0.6);
      return OK;
    }

    case 'SET_FX_REGIME': {
      if (command.fxRegime !== 'float' && command.fxRegime !== 'peg') {
        return { ok: false, message: '알 수 없는 환율제도입니다.' };
      }
      state.knobs.fxRegime = command.fxRegime;
      return OK;
    }

    case 'SET_DEFICIT_FINANCING': {
      state.knobs.moneyFinanceShare = clamp(command.moneyShare, 0, 1);
      return OK;
    }

    // ── 아래는 해당 마일스톤에서 구현한다 ────────────────────────────────
    case 'ENACT_POLICY':
    case 'REPEAL_POLICY':
      return notYet('정책 시행·폐지'); // M1
    case 'REFORM_REGIME': {
      if (!isValidRegimeOption(command.axis, command.option)) {
        return { ok: false, message: '해당 축에 없는 선택지입니다.' };
      }
      return notYet('체제 개혁'); // M2
    }
    case 'RESOLVE_EVENT':
      return notYet('이벤트 선택'); // M2
    case 'SET_DELEGATION':
      return notYet('장관 위임'); // M3

    default: {
      const exhaustive: never = command;
      return { ok: false, message: `알 수 없는 명령: ${JSON.stringify(exhaustive)}` };
    }
  }
}

/**
 * 명령을 접수한다. paused면 즉시 적용하고, 아니면 다음 틱으로 넘긴다.
 * 어느 경우든 seq가 증가하므로 명령 순서는 항상 결정적이다.
 */
export function submitCommand(
  state: GameState,
  command: Command,
  options: { paused: boolean },
): { queued: QueuedCommand; result: CommandResult | null } {
  const queued: QueuedCommand = {
    seq: state.commandSeq++,
    monthIndex: state.monthIndex,
    command,
  };
  if (options.paused) {
    return { queued, result: applyCommand(state, command) };
  }
  state.pending.push(queued);
  return { queued, result: null };
}

/** 틱의 1단계: 대기 중인 명령을 seq 순서대로 적용한다. */
export function applyPendingCommands(state: GameState): CommandResult[] {
  if (state.pending.length === 0) return [];
  const queue = state.pending.slice().sort((a, b) => a.seq - b.seq);
  state.pending = [];
  return queue.map((item) => applyCommand(state, item.command));
}
