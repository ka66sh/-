// 시대 (PROMPT.md §8.5). 시간이 아니라 지표로 판정한다.

export const ERA_IDS = ['founding', 'industrialization', 'highGrowth', 'greatPower'] as const;
export type EraId = (typeof ERA_IDS)[number];

export const ERA_LABELS: Readonly<Record<EraId, string>> = {
  founding: '건국기',
  industrialization: '산업화',
  highGrowth: '고도성장',
  greatPower: '강대국',
};

/** 시대의 진행 순서. 조건 'era atLeast' 비교에 쓴다. */
export function eraOrder(era: EraId): number {
  return ERA_IDS.indexOf(era);
}
