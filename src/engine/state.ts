// GameState — 모든 게임 데이터는 하나의 객체에 있다 (PROMPT.md §4.1).
//
// 규칙
//  - 그대로 JSON.stringify 할 수 있어야 한다. 클래스 인스턴스·함수·Map·Set·Date 금지.
//  - 날짜는 { year, month } 와 경과 개월 수(monthIndex)로만 관리한다.
//  - 스톡은 수정자로 직접 바꾸지 않는다 (§4.4).

import type { RngState } from './rng';
import { createRng, deriveRng } from './rng';
import type { ActiveSource, DriverTable } from './modifiers';
import { aggregateDrivers } from './modifiers';
import type { EraId } from './eras';
import type { Regime } from './politics/regime';
import type { Command } from './commands';
import { DEFAULT_SCENARIO_ID, requireScenario } from '../data/scenarios';

/** 저장 포맷 버전. 구조가 바뀌면 올리고 마이그레이션을 추가한다 (§11). */
export const SCHEMA_VERSION = 1;

export const START_YEAR = 1950;
export const END_YEAR = 2049;
/** 100년 = 1200개월 (§2) */
export const TOTAL_MONTHS = (END_YEAR - START_YEAR + 1) * 12;

/** 최근 몇 개월을 월 단위로 보관할지 (§11 저장 크기 목표) */
export const MONTHLY_HISTORY_MONTHS = 36;

export type DifficultyId = 'easy' | 'normal' | 'hard' | 'brutal';

export interface GameDate {
  year: number;
  /** 1~12 */
  month: number;
}

export type TaxKey = 'income' | 'corporate' | 'vat' | 'tariff' | 'progressivity';

export type SpendingKey =
  | 'defense'
  | 'education'
  | 'health'
  | 'welfare'
  | 'infrastructure'
  | 'police'
  | 'rnd'
  | 'admin';

export type FxRegime = 'float' | 'peg';

/** 플레이어가 슬라이더로 직접 정하는 값 (§5.2). 수정자의 대상이 아니다. */
export interface PolicyKnobs {
  taxes: Record<TaxKey, number>;
  /** GDP 대비 비율 */
  spending: Record<SpendingKey, number>;
  /** 기준금리 (연율, 소수) */
  policyRate: number;
  fxRegime: FxRegime;
  /** 적자를 화폐 발행으로 메우는 비율 (0 = 전액 국채) */
  moneyFinanceShare: number;
}

export interface QueuedCommand {
  /** 명령 발생 순서. 결정론 재현의 기준이다. */
  seq: number;
  /** 명령이 접수된 달 */
  monthIndex: number;
  command: Command;
}

export type PauseReason =
  | 'event'
  | 'election'
  | 'coup'
  | 'revolution'
  | 'war'
  | 'crisis'
  | 'era'
  | 'ending';

export interface PauseRequest {
  id: string;
  reason: PauseReason;
  title: string;
  monthIndex: number;
}

export type NewsTone = 'good' | 'bad' | 'neutral';

export interface NewsItem {
  monthIndex: number;
  year: number;
  month: number;
  headline: string;
  tone: NewsTone;
}

export interface ChronicleEntry {
  monthIndex: number;
  year: number;
  month: number;
  kind: string;
  text: string;
}

/** 월 단위 기록. M1부터 지표 필드가 추가된다. */
export interface MonthlySnapshot {
  monthIndex: number;
  year: number;
  month: number;
}

/** 연 단위 압축 기록 */
export interface YearlySnapshot {
  year: number;
}

export interface GameState {
  schemaVersion: number;
  seed: number;
  difficulty: DifficultyId;
  scenarioId: string;
  nationName: string;

  date: GameDate;
  /** 시작 후 경과 개월 수. 0 = 1950년 1월 */
  monthIndex: number;
  totalMonths: number;
  /** 2049년 12월을 넘기면 true (무한 모드에서도 플래그는 유지) */
  finished: boolean;

  /** 메인 난수 스트림 */
  rng: RngState;
  /** 세계 전용 스트림 — 플레이어 쪽 난수 소비가 세계를 흔들지 않게 분리 */
  worldRng: RngState;
  /** 이벤트 판정 전용 스트림 */
  eventRng: RngState;

  era: EraId;
  regime: Regime;
  knobs: PolicyKnobs;

  sources: ActiveSource[];
  /** 이번 달 집계된 동인 값 (파생이지만 디버그·UI를 위해 상태에 둔다) */
  drivers: DriverTable;

  /** 진행 중에 들어온 명령 — 다음 틱 시작 시 적용된다 (§4.2) */
  pending: QueuedCommand[];
  commandSeq: number;

  pauseRequests: PauseRequest[];
  news: NewsItem[];
  chronicle: ChronicleEntry[];
  history: {
    monthly: MonthlySnapshot[];
    yearly: YearlySnapshot[];
  };
}

export interface NewGameOptions {
  seed?: number;
  scenarioId?: string;
  difficulty?: DifficultyId;
  nationName?: string;
}

/** 농업 빈국 1950년의 현실적인 재정 규모 — 근거는 DECISIONS.md D-008 */
function initialKnobs(): PolicyKnobs {
  return {
    taxes: { income: 0.08, corporate: 0.1, vat: 0.03, tariff: 0.12, progressivity: 0.2 },
    spending: {
      defense: 0.025,
      education: 0.012,
      health: 0.008,
      welfare: 0.004,
      infrastructure: 0.02,
      police: 0.01,
      rnd: 0.001,
      admin: 0.03,
    },
    policyRate: 0.05,
    fxRegime: 'peg',
    moneyFinanceShare: 0.3,
  };
}

export function createInitialState(options: NewGameOptions = {}): GameState {
  const seed = options.seed ?? 20240101;
  const scenarioId = options.scenarioId ?? DEFAULT_SCENARIO_ID;
  const scenario = requireScenario(scenarioId);
  const rng = createRng(seed);

  const state: GameState = {
    schemaVersion: SCHEMA_VERSION,
    seed,
    difficulty: options.difficulty ?? 'normal',
    scenarioId,
    nationName: options.nationName ?? '세린 공화국',

    date: { year: START_YEAR, month: 1 },
    monthIndex: 0,
    totalMonths: TOTAL_MONTHS,
    finished: false,

    rng,
    worldRng: deriveRng(rng, 0x5eed_0001),
    eventRng: deriveRng(rng, 0x5eed_0002),

    era: 'founding',
    regime: { ...scenario.startRegime },
    knobs: initialKnobs(),

    sources: [],
    drivers: aggregateDrivers([], 0),

    pending: [],
    commandSeq: 0,

    pauseRequests: [],
    news: [],
    chronicle: [],
    history: { monthly: [], yearly: [] },
  };

  return state;
}

/** monthIndex → { year, month } */
export function dateFromMonthIndex(monthIndex: number): GameDate {
  const total = START_YEAR * 12 + monthIndex;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

/** { year, month } → monthIndex */
export function monthIndexFromDate(date: GameDate): number {
  return (date.year - START_YEAR) * 12 + (date.month - 1);
}

/** 해당 월의 일수 (윤년 포함). 화면 날짜 보간에 쓴다. */
export function daysInMonth(year: number, month: number): number {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2 && (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))) return 29;
  return lengths[month - 1] ?? 30;
}

/** 활성 출처만 (폐지 후 감쇠 중인 것도 포함) */
export function activeSources(state: GameState): readonly ActiveSource[] {
  return state.sources;
}

export function isPolicyActive(state: GameState, policyId: string): boolean {
  return state.sources.some(
    (s) => s.kind === 'policy' && s.defId === policyId && s.removedMonthIndex === null,
  );
}
