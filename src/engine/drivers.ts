// 동인(driver) 화이트리스트 (PROMPT.md §5.3)
//
// 설계 원칙 2: 정책·사건·체제는 결과(스톡)를 직접 바꾸지 않는다. 오직 이 파일에 정의된
// 동인만 바꾼다. 여기 없는 키를 수정자의 target으로 쓰면 데이터 검증 테스트가 실패한다.
//
// kind 의미
//  - 'factor'  : 계산된 양에 곱해지는 배수. 기본값 1.
//  - 'offset'  : 계산된 양에 더해지는 값. 기본값 0. (비율이면 0~1 소수 기준 포인트)
//  - 'level'   : 그 자체가 수준을 나타내는 값 (0~1 또는 지수).

export type DriverKind = 'factor' | 'offset' | 'level';

export interface DriverSpec {
  /** 툴팁·보고서에 쓰는 한국어 이름 */
  readonly label: string;
  readonly kind: DriverKind;
  /** 수정자가 하나도 없을 때의 값 */
  readonly base: number;
  readonly min: number;
  readonly max: number;
  /** 단위 설명 (한국어, 툴팁 보조) */
  readonly unit: string;
}

const DRIVER_SPECS = {
  // ── 인구 ────────────────────────────────────────────────────────────────
  fertilityAdj: { label: '출산율 조정', kind: 'factor', base: 1, min: 0.2, max: 3, unit: '배' },
  mortalityAdj: { label: '사망률 조정', kind: 'factor', base: 1, min: 0.3, max: 3, unit: '배' },
  migrationPull: { label: '이민 유인', kind: 'offset', base: 0, min: -1, max: 1, unit: '지수' },
  brainDrainAdj: { label: '두뇌 유출 조정', kind: 'factor', base: 1, min: 0, max: 4, unit: '배' },

  // ── 교육·보건 ───────────────────────────────────────────────────────────
  enrollmentPrimaryAdj: { label: '초등 재학률 조정', kind: 'offset', base: 0, min: -0.5, max: 0.5, unit: '비율' },
  enrollmentSecondaryAdj: { label: '중등 재학률 조정', kind: 'offset', base: 0, min: -0.5, max: 0.5, unit: '비율' },
  enrollmentTertiaryAdj: { label: '고등 재학률 조정', kind: 'offset', base: 0, min: -0.5, max: 0.5, unit: '비율' },
  educationEfficiency: { label: '교육 효율', kind: 'factor', base: 1, min: 0.3, max: 2.5, unit: '배' },
  healthEfficiency: { label: '보건 효율', kind: 'factor', base: 1, min: 0.3, max: 2.5, unit: '배' },

  // ── 노동 ────────────────────────────────────────────────────────────────
  participationAdj: { label: '경제활동참가율 조정', kind: 'offset', base: 0, min: -0.25, max: 0.25, unit: '비율' },
  femaleParticipationAdj: { label: '여성 참가율 조정', kind: 'offset', base: 0, min: -0.3, max: 0.4, unit: '비율' },
  laborRigidity: { label: '노동시장 경직성', kind: 'level', base: 0.3, min: 0, max: 1, unit: '지수' },
  conscriptionRate: { label: '징병률', kind: 'level', base: 0, min: 0, max: 0.08, unit: '생산가능인구 대비' },

  // ── 생산 ────────────────────────────────────────────────────────────────
  savingsAdj: { label: '저축률 조정', kind: 'offset', base: 0, min: -0.2, max: 0.35, unit: '비율' },
  investmentClimate: { label: '투자 환경', kind: 'factor', base: 1, min: 0.3, max: 2, unit: '배' },
  fdiPull: { label: '외국인직접투자 유인', kind: 'factor', base: 1, min: 0, max: 4, unit: '배' },
  tfpGrowthAdj: { label: '생산성 증가율 조정', kind: 'offset', base: 0, min: -0.03, max: 0.03, unit: '연율' },
  absorptionAdj: { label: '기술 흡수력 조정', kind: 'factor', base: 1, min: 0.2, max: 2.5, unit: '배' },
  structuralChangeSpeed: { label: '구조 전환 속도', kind: 'factor', base: 1, min: 0.2, max: 3, unit: '배' },
  regulationBurden: { label: '규제 부담', kind: 'level', base: 0.35, min: 0, max: 1, unit: '지수' },
  informalityAdj: { label: '비공식경제 조정', kind: 'factor', base: 1, min: 0.3, max: 2, unit: '배' },
  infrastructureEfficiency: { label: '인프라 투자 효율', kind: 'factor', base: 1, min: 0.2, max: 2, unit: '배' },

  // ── 거시 ────────────────────────────────────────────────────────────────
  centralBankIndependence: { label: '중앙은행 독립성', kind: 'level', base: 0.2, min: 0, max: 1, unit: '지수' },
  inflationExpectationsAnchor: { label: '기대인플레 고정력', kind: 'level', base: 0.2, min: 0, max: 1, unit: '지수' },
  confidenceAdj: { label: '신뢰 조정', kind: 'offset', base: 0, min: -0.5, max: 0.5, unit: '지수' },

  // ── 재정 ────────────────────────────────────────────────────────────────
  taxCollectionEfficiency: { label: '징수 효율', kind: 'factor', base: 1, min: 0.2, max: 1.6, unit: '배' },
  spendingEfficiency: { label: '지출 효율', kind: 'factor', base: 1, min: 0.2, max: 1.6, unit: '배' },
  pensionGenerosity: { label: '연금 소득대체율', kind: 'level', base: 0.1, min: 0, max: 0.9, unit: '비율' },

  // ── 무역 ────────────────────────────────────────────────────────────────
  exportCompetitivenessAdj: { label: '수출 경쟁력 조정', kind: 'factor', base: 1, min: 0.3, max: 2.5, unit: '배' },
  tradeOpennessAdj: { label: '무역 개방도 조정', kind: 'factor', base: 1, min: 0.2, max: 2.5, unit: '배' },
  energyEfficiency: { label: '에너지 효율', kind: 'factor', base: 1, min: 0.4, max: 2.5, unit: '배' },
  agriProductivityAdj: { label: '농업 생산성 조정', kind: 'factor', base: 1, min: 0.4, max: 3, unit: '배' },

  // ── 사회 ────────────────────────────────────────────────────────────────
  inequalityAdj: { label: '불평등 조정', kind: 'offset', base: 0, min: -0.2, max: 0.2, unit: '지니' },
  crimeAdj: { label: '범죄 조정', kind: 'offset', base: 0, min: -40, max: 40, unit: '지수' },
  pollutionIntensityAdj: { label: '오염 집약도 조정', kind: 'factor', base: 1, min: 0.1, max: 3, unit: '배' },
  abatement: { label: '오염 저감률', kind: 'level', base: 0, min: 0, max: 0.9, unit: '비율' },

  // ── 제도 ────────────────────────────────────────────────────────────────
  corruptionDrift: { label: '부패 추세', kind: 'offset', base: 0, min: -6, max: 6, unit: '연간 포인트' },
  stateCapacityGrowth: { label: '국가역량 성장', kind: 'offset', base: 0, min: -4, max: 5, unit: '연간 포인트' },
  statisticsQuality: { label: '통계 품질', kind: 'level', base: 0.5, min: 0, max: 1, unit: '지수' },
  pressFreedom: { label: '언론 자유', kind: 'level', base: 0.5, min: 0, max: 1, unit: '지수' },

  // ── 정치 ────────────────────────────────────────────────────────────────
  repression: { label: '억압', kind: 'level', base: 0, min: 0, max: 1, unit: '지수' },
  propaganda: { label: '선전', kind: 'level', base: 0, min: 0, max: 1, unit: '지수' },
  politicalCapitalIncomeAdj: { label: '정치자본 수입 조정', kind: 'factor', base: 1, min: 0.2, max: 3, unit: '배' },
  legitimacyAdj: { label: '정당성 조정', kind: 'offset', base: 0, min: -30, max: 30, unit: '포인트' },
  coupRiskAdj: { label: '쿠데타 위험 조정', kind: 'factor', base: 1, min: 0, max: 4, unit: '배' },

  // ── 군사·외교 ───────────────────────────────────────────────────────────
  militaryEfficiency: { label: '군사 효율', kind: 'factor', base: 1, min: 0.3, max: 2.5, unit: '배' },
  diplomaticReputation: { label: '외교 평판 조정', kind: 'offset', base: 0, min: -50, max: 50, unit: '포인트' },
} as const satisfies Record<string, DriverSpec>;

export type DriverKey = keyof typeof DRIVER_SPECS;

export const DRIVERS: Readonly<Record<DriverKey, DriverSpec>> = DRIVER_SPECS;

export const DRIVER_KEYS = Object.keys(DRIVER_SPECS) as DriverKey[];

export function isDriverKey(key: string): key is DriverKey {
  return Object.prototype.hasOwnProperty.call(DRIVER_SPECS, key);
}

export function driverSpec(key: DriverKey): DriverSpec {
  return DRIVER_SPECS[key];
}

/** 동인별 허용 범위로 clamp (§4.4 집계식의 마지막 단계) */
export function clampDriver(key: DriverKey, value: number): number {
  const spec = DRIVER_SPECS[key];
  if (!Number.isFinite(value)) return spec.base;
  return Math.max(spec.min, Math.min(spec.max, value));
}
