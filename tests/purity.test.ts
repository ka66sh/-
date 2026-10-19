// 소스 규칙 검사 — 엔진 순수성(§4.2)과 코딩 규칙(§3)을 테스트로 강제한다.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function listFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) listFiles(full, out);
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

const engineFiles = listFiles(join(ROOT, 'src/engine'));
const srcFiles = listFiles(join(ROOT, 'src'));
const dataFiles = listFiles(join(ROOT, 'src/data'));

/** 주석을 지운 코드 (금지 패턴 검사는 코드에만 적용한다) */
function codeOnly(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** 주석과 문자열 리터럴까지 지운 코드. 한국어 메시지가 패턴에 걸리지 않게 한다. */
function codeNoStrings(text: string): string {
  return codeOnly(text)
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""');
}

describe('엔진 순수성 (§4.2)', () => {
  const forbidden: ReadonlyArray<readonly [RegExp, string]> = [
    [/\bMath\.random\b/, 'Math.random()'],
    [/\bDate\.now\b/, 'Date.now()'],
    [/\bnew Date\b/, 'new Date()'],
    [/\bwindow\b/, 'window'],
    [/\bdocument\b/, 'document'],
    [/\blocalStorage\b/, 'localStorage'],
    [/\bsessionStorage\b/, 'sessionStorage'],
    [/\brequestAnimationFrame\b/, 'requestAnimationFrame'],
    [/\bperformance\.now\b/, 'performance.now()'],
    [/\bsetTimeout\b/, 'setTimeout'],
    [/\bsetInterval\b/, 'setInterval'],
    [/\bfetch\s*\(/, 'fetch()'],
  ];

  it('엔진 파일이 하나 이상 있다', () => {
    expect(engineFiles.length).toBeGreaterThan(10);
  });

  it('엔진은 DOM·브라우저 API·실시간 시계·전역 난수에 접근하지 않는다', () => {
    const violations: string[] = [];
    for (const file of engineFiles) {
      const code = codeOnly(readFileSync(file, 'utf8'));
      for (const [pattern, name] of forbidden) {
        if (pattern.test(code)) violations.push(`${relative(ROOT, file)}: ${name}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('엔진은 ui·game 계층을 import하지 않는다', () => {
    const violations: string[] = [];
    for (const file of engineFiles) {
      const code = readFileSync(file, 'utf8');
      const imports = code.match(/from\s+'([^']+)'/g) ?? [];
      for (const line of imports) {
        if (/\.\.\/(ui|game)\//.test(line) || /\.\.\/\.\.\/(ui|game)\//.test(line)) {
          violations.push(`${relative(ROOT, file)}: ${line}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('데이터 계층은 엔진 타입만 참조한다 (UI·game import 금지)', () => {
    const violations: string[] = [];
    for (const file of dataFiles) {
      const code = readFileSync(file, 'utf8');
      if (/from\s+'\.\.\/(ui|game)\//.test(code)) violations.push(relative(ROOT, file));
    }
    expect(violations).toEqual([]);
  });
});

describe('코딩 규칙 (§3)', () => {
  it('any 타입을 쓰지 않는다', () => {
    const patterns = [/:\s*any\b/, /\bas\s+any\b/, /<any>/, /\bany\[\]/, /Array<any>/];
    const violations: string[] = [];
    for (const file of srcFiles) {
      const code = codeNoStrings(readFileSync(file, 'utf8'));
      if (patterns.some((p) => p.test(code))) violations.push(relative(ROOT, file));
    }
    expect(violations).toEqual([]);
  });

  it('단일 파일 빌드 호환을 위해 동적 import와 Web Worker를 쓰지 않는다', () => {
    const violations: string[] = [];
    for (const file of srcFiles) {
      const code = codeOnly(readFileSync(file, 'utf8'));
      if (/\bimport\s*\(/.test(code) || /\bnew\s+Worker\b/.test(code)) {
        violations.push(relative(ROOT, file));
      }
    }
    expect(violations).toEqual([]);
  });

  it('엔진에는 문자열 eval이 없다 (§7.1)', () => {
    for (const file of srcFiles) {
      const code = codeOnly(readFileSync(file, 'utf8'));
      expect(code).not.toMatch(/\beval\s*\(/);
      expect(code).not.toMatch(/new\s+Function\s*\(/);
    }
  });
});

describe('기준 문서 (§0)', () => {
  it('PROMPT.md는 프로젝트 루트에 그대로 있다', () => {
    const text = readFileSync(join(ROOT, 'PROMPT.md'), 'utf8');
    expect(text).toContain('나라 키우기');
    expect(text.length).toBeGreaterThan(10_000);
  });

  it('규칙 요약 문서들이 있다', () => {
    for (const name of ['CLAUDE.md', 'PROGRESS.md', 'DECISIONS.md']) {
      expect(readFileSync(join(ROOT, name), 'utf8').length).toBeGreaterThan(100);
    }
  });
});
