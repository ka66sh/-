// 월간 틱 (PROMPT.md §4.3)
//
// simulateMonth(state)는 state.monthIndex가 가리키는 달을 계산하고, 마지막에 다음 달로
// 넘긴다. 시스템 실행 순서는 아래 pipeline 하나로만 정의된다 — 순서를 바꾸면 난수 소비
// 순서도 바뀌므로 결정론 테스트가 깨진다는 점을 기억하라.

import type { GameState, NewsItem, ChronicleEntry, PauseRequest, NewsTone, PauseReason } from './state';
import { dateFromMonthIndex, MONTHLY_HISTORY_MONTHS, TOTAL_MONTHS } from './state';
import { applyPendingCommands } from './commands';
import { aggregateDrivers, isSourceExhausted } from './modifiers';
import type { TickContext } from './context';

import { runWorldCycle } from './world/cycle';
import { runAiNations } from './world/nations';
import { runRankings } from './world/rankings';
import { runPopulation } from './systems/population';
import { runEducation } from './systems/education';
import { runProduction } from './systems/production';
import { runDemand } from './systems/demand';
import { runTrade } from './systems/trade';
import { runFinance } from './systems/finance';
import { runSociety } from './systems/society';
import { runInstitutions } from './systems/institutions';
import { runGroups } from './politics/groups';
import { runElections } from './politics/elections';
import { runTransitions } from './politics/transitions';
import { runMilitary } from './systems/military';
import { runDiplomacy } from './systems/diplomacy';
import { runEvents } from './events';
import { runReporting } from './reporting';

/** 뉴스 피드에 보관하는 최대 개수 (§8.2) */
export const NEWS_FEED_LIMIT = 50;

export interface TickOutcome {
  monthIndex: number;
  news: NewsItem[];
  chronicle: ChronicleEntry[];
  pauseRequests: PauseRequest[];
  finished: boolean;
}

/** §4.3의 실행 순서. 이름은 보고서·프로파일링에 쓴다. */
const PIPELINE: ReadonlyArray<readonly [string, (ctx: TickContext) => void]> = [
  ['세계', runWorldCycle],
  ['AI 국가', runAiNations],
  ['인구', runPopulation],
  ['교육·보건', runEducation],
  ['생산', runProduction],
  ['수요·경기', runDemand],
  ['무역·환율', runTrade],
  ['재정', runFinance],
  ['사회', runSociety],
  ['제도', runInstitutions],
  ['집단·민심', runGroups],
  ['선거', runElections],
  ['체제 전환', runTransitions],
  ['군사', runMilitary],
  ['외교', runDiplomacy],
  ['이벤트', runEvents],
  ['공식 통계', runReporting],
  ['순위', runRankings],
];

export function simulateMonth(state: GameState): TickOutcome {
  const monthIndex = state.monthIndex;
  const date = state.date;

  const news: NewsItem[] = [];
  const chronicle: ChronicleEntry[] = [];
  const pauseRequests: PauseRequest[] = [];

  // 1. 대기 중인 명령 적용
  applyPendingCommands(state);

  // 2. 지연 큐 처리 → 이번 달 활성 수정자 집계
  pruneSources(state, monthIndex);
  state.drivers = aggregateDrivers(state.sources, monthIndex);

  const ctx: TickContext = {
    state,
    drivers: state.drivers,
    news: (headline: string, tone: NewsTone) => {
      news.push({ monthIndex, year: date.year, month: date.month, headline, tone });
    },
    chronicle: (kind: string, text: string) => {
      chronicle.push({ monthIndex, year: date.year, month: date.month, kind, text });
    },
    requestPause: (reason: PauseReason, title: string) => {
      pauseRequests.push({
        id: `${reason}:${monthIndex}:${pauseRequests.length}`,
        reason,
        title,
        monthIndex,
      });
    },
  };

  // 3~15. 시스템 실행
  for (const [, run] of PIPELINE) {
    run(ctx);
  }

  // 16. 기록 저장
  state.history.monthly.push({ monthIndex, year: date.year, month: date.month });
  if (state.history.monthly.length > MONTHLY_HISTORY_MONTHS) {
    state.history.monthly.splice(0, state.history.monthly.length - MONTHLY_HISTORY_MONTHS);
  }
  if (date.month === 12) {
    state.history.yearly.push({ year: date.year });
  }

  for (const item of news) state.news.push(item);
  if (state.news.length > NEWS_FEED_LIMIT) {
    state.news.splice(0, state.news.length - NEWS_FEED_LIMIT);
  }
  for (const entry of chronicle) state.chronicle.push(entry);
  for (const request of pauseRequests) state.pauseRequests.push(request);

  // 다음 달로 넘어간다.
  state.monthIndex = monthIndex + 1;
  state.date = dateFromMonthIndex(state.monthIndex);
  if (state.monthIndex >= TOTAL_MONTHS) state.finished = true;

  return { monthIndex, news, chronicle, pauseRequests, finished: state.finished };
}

/** 효과가 완전히 사라진 출처를 상태에서 제거한다 (저장 크기·성능). */
function pruneSources(state: GameState, monthIndex: number): void {
  if (state.sources.length === 0) return;
  let write = 0;
  for (let read = 0; read < state.sources.length; read += 1) {
    const source = state.sources[read];
    if (source.removedMonthIndex !== null && isSourceExhausted(source, monthIndex)) continue;
    state.sources[write] = source;
    write += 1;
  }
  state.sources.length = write;
}

/** 여러 달을 한 번에 돌린다 (따라잡기·헤드리스 시뮬레이터용). */
export function simulateMonths(state: GameState, months: number): TickOutcome[] {
  const outcomes: TickOutcome[] = [];
  for (let i = 0; i < months; i += 1) {
    outcomes.push(simulateMonth(state));
  }
  return outcomes;
}
