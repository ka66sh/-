// 헤드리스 밸런스 시뮬레이터 (PROMPT.md §12.2)
//   npm run sim -- --strategy passive --seed 42 --years 100
//
// M0 버전: 전략 봇의 뼈대, 성능 측정, 자동 일시정지 횟수 집계까지. 연도별 지표 표는
// 계산할 지표가 생기는 M1부터 채운다.

import { writeFileSync } from 'node:fs';
import type { GameState } from '../src/engine/state';
import { createInitialState } from '../src/engine/state';
import type { Command } from '../src/engine/commands';
import { submitCommand } from '../src/engine/commands';
import { simulateMonth } from '../src/engine/tick';
import { DEFAULT_SCENARIO_ID } from '../src/data/scenarios';

export interface Strategy {
  id: string;
  label: string;
  /** 매달 플레이어 대신 명령을 낸다. 일시정지 없이 즉시 적용된다고 본다. */
  onMonth?(state: GameState, submit: (command: Command) => void): void;
}

const STRATEGIES: readonly Strategy[] = [
  { id: 'passive', label: '아무것도 바꾸지 않음' },
  // M1: balanced / M2: autocrat / M4: populist, planned
];

interface Options {
  strategy: string;
  seed: number;
  years: number;
  scenario: string;
  csv: string | null;
}

function parseArgs(argv: readonly string[]): Options {
  const options: Options = {
    strategy: 'passive',
    seed: 42,
    years: 100,
    scenario: DEFAULT_SCENARIO_ID,
    csv: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case '--strategy':
        if (next) options.strategy = next;
        i += 1;
        break;
      case '--seed':
        if (next) options.seed = Number(next);
        i += 1;
        break;
      case '--years':
        if (next) options.years = Number(next);
        i += 1;
        break;
      case '--scenario':
        if (next) options.scenario = next;
        i += 1;
        break;
      case '--csv':
        if (next) options.csv = next;
        i += 1;
        break;
      default:
        break;
    }
  }
  return options;
}

export interface YearRow {
  year: number;
  autoPauses: number;
}

export interface SimResult {
  strategy: string;
  seed: number;
  years: number;
  months: number;
  finalYear: number;
  finalMonth: number;
  autoPauses: number;
  avgMonthMs: number;
  maxMonthMs: number;
  rows: YearRow[];
}

export function runSimulation(options: Options): SimResult {
  const strategy = STRATEGIES.find((s) => s.id === options.strategy);
  if (!strategy) {
    throw new Error(
      `알 수 없는 전략: ${options.strategy} (사용 가능: ${STRATEGIES.map((s) => s.id).join(', ')})`,
    );
  }

  const state = createInitialState({ seed: options.seed, scenarioId: options.scenario });
  const months = Math.round(options.years * 12);
  const rows: YearRow[] = [];

  let totalMs = 0;
  let maxMs = 0;
  let autoPauses = 0;
  let yearPauses = 0;

  for (let i = 0; i < months; i += 1) {
    strategy.onMonth?.(state, (command) => {
      submitCommand(state, command, { paused: true });
    });

    const started = performance.now();
    const outcome = simulateMonth(state);
    const elapsed = performance.now() - started;

    totalMs += elapsed;
    if (elapsed > maxMs) maxMs = elapsed;
    autoPauses += outcome.pauseRequests.length;
    yearPauses += outcome.pauseRequests.length;

    if (state.date.month === 1) {
      rows.push({ year: state.date.year - 1, autoPauses: yearPauses });
      yearPauses = 0;
    }
  }

  return {
    strategy: strategy.id,
    seed: options.seed,
    years: options.years,
    months,
    finalYear: state.date.year,
    finalMonth: state.date.month,
    autoPauses,
    avgMonthMs: months > 0 ? totalMs / months : 0,
    maxMonthMs: maxMs,
    rows,
  };
}

function report(result: SimResult): void {
  const lines = [
    '',
    `전략: ${result.strategy} / 시드: ${result.seed} / 기간: ${result.years}년 (${result.months}개월)`,
    `종료 시점: ${result.finalYear}년 ${result.finalMonth}월`,
    `자동 일시정지: ${result.autoPauses}회 (목표 40~80회, §8.1)`,
    `simulateMonth 평균 ${result.avgMonthMs.toFixed(3)}ms / 최대 ${result.maxMonthMs.toFixed(3)}ms (목표 평균 3ms 이하, §4.6)`,
    '',
  ];
  process.stdout.write(lines.join('\n'));

  const budgetOk = result.avgMonthMs <= 3;
  process.stdout.write(
    budgetOk ? '성능 예산 충족.\n' : '성능 예산 초과 — 계수·구조를 점검하라.\n',
  );
}

function toCsv(result: SimResult): string {
  const header = 'year,autoPauses';
  const body = result.rows.map((row) => `${row.year},${row.autoPauses}`);
  return [header, ...body].join('\n');
}

const options = parseArgs(process.argv.slice(2));
const result = runSimulation(options);
report(result);
if (options.csv) {
  writeFileSync(options.csv, toCsv(result), 'utf8');
  process.stdout.write(`CSV 저장: ${options.csv}\n`);
}
