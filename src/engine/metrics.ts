// 파생 지표 키 (PROMPT.md §5.4).
// 조건(Condition)과 UI가 참조하는 안정된 이름 목록이다. 값 계산은 각 시스템이 담당한다.
// M0에서는 이름만 확정하고, M1부터 실제 값을 채운다.

export const METRIC_KEYS = [
  // 인구
  'population', 'tfr', 'lifeExpectancy', 'infantMortality', 'medianAge',
  'dependencyRatio', 'urbanization', 'netMigration',
  // 노동
  'workingAgePopulation', 'participationRate', 'employment', 'unemployment',
  'agricultureEmploymentShare', 'industryEmploymentShare', 'serviceEmploymentShare',
  'realWage',
  // 경제
  'potentialGdp', 'gdp', 'gdpGrowth', 'gdpPerCapita', 'outputGap',
  'agricultureGdpShare', 'industryGdpShare', 'serviceGdpShare',
  'inflation', 'inflationExpectation', 'policyRate', 'savingsRate',
  'investmentRate', 'consumptionShare', 'gini', 'businessConfidence',
  'consumerConfidence', 'humanCapital', 'avgSchooling', 'tfpLevel',
  // 재정
  'revenue', 'spending', 'fiscalBalance', 'debtRatio', 'bondYield', 'creditRating',
  // 무역
  'exports', 'imports', 'currentAccount', 'realExchangeRate', 'reserveMonths',
  // 사회
  'literacy', 'healthQuality', 'crimeIndex', 'environmentQuality',
  'energySelfSufficiency', 'foodSelfSufficiency', 'pollution',
  // 제도
  'corruption', 'stateCapacity', 'ruleOfLaw', 'statisticsQuality',
  // 정치
  'legitimacy', 'stability', 'protestLevel', 'coupRisk', 'revolutionRisk',
  'democratizationPressure', 'parliamentSupport', 'approval', 'politicalCapital',
  'democraticConsolidation',
  // 군사·세계
  'militaryPower', 'powerRank', 'gdpRank', 'gdpPerCapitaRank',
  'frontierGdpPerCapitaRatio',
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export function isMetricKey(key: string): key is MetricKey {
  return (METRIC_KEYS as readonly string[]).includes(key);
}
