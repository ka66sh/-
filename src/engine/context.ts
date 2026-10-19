// 틱 컨텍스트 — 한 달을 계산하는 동안 시스템들이 공유하는 작업 공간.
//
// 각 시스템은 가능한 한 전월 값을 입력으로 쓴다 (§4.3). 전월 스냅샷 구조는
// 계산할 지표가 생기는 M1에서 prev 필드로 추가한다.

import type { GameState, NewsTone, PauseReason } from './state';
import type { DriverTable } from './modifiers';

export interface TickContext {
  state: GameState;
  /** 이번 달 집계된 동인 값 (§4.4) */
  drivers: DriverTable;
  /** 뉴스 피드에 헤드라인을 남긴다 (§8.2) */
  news: (headline: string, tone: NewsTone) => void;
  /** 연대기에 기록한다 (§6.11) */
  chronicle: (kind: string, text: string) => void;
  /** 자동 일시정지를 요청한다 (§8.1) */
  requestPause: (reason: PauseReason, title: string) => void;
}
