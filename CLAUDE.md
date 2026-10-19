# CLAUDE.md — 작업 규칙 요약

> **기준 문서는 `PROMPT.md`다.** 이 파일은 그 문서에서 매 순간 지켜야 할 것만 뽑은 요약이다.
> 둘이 어긋나면 `PROMPT.md`가 이긴다. `PROMPT.md`는 수정하지 않는다.
> 진행 상황은 `PROGRESS.md`, 설계 결정은 `DECISIONS.md`에 있다.

## 지금 어디까지 왔나
- **완료:** M0 기반 공사
- **다음:** M1 핵심 루프 (인구·교육·생산·경기·재정·민심, 정책 20개, 화면 4개, 시뮬레이터 v1)
- 마일스톤 하나가 끝나면 빌드·테스트·완료 기준 확인·커밋·`PROGRESS.md` 갱신까지 하고 **사용자의 지시를 기다린다.**

## 절대 규칙

### 1. 엔진은 순수하다 (`src/engine`)
- DOM, `window`, `document`, `localStorage`, `Date.now()`, `Math.random()`, `setTimeout`, `fetch` 금지.
- 난수는 `src/engine/rng.ts`의 시드 기반 PRNG만 쓴다. 난수 상태는 `GameState` 안에 있다.
- `src/engine`은 `src/ui`, `src/game`을 import하지 않는다. (`src/data`는 콘텐츠이므로 참조해도 된다.)
- **같은 상태 + 같은 시드 + 같은 명령 = 언제나 같은 결과.** `tests/determinism.test.ts`가 강제한다.
- 이 규칙들은 `tests/purity.test.ts`가 소스를 스캔해 검사한다.

### 2. 상태는 하나, 그리고 JSON이다
- 모든 게임 데이터는 `GameState` 하나에. `JSON.stringify` 가능해야 한다 — 클래스 인스턴스·함수·`Map`·`Set`·`Date` 금지.
- 날짜는 `{ year, month }` + `monthIndex`로만 관리한다. `monthIndex 0 = 1950년 1월`.
- UI는 상태를 직접 수정하지 않는다. 입력은 전부 **명령(Command)** 으로 전달한다.

### 3. 결과가 아니라 원인을 건드린다
- 정책·사건·체제는 GDP·인구·자본 같은 **스톡을 직접 바꾸지 않는다.** `src/engine/drivers.ts`의 **동인**만 바꾼다.
- 집계식: `최종 값 = (기본값 + Σadd) × Πmul` → 동인별 범위로 clamp.
- 일회성 스톡 변화는 `Shock`만으로, 그것도 화이트리스트(`SHOCK_KINDS`)에 있는 종류만.
- 동인 화이트리스트에 없는 키를 수정자의 `target`으로 쓰면 테스트가 실패한다.

### 4. 데이터 주도
- 정책·이벤트·체제 선택지·시나리오·국가는 전부 `src/data`의 타입 있는 데이터다.
- **엔진에 특정 정책을 위한 if문을 두지 않는다.** 선택지가 300개로 늘어도 엔진 코드는 그대로여야 한다.
- 조건은 `Condition` 객체로만 표현한다. 문자열 `eval` 금지.
- 모든 정책·이벤트 선택지는 **최소 1개의 비용이나 부작용**을 가진다 (공짜 없음).

### 5. 효과는 늦게 온다
- 수정자에 `delayMonths` / `rampMonths`를 쓴다. 출처가 사라지면 ramp-down으로 서서히 사라진다.
- **교육의 지연은 타이머로 흉내 내지 말고 인구 코호트 구조에서 저절로 생기게 한다.**

### 6. 언어
- UI와 모든 콘텐츠·보고는 **한국어**. 코드 식별자는 영어, 주석은 한국어.
- 실존 국가·인물·정당·기업·국제기구 이름 금지.

### 7. 범위
- `PROMPT.md` §15의 비목표는 만들지 않는다. 좋은 아이디어는 `DECISIONS.md`의 "나중에" 목록에만 적는다.
- 애매하면 설계 7원칙(§1)에 가장 맞는 쪽을 고르고 `DECISIONS.md`에 한 줄 남기고 계속 간다. 사소한 질문으로 멈추지 않는다.
- §2 확정 사항은 사용자 승인 없이 바꾸지 않는다.

## 명령어
| 명령 | 동작 |
|---|---|
| `npm run dev` | 개발 서버 (http://127.0.0.1:5173) |
| `npm run build` | `tsc --noEmit` 후 단일 `dist/index.html` 생성 |
| `npm test` | 전체 테스트 (Vitest) |
| `npm run typecheck` | 타입 검사만 |
| `npm run sim -- --strategy passive --seed 42 --years 100` | 헤드리스 시뮬레이션 + 요약 |

## 폴더 구조
```
PROMPT.md   기준 문서 (수정 금지)      CLAUDE.md  이 파일
PROGRESS.md 진행 상황                 DECISIONS.md 결정 기록 + "나중에"
CONTENT_GUIDE.md 콘텐츠 작성 가이드    README.md  실행·빌드 방법
src/engine/  순수 시뮬레이션 (DOM 금지)
  state.ts   GameState·초기 상태       tick.ts    simulateMonth 실행 순서
  commands.ts 명령 처리                drivers.ts 동인 화이트리스트
  modifiers.ts 수정자·지연 큐·기여도 분해  conditions.ts 조건 평가기
  rng.ts     시드 난수                 metrics.ts 지표 키   eras.ts 시대
  context.ts 틱 컨텍스트               systems/ politics/ world/ events.ts reporting.ts
src/data/    콘텐츠 (정책·이벤트·시나리오…)
src/game/    시간 루프·저장·위임       src/ui/  화면·포맷터
tools/simulate.ts 헤드리스 시뮬레이터  tests/   Vitest
```

## 작업 흐름 (마일스톤 종료 시)
1. `npm run build` 성공
2. `npm test` 전부 통과
3. 해당 마일스톤의 완료 기준 직접 확인 (개발 서버 10분 플레이 + `dist/index.html` 더블클릭)
4. git 커밋 (예: `M1: 핵심 루프 — 인구·경제·재정·민심`)
5. `PROGRESS.md`·`DECISIONS.md` 갱신
6. `PROMPT.md` §14 형식으로 보고하고 **멈춘다**

## 스스로에게 묻는 질문
> "지난 1분 동안 플레이어가 의미 있는 결정을 했는가?"
아니라면 속도·이벤트·피드백을 고친다.
