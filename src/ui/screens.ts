// 화면 정의 (PROMPT.md §10.2, §10.3)
// M0에서는 레이아웃과 설정·저장만 동작한다. 각 화면이 무엇을 담을지는 카드에 적어 둔다.
// 근거 없는 수치를 띄우지 않기 위해, 아직 계산되지 않은 값은 비워 둔다 (설계 7원칙 1).

import { el } from './dom';
import { PLACEHOLDER, formatYearMonth } from './format';
import type { GameState } from '../engine/state';
import { REGIME_AXES, REGIME_AXIS_LABELS, regimeOptionLabel } from '../engine/politics/regime';
import { ERA_LABELS } from '../engine/eras';
import type { StorageAdapter } from '../game/storage';
import type { SlotId } from '../game/save';
import { MANUAL_SLOT_IDS, AUTOSAVE_SLOT_ID, readSlotMeta } from '../game/save';

export interface ScreenActions {
  saveSlot(slot: SlotId): void;
  loadSlot(slot: SlotId): void;
  deleteSlot(slot: SlotId): void;
  exportFile(): void;
  importFile(): void;
  newGame(): void;
  setTheme(theme: 'dark' | 'light'): void;
  setAutoPause(enabled: boolean): void;
}

export interface Settings {
  theme: 'dark' | 'light';
  autoPause: boolean;
}

export interface ScreenContext {
  state: GameState;
  storage: StorageAdapter;
  settings: Settings;
  actions: ScreenActions;
  /** 설정 화면의 상태 메시지 */
  statusMessage: { text: string; kind: 'ok' | 'err' | 'info' } | null;
}

export interface ScreenDef {
  id: string;
  label: string;
  render(ctx: ScreenContext): HTMLElement;
}

/** 아직 구현되지 않은 화면의 자리표 — 무엇이 들어올지 명시한다. */
function placeholder(title: string, milestone: string, items: string[]): HTMLElement {
  return el('section', { class: 'card' }, [
    el('h1', { text: title }),
    el('span', { class: 'pending-note', text: `${milestone}에서 채워집니다` }),
    el('p', { text: '' }),
    el('ul', {}, items.map((item) => el('li', { text: item }))),
  ]);
}

const overview: ScreenDef = {
  id: 'overview',
  label: '개요',
  render: (ctx) =>
    el('div', {}, [
      el('section', { class: 'card' }, [
        el('h1', { text: '개요' }),
        el('p', {
          text: `${ctx.state.nationName} · ${ERA_LABELS[ctx.state.era]} · ${formatYearMonth(
            ctx.state.date.year,
            ctx.state.date.month,
          )}`,
        }),
        el('div', { class: 'row' }, [
          el('span', { class: 'pending-note', text: `시드 ${ctx.state.seed}` }),
          el('span', { class: 'pending-note', text: `경과 ${ctx.state.monthIndex}개월 / ${ctx.state.totalMonths}` }),
        ]),
      ]),
      el('section', { class: 'card' }, [
        el('h2', { text: '현재 체제' }),
        el(
          'div',
          { class: 'row' },
          REGIME_AXES.map((axis) =>
            el('span', {
              class: 'pending-note',
              text: `${REGIME_AXIS_LABELS[axis]}: ${regimeOptionLabel(axis, ctx.state.regime[axis])}`,
            }),
          ),
        ),
      ]),
      placeholder('핵심 지표와 그래프', 'M1', [
        '핵심 지표 카드 (성장률·1인당 GDP·실업률·물가·안정도·부채비율)',
        '그래프 4개 — GDP, 1인당 GDP, 물가·실업, 부채비율',
        '위험 신호 경고 — 부채, 쿠데타 위험, 물가',
      ]),
    ]),
};

const screenPlaceholders: ReadonlyArray<{ id: string; label: string; milestone: string; items: string[] }> = [
  {
    id: 'economy',
    label: '경제',
    milestone: 'M1',
    items: [
      '성장 회계 — 성장률을 자본·노동·인적자본·TFP 기여도로 분해',
      '부문별 고용·생산 비중 (농업·공업·서비스)',
      '물가·금리·환율 그래프',
    ],
  },
  {
    id: 'budget',
    label: '재정·예산',
    milestone: 'M1',
    items: ['세율·지출 슬라이더', '내년 재정수지·부채 실시간 미리보기', '세입 구성과 징수 효율'],
  },
  {
    id: 'society',
    label: '인구·사회',
    milestone: 'M1',
    items: ['인구 피라미드 (연령 구조)', '출산율·기대수명 추이', '교육 수준', '불평등·범죄·환경 지표'],
  },
  {
    id: 'politics',
    label: '정치·체제',
    milestone: 'M2',
    items: [
      '5축 선택 UI — 개혁 비용·기간·위험 미리보기',
      '집단별 만족도·권력 막대',
      '위험 게이지 — 쿠데타·혁명·민주화 압력',
      '선거 일정과 여론조사',
    ],
  },
  {
    id: 'policies',
    label: '정책',
    milestone: 'M1',
    items: [
      '카테고리 탭',
      '정책 카드 — 정치자본·유지비·시행기간·자문단 효과 추정·집단 반응',
      '시행 중인 정책의 진행률과 폐지',
    ],
  },
  {
    id: 'trade',
    label: '외교·무역',
    milestone: 'M4',
    items: ['무역협정·동맹·제재', '경상수지와 환율', '관계도'],
  },
  { id: 'military', label: '군사', milestone: 'M4', items: ['군사력 지수', '병력과 징병', '전쟁 현황'] },
  {
    id: 'world',
    label: '세계',
    milestone: 'M3',
    items: ['순위표 — GDP·1인당 GDP·국력 지수', 'AI 국가 목록 (관계·체제·GDP·추세)'],
  },
  { id: 'chronicle', label: '연대기', milestone: 'M2', items: ['연도별 주요 사건 타임라인'] },
];

function slotRow(ctx: ScreenContext, slot: SlotId, name: string, canSave: boolean): HTMLElement {
  const meta = readSlotMeta(ctx.storage, slot);
  const info = meta
    ? `${meta.nationName} · ${formatYearMonth(meta.year, meta.month)}`
    : '비어 있음';
  const buttons: HTMLElement[] = [];
  if (canSave) {
    buttons.push(
      el('button', {
        class: 'action',
        text: '저장',
        on: { click: () => ctx.actions.saveSlot(slot) },
      }),
    );
  }
  buttons.push(
    el('button', {
      class: 'action',
      text: '불러오기',
      attrs: meta ? {} : { disabled: 'true' },
      on: { click: () => ctx.actions.loadSlot(slot) },
    }),
    el('button', {
      class: 'action',
      text: '삭제',
      attrs: meta ? {} : { disabled: 'true' },
      on: { click: () => ctx.actions.deleteSlot(slot) },
    }),
  );
  return el('div', { class: 'slot' }, [
    el('span', { class: 'slot__name', text: name }),
    el('span', { class: 'slot__info', text: info }),
    ...buttons,
  ]);
}

const settings: ScreenDef = {
  id: 'settings',
  label: '설정',
  render: (ctx) => {
    const storageNote = ctx.storage.persistent
      ? '브라우저 저장소를 사용할 수 있습니다.'
      : ctx.storage.reason;

    return el('div', {}, [
      el('section', { class: 'card' }, [
        el('h1', { text: '설정' }),
        el('div', { class: 'row' }, [
          el('span', { text: '테마' }),
          el('button', {
            class: `action${ctx.settings.theme === 'dark' ? ' primary' : ''}`,
            text: '다크',
            on: { click: () => ctx.actions.setTheme('dark') },
          }),
          el('button', {
            class: `action${ctx.settings.theme === 'light' ? ' primary' : ''}`,
            text: '라이트',
            on: { click: () => ctx.actions.setTheme('light') },
          }),
        ]),
        el('div', { class: 'row' }, [
          el('span', { text: '자동 일시정지' }),
          el('button', {
            class: `action${ctx.settings.autoPause ? ' primary' : ''}`,
            text: ctx.settings.autoPause ? '켜짐' : '꺼짐',
            on: { click: () => ctx.actions.setAutoPause(!ctx.settings.autoPause) },
          }),
          el('span', { class: 'status', text: '주요 이벤트·선거·위기에서 자동으로 멈춥니다 (§8.1).' }),
        ]),
      ]),
      el('section', { class: 'card' }, [
        el('h2', { text: '저장' }),
        el('p', { text: storageNote }),
        ...MANUAL_SLOT_IDS.map((slot, index) => slotRow(ctx, slot, `슬롯 ${index + 1}`, true)),
        slotRow(ctx, AUTOSAVE_SLOT_ID, '자동저장', false),
        el('div', { class: 'row' }, [
          el('button', {
            class: 'action',
            text: 'JSON 내보내기',
            on: { click: () => ctx.actions.exportFile() },
          }),
          el('button', {
            class: 'action',
            text: 'JSON 가져오기',
            on: { click: () => ctx.actions.importFile() },
          }),
          el('button', {
            class: 'action',
            text: '새 게임',
            on: { click: () => ctx.actions.newGame() },
          }),
        ]),
        el('div', {
          class: `status save-status${ctx.statusMessage && ctx.statusMessage.kind !== 'info' ? ` ${ctx.statusMessage.kind}` : ''}`,
          text: ctx.statusMessage?.text ?? '',
        }),
      ]),
      el('section', { class: 'card' }, [
        el('h2', { text: '단축키' }),
        el('ul', {}, [
          el('li', { text: 'Space — 일시정지 / 재생' }),
          el('li', { text: '1 · 2 · 3 — 1x · 2x · 4x 배속' }),
        ]),
      ]),
    ]);
  },
};

export const SCREENS: readonly ScreenDef[] = [
  overview,
  ...screenPlaceholders.map((def) => ({
    id: def.id,
    label: def.label,
    render: () => placeholder(def.label, def.milestone, def.items),
  })),
  settings,
];

export const DEFAULT_SCREEN_ID = 'overview';
export { PLACEHOLDER };
