import { describe, expect, it } from 'vitest';
import type { Scheduler } from '../src/game/loop';
import { GameLoop, MAX_FRAME_DELTA_MS, MAX_MONTHS_PER_FRAME, MS_PER_MONTH_1X } from '../src/game/loop';
import { createInitialState } from '../src/engine/state';

/** rAF와 시계를 흉내 내는 테스트용 스케줄러 */
class FakeScheduler implements Scheduler {
  private time = 0;
  private pending = new Map<number, (timestamp: number) => void>();
  private nextHandle = 1;

  now(): number {
    return this.time;
  }

  request(callback: (timestamp: number) => void): number {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.pending.set(handle, callback);
    return handle;
  }

  cancel(handle: number): void {
    this.pending.delete(handle);
  }

  /** stepMs 간격으로 frames번 프레임을 돌린다 */
  run(frames: number, stepMs: number): void {
    for (let i = 0; i < frames; i += 1) {
      this.time += stepMs;
      const due = Array.from(this.pending.entries());
      this.pending.clear();
      for (const [, callback] of due) callback(this.time);
    }
  }
}

function setup(options: { speed?: 1 | 2 | 4 } = {}) {
  const scheduler = new FakeScheduler();
  const state = createInitialState({ seed: 101 });
  const months: number[] = [];
  const pauses: Array<{ paused: boolean; cause: string }> = [];
  const loop = new GameLoop(state, {
    scheduler,
    onMonth: (outcome) => months.push(outcome.monthIndex),
    onPauseChange: (paused, cause) => pauses.push({ paused, cause }),
  });
  loop.start();
  // 첫 프레임은 기준 시각을 잡는 데 쓰인다.
  scheduler.run(1, 16);
  if (options.speed) loop.setSpeed(options.speed);
  else loop.resume('user');
  // 재생 직후 첫 프레임은 기준 시각을 다시 잡는 데 쓰인다 (실제로는 16ms 남짓).
  scheduler.run(1, 0);
  return { scheduler, state, loop, months, pauses };
}

describe('시간 루프 (§4.6)', () => {
  it('처음에는 일시정지 상태다', () => {
    const scheduler = new FakeScheduler();
    const loop = new GameLoop(createInitialState({ seed: 1 }), { scheduler });
    expect(loop.isPaused).toBe(true);
    expect(loop.lastPauseCause).toBe('init');
  });

  it('일시정지 중에는 시간이 흐르지 않는다', () => {
    const scheduler = new FakeScheduler();
    const state = createInitialState({ seed: 1 });
    const loop = new GameLoop(state, { scheduler });
    loop.start();
    scheduler.run(200, 50);
    expect(state.monthIndex).toBe(0);
  });

  it('1x에서 5,000ms마다 1개월 진행한다', () => {
    const { scheduler, state } = setup();
    scheduler.run(100, 50); // 5,000ms
    expect(state.monthIndex).toBe(1);
    scheduler.run(100, 50);
    expect(state.monthIndex).toBe(2);
  });

  it('2x는 두 배 빠르다', () => {
    const { scheduler, state } = setup({ speed: 2 });
    scheduler.run(100, 50); // 5,000ms × 2 = 10,000ms 상당
    expect(state.monthIndex).toBe(2);
  });

  it('4x는 네 배 빠르다', () => {
    const { scheduler, state } = setup({ speed: 4 });
    scheduler.run(100, 50);
    expect(state.monthIndex).toBe(4);
  });

  it('1년(12개월)에 1x로 60초가 걸린다', () => {
    const { scheduler, state } = setup();
    scheduler.run(1200, 50); // 60,000ms
    expect(state.monthIndex).toBe(12);
    expect(state.date).toEqual({ year: 1951, month: 1 });
  });

  it('onMonth 콜백이 매달 한 번 불린다', () => {
    const { scheduler, months } = setup();
    scheduler.run(300, 50); // 15,000ms = 3개월
    expect(months).toEqual([0, 1, 2]);
  });

  it('프레임 간격이 아무리 커도 상한을 넘겨 처리하지 않는다', () => {
    const { scheduler, state } = setup();
    scheduler.run(1, 10_000_000);
    // 프레임 델타는 MAX_FRAME_DELTA_MS로 잘린다 → 한 프레임에 1개월도 못 간다.
    expect(state.monthIndex).toBeLessThanOrEqual(MAX_MONTHS_PER_FRAME);
    expect(MAX_FRAME_DELTA_MS).toBeLessThan(MS_PER_MONTH_1X);
  });

  it('날짜는 월 안에서 일 단위로 보간된다', () => {
    const { scheduler, loop } = setup();
    expect(loop.view().day).toBe(1);
    scheduler.run(30, 50); // 1,500ms = 30% 진행
    const view = loop.view();
    expect(view.date).toEqual({ year: 1950, month: 1 });
    expect(view.day).toBeGreaterThan(8);
    expect(view.day).toBeLessThan(12);
    expect(view.monthProgress).toBeGreaterThan(0.29);
    expect(view.monthProgress).toBeLessThan(0.31);
  });

  it('일시정지하면 진행률이 0으로 보인다', () => {
    const { scheduler, loop } = setup();
    scheduler.run(30, 50);
    loop.pause('user');
    expect(loop.view().monthProgress).toBe(0);
    expect(loop.view().day).toBe(1);
  });

  it('탭이 숨겨지면 자동으로 멈추고 돌아오면 재생한다', () => {
    const { scheduler, state, loop, pauses } = setup();
    scheduler.run(20, 50);
    loop.handleVisibility(true);
    expect(loop.isPaused).toBe(true);
    expect(loop.lastPauseCause).toBe('hidden');
    const frozen = state.monthIndex;
    scheduler.run(400, 50);
    expect(state.monthIndex).toBe(frozen);

    loop.handleVisibility(false);
    expect(loop.isPaused).toBe(false);
    scheduler.run(1, 0);
    scheduler.run(100, 50);
    expect(state.monthIndex).toBe(frozen + 1);
    expect(pauses.some((p) => p.cause === 'hidden')).toBe(true);
  });

  it('사용자가 멈춘 상태에서 탭을 숨겼다 돌아오면 멈춘 채로 둔다', () => {
    const { loop } = setup();
    loop.pause('user');
    loop.handleVisibility(true);
    loop.handleVisibility(false);
    expect(loop.isPaused).toBe(true);
  });

  it('게임이 끝나면 자동으로 멈추고 재생되지 않는다', () => {
    const scheduler = new FakeScheduler();
    const state = createInitialState({ seed: 1 });
    state.monthIndex = 1199;
    state.date = { year: 2049, month: 12 };
    const loop = new GameLoop(state, { scheduler });
    loop.start();
    scheduler.run(1, 16);
    loop.resume('user');
    scheduler.run(1, 0);
    scheduler.run(100, 50);
    expect(state.finished).toBe(true);
    expect(loop.isPaused).toBe(true);
    expect(loop.lastPauseCause).toBe('finished');
    loop.resume('user');
    expect(loop.isPaused).toBe(true);
  });

  it('무한 모드에서는 2049년 이후에도 계속 진행한다', () => {
    const scheduler = new FakeScheduler();
    const state = createInitialState({ seed: 1 });
    state.monthIndex = 1199;
    state.date = { year: 2049, month: 12 };
    const loop = new GameLoop(state, { scheduler, endless: true });
    loop.start();
    scheduler.run(1, 16);
    loop.resume('user');
    scheduler.run(1, 0);
    scheduler.run(200, 50);
    expect(state.monthIndex).toBeGreaterThan(1200);
    expect(loop.isPaused).toBe(false);
  });

  it('일시정지 중 명령은 즉시, 진행 중 명령은 다음 틱에 적용된다', () => {
    const { scheduler, state, loop } = setup();
    loop.pause('user');
    loop.submit({ type: 'RENAME_NATION', name: '즉시국' });
    expect(state.nationName).toBe('즉시국');

    loop.resume('user');
    scheduler.run(1, 0);
    loop.submit({ type: 'SET_TAX', tax: 'income', rate: 0.25 });
    expect(state.knobs.taxes.income).toBeCloseTo(0.08, 10);
    scheduler.run(100, 50);
    expect(state.knobs.taxes.income).toBeCloseTo(0.25, 10);
  });

  it('상태를 교체하면 누적 시간이 초기화된다', () => {
    const { scheduler, loop } = setup();
    scheduler.run(50, 50);
    const replacement = createInitialState({ seed: 2 });
    loop.replaceState(replacement);
    expect(loop.currentState).toBe(replacement);
    expect(loop.view().monthProgress).toBe(0);
  });

  it('stepMonth는 한 달만 진행한다', () => {
    const scheduler = new FakeScheduler();
    const state = createInitialState({ seed: 1 });
    const loop = new GameLoop(state, { scheduler });
    loop.stepMonth();
    expect(state.monthIndex).toBe(1);
    expect(loop.isPaused).toBe(true);
  });

  it('stop 이후에는 프레임이 돌지 않는다', () => {
    const { scheduler, state, loop } = setup();
    loop.stop();
    scheduler.run(200, 50);
    expect(state.monthIndex).toBe(0);
  });
});
