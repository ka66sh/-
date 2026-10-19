# CONTENT_GUIDE.md — 정책·이벤트 데이터 작성 가이드

콘텐츠는 전부 `src/data`의 **타입 있는 데이터**다. 엔진은 데이터를 해석할 뿐, 특정 정책을 위한
if문을 두지 않는다 (`PROMPT.md` §7). 그래서 선택지가 300개로 늘어도 엔진 코드는 바뀌지 않는다.

## 1. 반드시 지켜야 할 규칙 (테스트가 강제한다)

1. **공짜는 없다.** 모든 정책과 모든 이벤트 선택지는 최소 1개의 비용이나 부작용을 가진다.
   비용의 형태는 정치자본, 유지비(`upkeepGdpShare`), 반대 방향 수정자, 집단 만족도 하락 중 하나 이상.
2. **스톡을 직접 바꾸지 않는다.** 수정자의 `target`은 `src/engine/drivers.ts`의 동인 화이트리스트에
   있어야 한다. 인구·GDP·자본·부채를 건드리려면 `shocks`(화이트리스트 `SHOCK_KINDS`)만 쓴다.
3. **수치 규모.** 단일 정책의 성장률 효과는 보통 ±0.1~1.0%p다. 이를 넘기려면 이 문서 §4에 근거를 적는다.
4. **문체.** 뉴스 브리핑처럼 간결하고 중립적으로. 어느 정치 성향도 편들지 않는다.
5. **실존 이름 금지.** 실제 국가·인물·정당·기업·국제기구 이름을 쓰지 않는다.
6. **참조 id는 유효해야 한다.** 정책·이벤트·집단 id가 실제로 존재해야 한다.
7. **한국어.** 이름·설명·선택지·힌트는 모두 한국어.

## 2. 수정자 쓰는 법

```ts
{ target: 'enrollmentPrimaryAdj', op: 'add', value: 0.25, rampMonths: 36 }
```

- `op: 'add'` — 동인에 더한다. 비율 동인이면 0~1 소수 기준 포인트.
- `op: 'mul'` — 곱한다. 지연·ramp 가중치 w는 `1 + (value − 1) × w`로 보간된다.
- `delayMonths` — 효과가 시작되기까지의 지연. 학교를 지어도 당장 생산성이 오르지 않는다.
- `rampMonths` — 0%에서 100%까지 올라가는 기간. 행정 집행은 보통 12~36개월.
- `durationMonths` — 한시적 효과. 없으면 출처가 사라질 때까지 유지된다.
- 정책을 폐지하면 효과는 폐지 시점 반영률에서 12개월에 걸쳐 0으로 줄어든다.

**교육처럼 세대를 건너는 지연은 `delayMonths`로 흉내 내지 마라.** 재학률을 올리면 코호트의 교육연수가
쌓이고, 그 코호트가 노동인구에 들어올 때 인적자본이 오른다 — 지연은 인구 구조에서 저절로 생긴다.

## 3. 정책 작성 틀

```ts
{
  id: 'compulsory_primary',
  name: '초등 의무교육',
  category: '교육',
  description: '6~11세 취학을 의무화하고 수업료를 없앤다. 농가의 일손이 줄어든다.',
  politicalCapitalCost: 30,
  upkeepGdpShare: 0.008,
  implementationMonths: 12,
  requires: [{ kind: 'metric', key: 'stateCapacity', op: '>=', value: 25 }],
  modifiers: [
    { target: 'enrollmentPrimaryAdj', op: 'add', value: 0.3, rampMonths: 48 },
    { target: 'agriProductivityAdj', op: 'mul', value: 0.98, rampMonths: 24 }, // 아동노동 감소
  ],
  groupReactions: { farmers: -6, students: +8, bureaucrats: +2 },
}
```

체크리스트
- [ ] 비용이 최소 1개 있는가
- [ ] 원인 변수(동인)를 건드리는가, 결과를 건드리는가
- [ ] 효과에 지연·ramp가 붙어 있는가
- [ ] 반대하는 집단이 있는가 (모두가 찬성하는 정책은 의심하라)
- [ ] 설명이 1~2문장인가

## 4. 큰 수치를 쓴 근거
(규모 규칙을 넘는 값을 쓸 때마다 여기에 한 줄씩 적는다.)

- 아직 없음.

## 5. 이벤트 작성 틀

```ts
{
  id: 'drought_major',
  title: '대규모 가뭄',
  text: '남부 곡창지대에 비가 두 달째 내리지 않았다. 농업부는 수확량이 3할 가까이 줄 것으로 본다.',
  category: '자연',
  trigger: { conditions: [{ kind: 'metric', key: 'agricultureEmploymentShare', op: '>', value: 0.3 }],
             monthlyChance: 0.004, cooldownMonths: 60 },
  pausesGame: true,
  choices: [
    { label: '식량을 긴급 수입한다', hint: '기아는 막지만 외화가 빠져나간다',
      shocks: [{ kind: 'reservesChange', value: -0.02 }] },
    { label: '배급제를 실시한다', hint: '도시의 불만이 커진다',
      groupReactions: { workers: -8, middleClass: -6 } },
  ],
}
```

- `hint`는 **방향만 암시하고 정확한 수치는 숨긴다** (§7.3).
- `monthlyChance`는 조건이 충족된 달의 발생 확률이다. 100년 동안 몇 번 나올지 계산해 보고 적어라.
  (월 0.004 ≈ 조건이 늘 충족될 때 100년에 약 4~5회)
- `pausesGame: true`는 선택지가 있는 주요 이벤트에만. 자동 일시정지 목표는 100년에 40~80회다.

## 6. 분량 목표
| 항목 | 첫 도입 | 최종 목표 |
|---|---|---|
| 정책 | M1: 20개 | 60개 이상 (카테고리 균형) |
| 이벤트 | M2: 정치 10개 | 80개 이상 (전 카테고리) |
| 체제 선택지 | M2: 16개 | 16개 |
| 시작 시나리오 | M1: 농업 빈국 / M4: 자원 부국 | 4개 + 커스텀 |
| AI 국가 | M3: 18개 | 18개 |
