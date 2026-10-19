# PROGRESS.md — 진행 상황

> 세션이 끊겨도 이어갈 수 있게 유지한다. 기준 문서는 `PROMPT.md`, 규칙 요약은 `CLAUDE.md`.

**현재 마일스톤: M0 완료 → M1 대기 (사용자 지시 대기 중)**

## 완료

### M0 기반 공사
- [x] 프로젝트 생성 — Vite 8 + TypeScript 5.9 (`strict`) + vite-plugin-singlefile + Vitest 5 + tsx
- [x] 폴더 구조 (`src/engine`, `src/data`, `src/game`, `src/ui`, `tools`, `tests`)
- [x] 문서 — `CLAUDE.md`, `PROGRESS.md`, `DECISIONS.md`, `CONTENT_GUIDE.md`, `README.md`
- [x] 시드 기반 난수 `src/engine/rng.ts` (mulberry32, 난수 상태는 `GameState` 안)
- [x] `GameState` — JSON 직렬화 가능, 날짜는 `{year, month}` + `monthIndex`
- [x] 동인 화이트리스트 `src/engine/drivers.ts` — 48개 (§5.3 전체)
- [x] 수정자 시스템 — 지연·ramp·만료·폐지 후 감쇠, 집계식 `(기본값 + Σadd) × Πmul`, 기여도 분해
- [x] 조건 평가기 — 타입 있는 `Condition` 7종, 문자열 eval 없음, 데이터 검증 함수 포함
- [x] 체제 5축 타입 + 324 조합 열거, 시대 4개, 지표 키 67개
- [x] 명령 처리 — 일시정지 중 즉시 / 진행 중 다음 틱, `(monthIndex, seq)` 순서 보장
- [x] 월간 틱 `simulateMonth` — §4.3의 16단계 실행 순서를 파이프라인 하나로 정의, 시스템 스텁 18개
- [x] 시간 루프 — rAF 고정 스텝, 1x/2x/4x, 일시정지, 일 단위 날짜 보간, 탭 비활성 자동 정지, 프레임 상한
- [x] 저장 골격 — 저장소 어댑터(localStorage → 메모리 폴백), 슬롯 3 + 자동저장, JSON 내보내기/가져오기,
      `schemaVersion` 마이그레이션 틀
- [x] UI 골격 — 상단 바(국가명·체제·흐르는 날짜·배속·지표 7칸), 왼쪽 메뉴 11개, 뉴스 피드, 설정 화면,
      다크/라이트 테마, 반응형, 단축키(Space·1·2·3)
- [x] 헤드리스 시뮬레이터 `tools/simulate.ts` — `passive` 전략, 성능 측정, 자동 일시정지 집계, CSV 출력
- [x] 테스트 8파일 — 난수, 날짜·상태·동인, 수정자, 체제·시대·지표, 조건, 결정론·직렬화·저장, 시간 루프,
      숫자 포맷, 소스 규칙(엔진 순수성·`any` 금지·동적 import 금지)
- [x] 단일 파일 빌드 — `dist/index.html` 하나

## 다음: M1 핵심 루프
1. 인구 — 연령별 배열, 출생·사망·이민, 매년 1월 연령 이동, 인구 전환 (§6.1)
2. 교육·인적자본 — 단계별 재학률, 코호트 교육연수, Penn World Table 방식 H (§6.2) — **지연은 코호트에서 저절로**
3. 생산 — 잠재 GDP, 자본 축적, TFP 따라잡기, 구조 전환 (§6.3) + D-001의 L 정의
4. 수요·경기 — 산출갭, 물가, 실업(오쿤), 테일러 준칙 (§6.4)
5. 재정 — 세입·세출·적자·부채·국채금리·신용등급 (§6.5)
6. 집단·민심 기초 — 11개 집단, 기대 대비 만족도, 정당성·안정도 (§6.10)
7. 정책 20개 (`src/data/policies.ts`) + 정책 시행·폐지 명령
8. 화면 — 개요·경제·재정·정책, Chart.js 그래프, "이 값은 왜?" 툴팁
9. 시뮬레이터 `passive`·`balanced` + §12.1 테스트(보존 법칙·인구 전환) 추가

## 알려진 제약
- M0의 각 화면은 자리표다. 계산되지 않은 지표는 `—`로 두었다 (D-015).
- `ENACT_POLICY`·`REFORM_REGIME`·`RESOLVE_EVENT`·`SET_DELEGATION` 명령은 타입만 있고 아직 거부된다
  (각각 M1·M2·M2·M3).
- 자동 일시정지 배선은 끝났지만 아직 아무 이벤트도 요청하지 않는다 (M2·M3).
