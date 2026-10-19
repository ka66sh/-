// 체제 5개 축 (PROMPT.md §6.9). 4×3×3×3×3 = 324가지.
// 각 선택지의 효과는 src/data/regimeOptions.ts 의 ModifierSource로 정의한다 (M2).
// 이 파일은 축·선택지의 타입과 한국어 이름만 담는다.

export const REGIME_AXES = ['power', 'checks', 'press', 'economy', 'rights'] as const;
export type RegimeAxis = (typeof REGIME_AXES)[number];

export const REGIME_AXIS_OPTIONS = {
  power: ['election', 'hereditary', 'party', 'military'],
  checks: ['strong', 'weak', 'none'],
  press: ['free', 'censored', 'state'],
  economy: ['market', 'mixed', 'planned'],
  rights: ['protected', 'restricted', 'repressed'],
} as const;

export type PowerOption = (typeof REGIME_AXIS_OPTIONS.power)[number];
export type ChecksOption = (typeof REGIME_AXIS_OPTIONS.checks)[number];
export type PressOption = (typeof REGIME_AXIS_OPTIONS.press)[number];
export type EconomyOption = (typeof REGIME_AXIS_OPTIONS.economy)[number];
export type RightsOption = (typeof REGIME_AXIS_OPTIONS.rights)[number];

export type RegimeOption = PowerOption | ChecksOption | PressOption | EconomyOption | RightsOption;

export interface Regime {
  power: PowerOption;
  checks: ChecksOption;
  press: PressOption;
  economy: EconomyOption;
  rights: RightsOption;
}

export const REGIME_AXIS_LABELS: Readonly<Record<RegimeAxis, string>> = {
  power: '권력 획득',
  checks: '권력 견제',
  press: '언론',
  economy: '경제',
  rights: '시민 권리',
};

export const REGIME_OPTION_LABELS: Readonly<Record<RegimeAxis, Readonly<Record<string, string>>>> = {
  power: { election: '선거', hereditary: '세습', party: '당 지명', military: '군부' },
  checks: { strong: '강함', weak: '약함', none: '없음' },
  press: { free: '자유', censored: '검열', state: '국영' },
  economy: { market: '시장', mixed: '혼합', planned: '계획' },
  rights: { protected: '보장', restricted: '제한', repressed: '억압' },
};

/** 선택지의 한국어 이름 */
export function regimeOptionLabel(axis: RegimeAxis, option: string): string {
  return REGIME_OPTION_LABELS[axis][option] ?? option;
}

/** 축에 유효한 선택지인지 검사 */
export function isValidRegimeOption(axis: RegimeAxis, option: string): boolean {
  return (REGIME_AXIS_OPTIONS[axis] as readonly string[]).includes(option);
}

/** 체제 조합의 총 개수 (324) */
export function regimeCombinationCount(): number {
  return REGIME_AXES.reduce((acc, axis) => acc * REGIME_AXIS_OPTIONS[axis].length, 1);
}

/** 324가지 조합 전부를 열거한다 (테스트·밸런스 점검용) */
export function enumerateRegimes(): Regime[] {
  const out: Regime[] = [];
  for (const power of REGIME_AXIS_OPTIONS.power) {
    for (const checks of REGIME_AXIS_OPTIONS.checks) {
      for (const press of REGIME_AXIS_OPTIONS.press) {
        for (const economy of REGIME_AXIS_OPTIONS.economy) {
          for (const rights of REGIME_AXIS_OPTIONS.rights) {
            out.push({ power, checks, press, economy, rights });
          }
        }
      }
    }
  }
  return out;
}

/** 안정적인 조합 키 (로그·테스트용) */
export function regimeKey(regime: Regime): string {
  return REGIME_AXES.map((axis) => `${axis}=${regime[axis]}`).join(',');
}
