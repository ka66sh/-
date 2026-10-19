// 시작 시나리오 (PROMPT.md §9). 초기 수치의 근거는 DECISIONS.md에 기록한다.
// M1: 농업 빈국 / M4: 자원 부국 / M5: 나머지 + 커스텀.

import type { Regime } from '../engine/politics/regime';

export interface ScenarioDef {
  id: string;
  name: string;
  description: string;
  /** 시작 총인구 (명) */
  startPopulation: number;
  /** 1인당 GDP (기준 달러, 불변가격) */
  gdpPerCapita: number;
  /** 성인 평균 교육연수 */
  avgSchooling: number;
  lifeExpectancy: number;
  /** 합계출산율 */
  tfr: number;
  urbanization: number;
  /** 고용 비중 — 합이 1이어야 한다 */
  employmentShares: { agriculture: number; industry: number; service: number };
  /** 자원 부존 (0~1) */
  resourceWealth: number;
  /** 해안국이면 true (내륙은 무역 비용 증가) */
  coastal: boolean;
  startRegime: Regime;
}

export const SCENARIOS: readonly ScenarioDef[] = [
  {
    id: 'agrarian',
    name: '농업 빈국',
    description:
      '독립 직후의 가난한 농업국이다. 인구는 많지만 글을 읽는 사람이 드물고, 포장도로와 전기는 수도 일부에만 있다.',
    startPopulation: 25_000_000,
    gdpPerCapita: 420,
    avgSchooling: 1.2,
    lifeExpectancy: 45,
    tfr: 6.2,
    urbanization: 0.18,
    employmentShares: { agriculture: 0.7, industry: 0.1, service: 0.2 },
    resourceWealth: 0.25,
    coastal: true,
    startRegime: {
      power: 'election',
      checks: 'weak',
      press: 'censored',
      economy: 'mixed',
      rights: 'restricted',
    },
  },
];

export const DEFAULT_SCENARIO_ID = 'agrarian';

export function findScenario(id: string): ScenarioDef | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

export function requireScenario(id: string): ScenarioDef {
  const found = findScenario(id);
  if (!found) throw new Error(`알 수 없는 시나리오: ${id}`);
  return found;
}
