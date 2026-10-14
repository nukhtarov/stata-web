import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Session } from '../src/lang/session';
import { splitProgram } from '../src/lang/tokenizer';
import { strtoname } from '../src/data/dataset';

const buf = readFileSync(new URL('../public/demo/housing_demo.xlsx', import.meta.url));
const file = { name: 'housing_demo.xlsx', data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
async function loaded() {
  const s = new Session(async () => file);
  await s.run('import excel "housing_demo.xlsx", firstrow clear');
  return s;
}
const err = (r: { blocks: { type: string }[] }) => r.blocks.find((b) => b.type === 'error') as { text: string; code: number; hint?: string } | undefined;

describe('errors as in Stata', () => {
  it('r(111) variable not found + hint', async () => {
    const s = await loaded();
    const e = err(await s.run('reg Price gini'))!;
    expect(e.text).toBe('variable gini not found');
    expect(e.code).toBe(111);
    expect(e.hint).toMatch(/Gini/);
  });
  it('r(199) unrecognized', async () => {
    const s = await loaded();
    expect(err(await s.run('regresion Price Gini'))).toMatchObject({ text: 'command regresion is unrecognized', code: 199 });
  });
  it('r(110) already defined', async () => {
    const s = await loaded();
    expect(err(await s.run('gen Price = 1'))).toMatchObject({ text: 'variable Price already defined', code: 110 });
  });
  it('r(4) data in memory', async () => {
    const s = await loaded();
    expect(err(await s.run('import excel "x.xlsx", firstrow'))).toMatchObject({ text: 'no; data in memory would be lost', code: 4 });
  });
  it('r(301) last estimates not found', async () => {
    const s = await loaded();
    expect(err(await s.run('ovtest'))).toMatchObject({ code: 301 });
    expect(err(await s.run('estat hettest'))).toMatchObject({ text: 'last estimates not found', code: 301 });
  });
  it('r(2000) no observations', async () => {
    const s = await loaded();
    await s.run('gen z = .');
    expect(err(await s.run('reg Price z'))).toMatchObject({ text: 'no observations', code: 2000 });
  });
  it('capture suppresses errors', async () => {
    const s = await loaded();
    const r = await s.run('capture drop nonexistent');
    expect(r.ok).toBe(true);
    expect(r.blocks).toEqual([]);
  });
  it('do-file stops on error', async () => {
    const s = await loaded();
    const r = await s.runProgram('sum Price\nfoo\nsum Gini');
    expect(r.length).toBe(2);
  });
});

describe('syntax', () => {
  it('abbreviations of commands', async () => {
    const s = await loaded();
    for (const c of ['su Price', 'summ Price', 'regr Price Gini', 'd Price', 'cor Price Gini', 'g x = 1', 'l Price in 1/2'])
      expect((await s.run(c)).ok, c).toBe(true);
  });
  it('variable abbreviations and wildcards', async () => {
    const s = await loaded();
    const r = await s.run('sum Pri Gin*');
    expect(r.ok).toBe(true);
    expect(err(await s.run('sum G'))).toMatchObject({ code: 111, text: 'G ambiguous abbreviation' });
  });
  it('leading ". " and comments', async () => {
    expect(splitProgram('. sum Price // comment\n* full comment\nreg Price /// \n  Gini\n/* block\n */ des')).toEqual([
      { line: 1, text: 'sum Price' },
      { line: 3, text: 'reg Price Gini' },
      { line: 6, text: 'des' },
    ]);
  });
  it('generate: missing propagates, ln of non-positive', async () => {
    const s = await loaded();
    const r = await s.run('gen lnD = ln(DMIR)');
    expect(r.blocks[0]).toMatchObject({ type: 'text' });
    expect((r.blocks[0] as { text: string }).text).toMatch(/^\(\d+ missing values generated\)$/);
    await s.run('gen p2 = (Price/1000)^2 + 2*-1');
    const v = s.ds.num('p2');
    expect(v[0]).toBeCloseTo((s.ds.num('Price')[0] / 1000) ** 2 - 2, 4);
  });
  it('predict default xb', async () => {
    const s = await loaded();
    await s.run('reg Price Gini');
    const r = await s.run('predict yhat');
    expect((r.blocks[0] as { text: string }).text).toBe('(option xb assumed; fitted values)');
  });
  it('collinearity note', async () => {
    const s = await loaded();
    await s.run('gen double G2 = Gini*2');
    const r = await s.run('reg Price Gini G2');
    const t = (r.blocks[0] as { text: string }).text;
    expect(t).toMatch(/^note: G2 omitted because of collinearity/);
    expect(t).toContain('          G2 |          0  (omitted)');
  });
  it('linktest keeps original estimates', async () => {
    const s = await loaded();
    await s.run('reg Price Gini HOR');
    await s.run('linktest');
    expect(s.est!.m.coefs.map((c) => c.name)).toEqual(['Gini', 'HOR', '_cons']);
  });
  it('strtoname', () => {
    expect(strtoname('Euro area')).toBe('Euro_area');
    expect(strtoname('10y yield')).toBe('_10y_yield');
    expect(strtoname('a'.repeat(40)).length).toBe(32);
  });
});
