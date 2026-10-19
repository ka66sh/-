// 화면 골격 — 상단 바 / 왼쪽 메뉴 / 가운데 화면 / 오른쪽 뉴스 피드 (PROMPT.md §10.2)

import { el, clear } from './dom';
import { PLACEHOLDER, formatGameDate, formatYearMonth } from './format';
import type { GameState } from '../engine/state';
import { ERA_LABELS } from '../engine/eras';
import { REGIME_AXES, regimeOptionLabel } from '../engine/politics/regime';
import type { LoopView, SpeedMultiplier } from '../game/loop';
import { SPEEDS } from '../game/loop';
import type { ScreenContext } from './screens';
import { SCREENS, DEFAULT_SCREEN_ID } from './screens';

/** 상단 바의 핵심 지표 6개 (§10.2). 값은 M1부터 채운다. */
const TOP_METRICS = [
  { key: 'gdpGrowth', label: '성장률' },
  { key: 'gdpPerCapita', label: '1인당 GDP' },
  { key: 'unemployment', label: '실업률' },
  { key: 'inflation', label: '물가' },
  { key: 'stability', label: '안정도' },
  { key: 'debtRatio', label: '부채비율' },
  { key: 'powerRank', label: '국력 순위' },
] as const;

export interface ShellCallbacks {
  onTogglePause(): void;
  onSetSpeed(speed: SpeedMultiplier): void;
  screenContext(): ScreenContext;
}

export interface Shell {
  root: HTMLElement;
  renderFrame(state: GameState, view: LoopView): void;
  renderNews(state: GameState): void;
  renderScreen(): void;
  setScreen(id: string): void;
  activeScreenId(): string;
}

export function createShell(callbacks: ShellCallbacks): Shell {
  let screenId = DEFAULT_SCREEN_ID;

  const nationEl = el('div', { class: 'topbar__nation', text: PLACEHOLDER });
  const regimeEl = el('div', { class: 'topbar__regime', text: PLACEHOLDER });
  const dateEl = el('div', { class: 'topbar__date num', text: PLACEHOLDER });
  const pauseFlag = el('span', { class: 'pause-flag', text: '일시정지', attrs: { hidden: 'true' } });

  const pauseButton = el('button', {
    text: '⏸',
    title: '일시정지 / 재생 (Space)',
    attrs: { 'aria-pressed': 'true', 'aria-label': '일시정지' },
    on: { click: () => callbacks.onTogglePause() },
  });

  const speedButtons = SPEEDS.map((speed, index) =>
    el('button', {
      text: `${speed}x`,
      title: `${speed}배속 (${index + 1})`,
      attrs: { 'aria-pressed': 'false' },
      on: { click: () => callbacks.onSetSpeed(speed) },
    }),
  );

  const metricEls = TOP_METRICS.map((metric) => {
    const value = el('div', { class: 'metric__value', text: PLACEHOLDER });
    const delta = el('div', { class: 'metric__delta', text: '' });
    const node = el('div', { class: 'metric' }, [
      el('div', { class: 'metric__label', text: metric.label }),
      value,
      delta,
    ]);
    return { node, value, delta };
  });

  const topbar = el('header', { class: 'topbar' }, [
    el('div', { class: 'topbar__identity' }, [nationEl, regimeEl]),
    el('div', { class: 'topbar__clock' }, [
      dateEl,
      el('div', { class: 'speed' }, [pauseButton, ...speedButtons]),
      pauseFlag,
    ]),
    el('div', { class: 'topbar__metrics' }, metricEls.map((m) => m.node)),
  ]);

  const navButtons = SCREENS.map((screen) =>
    el('button', {
      text: screen.label,
      attrs: { 'aria-current': String(screen.id === screenId) },
      on: {
        click: () => {
          setScreen(screen.id);
        },
      },
    }),
  );

  const nav = el('nav', { class: 'nav' }, navButtons);
  const main = el('main', { class: 'main' });
  const newsList = el('div', { class: 'news__list' }, [
    el('div', { class: 'news__empty', text: '아직 보도된 소식이 없습니다.' }),
  ]);
  const news = el('aside', { class: 'news' }, [el('h2', { text: '뉴스 피드' }), newsList]);

  const body = el('div', { class: 'body' }, [nav, main, news]);
  const root = el('div', { id: 'app' }, [topbar, body]);

  function renderScreen(): void {
    const screen = SCREENS.find((s) => s.id === screenId) ?? SCREENS[0];
    clear(main);
    main.appendChild(screen.render(callbacks.screenContext()));
    main.scrollTop = 0;
  }

  function setScreen(id: string): void {
    screenId = id;
    SCREENS.forEach((screen, index) => {
      navButtons[index].setAttribute('aria-current', String(screen.id === id));
    });
    renderScreen();
  }

  function renderFrame(state: GameState, view: LoopView): void {
    nationEl.textContent = state.nationName;
    regimeEl.textContent = `${ERA_LABELS[state.era]} · ${REGIME_AXES.map((axis) =>
      regimeOptionLabel(axis, state.regime[axis]),
    ).join(' · ')}`;
    dateEl.textContent = formatGameDate(view.date.year, view.date.month, view.day);

    pauseButton.textContent = view.paused ? '▶' : '⏸';
    pauseButton.setAttribute('aria-pressed', String(view.paused));
    pauseButton.setAttribute('aria-label', view.paused ? '재생' : '일시정지');
    if (view.paused) pauseFlag.removeAttribute('hidden');
    else pauseFlag.setAttribute('hidden', 'true');

    speedButtons.forEach((button, index) => {
      const active = !view.paused && SPEEDS[index] === view.speed;
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function renderNews(state: GameState): void {
    clear(newsList);
    if (state.news.length === 0) {
      newsList.appendChild(el('div', { class: 'news__empty', text: '아직 보도된 소식이 없습니다.' }));
      return;
    }
    for (let i = state.news.length - 1; i >= 0; i -= 1) {
      const item = state.news[i];
      newsList.appendChild(
        el('div', { class: `news__item ${item.tone}` }, [
          el('div', { class: 'news__when', text: formatYearMonth(item.year, item.month) }),
          el('div', { class: 'news__headline', text: item.headline }),
        ]),
      );
    }
  }

  return {
    root,
    renderFrame,
    renderNews,
    renderScreen,
    setScreen,
    activeScreenId: () => screenId,
  };
}
