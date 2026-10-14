// Интеграция на публичном демо-датасете: весь учебный do-файл, текст вывода
// сверяется с эталоном statsmodels/scipy (tests/fixtures/demo.json) в форматах Stata.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import demo from './fixtures/demo.json';
import { Session } from '../src/lang/session';
import { SAMPLE_DO } from '../src/lang/sampleDo';
import { abbrev, fmtF, fmtG, padL } from '../src/stats/format';
import type { CommandResult } from '../src/lang/types';

let results: CommandResult[];
const text = (prefix: string) =>
  results.find((r) => r.echo.startsWith('. ' + prefix))!.blocks.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('\n');

beforeAll(async () => {
  const buf = readFileSync(new URL('../public/demo/housing_demo.xlsx', import.meta.url));
  const s = new Session(async () => ({ name: 'housing_demo.xlsx', data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) }));
  expect((await s.run('import excel "housing_demo.xlsx", firstrow clear')).ok).toBe(true);
  results = await s.runProgram(SAMPLE_DO);
});

it('do-file runs without errors and draws 4 graphs', () => {
  expect(results.filter((r) => !r.ok).map((r) => r.echo)).toEqual([]);
  expect(results.flatMap((r) => r.blocks.filter((b) => b.type === 'graph')).length).toBe(4);
});

it('regress header and every coefficient row', () => {
  const o = text('reg ').split('\n');
  const d = demo.ols;
  expect(o[1]).toContain(`F(16, 31)       =${padL(fmtF(d.F, 2), 10)}`);
  expect(o[4]).toContain(`Adj R-squared   =${padL(fmtF(d.adjr2, 4), 10)}`);
  const names = [...demo.names, '_cons'];
  names.forEach((n, i) => {
    const row = padL(abbrev(n), 12) + ' |' + padL(fmtG(d.b[i]), 11) + padL(fmtG(d.se[i]), 11) + padL(fmtF(d.t[i], 2), 9) + padL(fmtF(d.p[i], 3), 8) + padL(fmtG(d.ci[i][0]), 13) + padL(fmtG(d.ci[i][1]), 12);
    expect(o).toContain(row);
  });
});

it('post-estimation tests', () => {
  expect(text('ovtest')).toContain(`F(3, 28) = ${fmtF(demo.ovtest.F, 2).padStart(9)}`);
  expect(text('vif')).toContain(`Mean VIF |${padL(fmtF(demo.vif.mean, 2), 10)}`);
  expect(text('estat hettest')).toContain(`chi2(1)      = ${fmtF(demo.hettest.chi2, 2).padStart(8)}`);
  const im = demo.imtest;
  expect(text('estat imtest')).toContain(`            Skewness |${padL(fmtF(im.skew.chi2, 2), 11)}     16${padL(fmtF(im.skew.p, 4), 10)}`);
  expect(text('estat imtest')).toContain(`  Heteroskedasticity |      48.00     47    0.4321`);
  expect(text('swilk')).toContain(fmtF(demo.swilk_W, 5));
});

it('explanations: P2 violated on demo (VIF > 10)', () => {
  const v = results.find((r) => r.echo === '. vif')!;
  expect(v.explain?.verdict).toBe('bad');
  expect(v.explain?.text.join(' ')).toMatch(/Housing_stock/);
});
