// 저장소 어댑터 (PROMPT.md §11)
//
// dist/index.html을 더블클릭해 file:// 로 열면 브라우저가 localStorage를 막을 수 있다.
// 그래서 접근을 반드시 try/catch로 감싸고, 실패하면 메모리 저장소로 내려앉은 뒤
// JSON 파일 내보내기를 안내한다. 근거: DECISIONS.md D-003.

export interface StorageAdapter {
  /** localStorage를 쓸 수 있으면 true. false면 메모리(새로고침하면 사라짐) */
  readonly persistent: boolean;
  /** 비영속일 때 사용자에게 보여줄 한국어 이유 */
  readonly reason: string;
  get(key: string): string | null;
  set(key: string, value: string): boolean;
  remove(key: string): void;
  keys(): string[];
}

function createMemoryStorage(reason: string): StorageAdapter {
  const map: Record<string, string> = {};
  return {
    persistent: false,
    reason,
    get: (key) => (Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null),
    set: (key, value) => {
      map[key] = value;
      return true;
    },
    remove: (key) => {
      delete map[key];
    },
    keys: () => Object.keys(map),
  };
}

export function createStorage(): StorageAdapter {
  let raw: Storage;
  try {
    if (typeof localStorage === 'undefined') {
      return createMemoryStorage('이 환경에는 브라우저 저장소가 없습니다.');
    }
    raw = localStorage;
    const probe = '__nara_probe__';
    raw.setItem(probe, '1');
    raw.removeItem(probe);
  } catch {
    return createMemoryStorage(
      '브라우저가 이 파일에 저장소 접근을 허용하지 않았습니다. 진행 상황은 JSON 파일로 내보내 주십시오.',
    );
  }

  const store = raw;
  return {
    persistent: true,
    reason: '',
    get: (key) => {
      try {
        return store.getItem(key);
      } catch {
        return null;
      }
    },
    set: (key, value) => {
      try {
        store.setItem(key, value);
        return true;
      } catch {
        // 용량 초과 등
        return false;
      }
    },
    remove: (key) => {
      try {
        store.removeItem(key);
      } catch {
        /* 무시 */
      }
    },
    keys: () => {
      const out: string[] = [];
      try {
        for (let i = 0; i < store.length; i += 1) {
          const key = store.key(i);
          if (key !== null) out.push(key);
        }
      } catch {
        /* 무시 */
      }
      return out;
    },
  };
}
