// 시간 루프 (PROMPT.md §4.6, §8.1)
//  - requestAnimationFrame + 누적 시간 고정 스텝. 1x 기준 5,000ms마다 1개월.
//  - 화면 날짜는 누적 진행률로 일 단위 보간한다 (계산은 월 1회).
//  - 탭이 비활성화되면 자동 일시정지. 한 프레임에 처리하는 개월 수에 상한을 둔다.
//
// 테스트를 위해 시계와 rAF를 주입할 수 있게 만들었다 (브라우저 API 의존을 떼어낸다).

import type { GameState, GameDate } from '../engine/state';
import { daysInMonth } from '../engine/state';
import type { Command } from '../engine/commands';
import { submitCommand } from '../engine/commands';
import type { TickOutcome } from '../engine/tick';
import { simulateMonth } from '../engine/tick';

/** 1개월에 해당하는 실시간 (1x) */
export const MS_PER_MONTH_1X = 5000;
/** 한 프레임에 따라잡을 수 있는 최대 개월 수 (폭주 방지) */
export const MAX_MONTHS_PER_FRAME = 4;
/** 프레임 간격 상한 — 탭 복귀 직후의 거대한 dt를 잘라낸다 */
export const MAX_FRAME_DELTA_MS = 250;

export type SpeedMultiplier = 1 | 2 | 4;
export const SPEEDS: readonly SpeedMultiplier[] = [1, 2, 4];

export type PauseCause = 'init' | 'user' | 'hidden' | 'auto' | 'finished';

export interface LoopView {
  date: GameDate;
  /** 보간된 '오늘' (1~해당 월 일수) */
  day: number;
  /** 이번 달 진행률 0~1 */
  monthProgress: number;
  paused: boolean;
  speed: SpeedMultiplier;
}

export interface Scheduler {
  now(): number;
  request(callback: (timestamp: number) => void): number;
  cancel(handle: number): void;
}

export const browserScheduler: Scheduler = {
  now: () => performance.now(),
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

export interface GameLoopOptions {
  onMonth?: (outcome: TickOutcome) => void;
  onFrame?: (view: LoopView) => void;
  onPauseChange?: (paused: boolean, cause: PauseCause) => void;
  scheduler?: Scheduler;
  /** 자동 일시정지 사용 여부 (§8.1) */
  autoPause?: boolean;
  /** 2049년 12월 이후에도 계속 진행할지 (§8.6 무한 모드) */
  endless?: boolean;
}

export class GameLoop {
  private state: GameState;
  private readonly options: GameLoopOptions;
  private readonly scheduler: Scheduler;

  private accumulator = 0;
  private lastTimestamp: number | null = null;
  private handle: number | null = null;

  private paused = true;
  private pauseCause: PauseCause = 'init';
  private speedValue: SpeedMultiplier = 1;
  /** 탭 비활성화로 멈췄을 때 복귀 후 자동으로 재생할지 */
  private resumeOnVisible = false;

  constructor(state: GameState, options: GameLoopOptions = {}) {
    this.state = state;
    this.options = options;
    this.scheduler = options.scheduler ?? browserScheduler;
  }

  get speed(): SpeedMultiplier {
    return this.speedValue;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get currentState(): GameState {
    return this.state;
  }

  /** 불러오기 후 상태를 교체한다. 누적 시간은 초기화한다. */
  replaceState(state: GameState): void {
    this.state = state;
    this.accumulator = 0;
    this.lastTimestamp = null;
    this.emitFrame();
  }

  start(): void {
    if (this.handle !== null) return;
    this.lastTimestamp = null;
    this.handle = this.scheduler.request(this.frame);
  }

  stop(): void {
    if (this.handle === null) return;
    this.scheduler.cancel(this.handle);
    this.handle = null;
  }

  setSpeed(speed: SpeedMultiplier): void {
    this.speedValue = speed;
    if (this.paused) this.resume('user');
  }

  pause(cause: PauseCause = 'user'): void {
    if (this.paused) return;
    this.paused = true;
    this.pauseCause = cause;
    this.accumulator = 0;
    this.options.onPauseChange?.(true, cause);
    this.emitFrame();
  }

  resume(cause: PauseCause = 'user'): void {
    if (!this.paused) return;
    if (this.state.finished && !this.options.endless) return;
    this.paused = false;
    this.pauseCause = cause;
    this.lastTimestamp = null;
    this.options.onPauseChange?.(false, cause);
    this.emitFrame();
  }

  togglePause(): void {
    if (this.paused) this.resume('user');
    else this.pause('user');
  }

  /** 무엇 때문에 멈췄는지 (화면 표시용) */
  get lastPauseCause(): PauseCause {
    return this.pauseCause;
  }

  /** 명령 접수 — 일시정지 중이면 즉시, 진행 중이면 다음 틱에 적용된다 (§4.2) */
  submit(command: Command): void {
    submitCommand(this.state, command, { paused: this.paused });
  }

  /** 탭 가시성 변화 처리 (§4.6) */
  handleVisibility(hidden: boolean): void {
    if (hidden) {
      if (!this.paused) {
        this.resumeOnVisible = true;
        this.pause('hidden');
      }
      return;
    }
    if (this.resumeOnVisible) {
      this.resumeOnVisible = false;
      this.resume('user');
    }
  }

  /** 한 달을 수동으로 진행한다 (디버그·테스트) */
  stepMonth(): void {
    this.runMonth();
    this.emitFrame();
  }

  private readonly frame = (timestamp: number): void => {
    this.handle = this.scheduler.request(this.frame);

    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
      this.emitFrame();
      return;
    }
    const rawDelta = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    if (!this.paused) {
      const delta = Math.min(Math.max(rawDelta, 0), MAX_FRAME_DELTA_MS);
      this.accumulator += delta * this.speedValue;

      let months = 0;
      while (this.accumulator >= MS_PER_MONTH_1X && months < MAX_MONTHS_PER_FRAME) {
        this.accumulator -= MS_PER_MONTH_1X;
        this.runMonth();
        months += 1;
        if (this.paused) break;
      }
      // 상한에 걸렸으면 남은 누적 시간은 버린다 (따라잡기 폭주 방지).
      if (months >= MAX_MONTHS_PER_FRAME) this.accumulator = 0;
    }

    this.emitFrame();
  };

  private runMonth(): void {
    const outcome = simulateMonth(this.state);
    this.options.onMonth?.(outcome);

    if (this.state.finished && !this.options.endless) {
      this.pause('finished');
      return;
    }
    if (outcome.pauseRequests.length > 0 && (this.options.autoPause ?? true)) {
      this.pause('auto');
    }
  }

  private emitFrame(): void {
    this.options.onFrame?.(this.view());
  }

  view(): LoopView {
    const progress = this.paused ? 0 : Math.min(0.999, this.accumulator / MS_PER_MONTH_1X);
    const { year, month } = this.state.date;
    const days = daysInMonth(year, month);
    return {
      date: { year, month },
      day: Math.min(days, 1 + Math.floor(progress * days)),
      monthProgress: progress,
      paused: this.paused,
      speed: this.speedValue,
    };
  }
}
