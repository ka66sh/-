// 부트스트랩 — 상태·루프·화면을 연결한다.

import './ui/styles.css';

import type { GameState } from './engine/state';
import { createInitialState } from './engine/state';
import type { TickOutcome } from './engine/tick';
import { GameLoop } from './game/loop';
import type { SpeedMultiplier } from './game/loop';
import { createStorage } from './game/storage';
import type { SlotId } from './game/save';
import {
  AUTOSAVE_SLOT_ID,
  deleteSlot,
  loadFromSlot,
  parseSave,
  saveToSlot,
  serializeSave,
  suggestFileName,
} from './game/save';
import { createShell } from './ui/shell';
import type { ScreenContext, Settings } from './ui/screens';

const SETTINGS_KEY = 'nara.settings';

const storage = createStorage();

function loadSettings(): Settings {
  const fallback: Settings = { theme: 'dark', autoPause: true };
  const raw = storage.get(SETTINGS_KEY);
  if (raw === null) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      autoPause: parsed.autoPause !== false,
    };
  } catch {
    return fallback;
  }
}

const settings = loadSettings();

function persistSettings(): void {
  storage.set(SETTINGS_KEY, JSON.stringify(settings));
}

function applyTheme(): void {
  document.documentElement.dataset.theme = settings.theme;
}

let state: GameState = createInitialState({ seed: 20240101 });
let statusMessage: ScreenContext['statusMessage'] = null;

function setStatus(text: string, kind: 'ok' | 'err' | 'info'): void {
  statusMessage = { text, kind };
  shell.renderScreen();
}

const loop = new GameLoop(state, {
  autoPause: settings.autoPause,
  onMonth: (outcome: TickOutcome) => {
    // 무거운 갱신(뉴스·표·그래프)은 월 1회만 (§4.6 성능 예산)
    shell.renderNews(state);
    if (state.date.month === 1) {
      saveToSlot(storage, AUTOSAVE_SLOT_ID, state, new Date().toISOString());
    }
    if (outcome.pauseRequests.length > 0 || shell.activeScreenId() !== 'settings') {
      // 화면 내용은 월 1회 갱신한다 (설정 화면은 입력 중일 수 있어 건드리지 않는다).
      if (shell.activeScreenId() !== 'settings') shell.renderScreen();
    }
  },
  onFrame: (view) => {
    shell.renderFrame(state, view);
  },
});

function screenContext(): ScreenContext {
  return { state, storage, settings, actions, statusMessage };
}

const actions: ScreenContext['actions'] = {
  saveSlot(slot: SlotId) {
    const result = saveToSlot(storage, slot, state, new Date().toISOString());
    if (result.ok) {
      setStatus(
        storage.persistent
          ? '저장했습니다.'
          : '저장했습니다. 다만 이 환경에서는 새로고침하면 사라집니다 — JSON으로 내보내 주십시오.',
        storage.persistent ? 'ok' : 'err',
      );
    } else {
      setStatus(result.reason ?? '저장에 실패했습니다.', 'err');
    }
  },
  loadSlot(slot: SlotId) {
    const result = loadFromSlot(storage, slot);
    if (!result.ok) {
      setStatus(result.reason, 'err');
      return;
    }
    state = result.state;
    loop.replaceState(state);
    loop.pause('user');
    shell.renderNews(state);
    setStatus(
      result.migratedFrom === undefined
        ? '불러왔습니다.'
        : `v${result.migratedFrom} 저장을 현재 버전으로 변환해 불러왔습니다.`,
      'ok',
    );
  },
  deleteSlot(slot: SlotId) {
    deleteSlot(storage, slot);
    setStatus('슬롯을 비웠습니다.', 'info');
  },
  exportFile() {
    const text = serializeSave(state, new Date().toISOString());
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = suggestFileName(state);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus('JSON 파일을 내보냈습니다.', 'ok');
  },
  importFile() {
    fileInput.value = '';
    fileInput.click();
  },
  newGame() {
    state = createInitialState({ seed: Date.now() % 2_147_483_647 });
    loop.replaceState(state);
    loop.pause('user');
    shell.renderNews(state);
    setStatus('새 게임을 시작했습니다.', 'ok');
  },
  setTheme(theme) {
    settings.theme = theme;
    persistSettings();
    applyTheme();
    shell.renderScreen();
  },
  setAutoPause(enabled) {
    settings.autoPause = enabled;
    persistSettings();
    shell.renderScreen();
  },
};

const shell = createShell({
  onTogglePause: () => loop.togglePause(),
  onSetSpeed: (speed: SpeedMultiplier) => loop.setSpeed(speed),
  screenContext,
});

const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'application/json,.json';
fileInput.style.display = 'none';
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    const result = parseSave(String(reader.result ?? ''));
    if (!result.ok) {
      setStatus(result.reason, 'err');
      return;
    }
    state = result.state;
    loop.replaceState(state);
    loop.pause('user');
    shell.renderNews(state);
    setStatus('JSON 파일을 불러왔습니다.', 'ok');
  });
  reader.addEventListener('error', () => setStatus('파일을 읽지 못했습니다.', 'err'));
  reader.readAsText(file);
});

function bindKeys(): void {
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    switch (event.code) {
      case 'Space':
        event.preventDefault();
        loop.togglePause();
        break;
      case 'Digit1':
        loop.setSpeed(1);
        break;
      case 'Digit2':
        loop.setSpeed(2);
        break;
      case 'Digit3':
        loop.setSpeed(4);
        break;
      default:
        break;
    }
  });
}

function mount(): void {
  applyTheme();
  document.body.appendChild(shell.root);
  document.body.appendChild(fileInput);
  shell.setScreen('overview');
  shell.renderNews(state);
  shell.renderFrame(state, loop.view());
  bindKeys();
  document.addEventListener('visibilitychange', () => loop.handleVisibility(document.hidden));
  loop.start();
}

mount();
