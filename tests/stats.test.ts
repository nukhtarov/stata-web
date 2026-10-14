import { describe, expect, it } from 'vitest';
import dist from './fixtures/distributions.json';
import syn from './fixtures/synthetic.json';
import demo from './fixtures/demo.json';
import { existsSync, readFileSync } from 'node:fs';
import * as D from '../src/stats/distributions';
import { ols } from '../src/stats/ols';
import { linktest, ovtest, vif, hettest, imtest, swilk } from '../src/stats/tests';
import { summarizeDetail } from '../src/stats/summary';
import { kdensityBandwidth } from '../src/stats/smooth';

const rel = (a: number, b: number, tol = 1e-8) => {
  const d = Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);
  if (!(d <= tol || Math.abs(a - b) < 1e-300)) throw new Error(`${a} vs ${b} (rel ${d})`);
};
const close = (a: number, b: number, tol = 1e-8) => {
  // относительная точность, для чисел около нуля — абсолютная
  const d = Math.abs(a - b) / Math.max(Math.abs(b), 1);
  if (!(d <= tol)) throw new Error(`${a} vs ${b} (diff ${d})`);
};

describe('distributions vs scipy', () => {
  it('normal', () => dist.normal.forEach((r) => { rel(D.normal(r.x), r.cdf, 1e-12); rel(D.normal(-r.x), r.sf, 1e-12); }));
  it('invnormal', () => dist.invnormal.forEach((r) => rel(D.invnormal(r.p), r.x, 1e-12)));
  it('t', () => dist.t.forEach((r) => { rel(D.tcdf(r.x, r.df), r.cdf, 1e-11); rel(D.ttail(r.x, r.df), r.sf, 1e-11); }));
  it('invt', () => dist.invt.forEach((r) => close(D.invt(r.p, r.df), r.x, 1e-10)));
  it('F', () => dist.F.forEach((r) => { rel(D.Ftail(r.x, r.d1, r.d2), r.sf, 1e-10); rel(D.Fcdf(r.x, r.d1, r.d2), r.cdf, 1e-10); }));
  it('chi2', () => dist.chi2.forEach((r) => { rel(D.chi2tail(r.x, r.df), r.sf, 1e-10); rel(D.chi2cdf(r.x, r.df), r.cdf, 1e-10); }));
});

type Ols = { b: number[]; se: number[]; t: number[]; p: number[]; ci: number[][]; rss: number; mss: number; r2: number; adjr2: number; F: number; pF: number; rmse: number };
function checkOls(m: ReturnType<typeof ols>, r: Ols, tol = 1e-8) {
  const live = m.coefs.filter((c) => !c.omitted);
  live.forEach((c, i) => {
    close(c.b, r.b[i], tol); rel(c.se, r.se[i], tol); close(c.t, r.t[i], tol); close(c.p, r.p[i], tol);
    close(c.lo, r.ci[i][0], tol); close(c.hi, r.ci[i][1], tol);
  });
  rel(m.rss, r.rss, tol); rel(m.mss, r.mss, tol); rel(m.r2, r.r2, tol); rel(m.F, r.F, tol); rel(m.rmse, r.rmse, tol);
  close(m.pF, r.pF, 1e-10);
}

type Ds = (typeof syn.datasets)[number];
function runAll(d: { y: number[]; X: number[][]; names: string[] } & Record<string, any>) {
  const m = ols(d.y, d.X, d.names, 'y');
  checkOls(m, d.ols);
  checkOls(linktest(m), d.linktest, 1e-7);
  const ov = ovtest(m);
  rel(ov.F, d.ovtest.F, 1e-7); expect(ov.df2).toBe(d.ovtest.df2);
  const v = vif(m);
  v.rows.forEach((r, i) => { expect(r.name).toBe(d.vif.rows[i].name); rel(r.vif, d.vif.rows[i].vif, 1e-8); });
  const h = hettest(m);
  rel(h.chi2, d.hettest.chi2, 1e-8);
  const im = imtest(m);
  expect(im.het.df).toBe(d.imtest.het.df);
  close(im.het.chi2, d.imtest.het.chi2, 1e-7);
  close(im.skew.chi2, d.imtest.skew.chi2, 1e-8);
  close(im.kurt.chi2, d.imtest.kurt.chi2, 1e-8);
  const sd = summarizeDetail(m.resid);
  rel(sd.skewness, d.sum_resid.skewness, 1e-7); rel(sd.kurtosis, d.sum_resid.kurtosis, 1e-8);
  Object.entries(d.sum_resid.pctiles).forEach(([p, val]) => close(sd.pctiles[+p], val as number, 1e-8));
  rel(kdensityBandwidth(m.resid), d.kdensity_bw, 1e-8);
  if (m.N >= 4) rel(swilk(m.resid).W, d.swilk_W, 2e-6); // scipy считает W во float32
  return m;
}

describe('synthetic datasets vs statsmodels', () => {
  for (const d of syn.datasets as Ds[]) it(d.name, () => runAll(d));
  it('collinearity: omitted column, same fit', () => {
    const d = syn.datasets.find((x) => x.name === 'collinear')!;
    const m = ols(d.y, [...d.X, (d as any).collinear_extra], [...d.names, 'c'], 'y');
    expect(m.omitted).toEqual(['c']);
    expect(m.coefs[2]).toMatchObject({ name: 'c', omitted: true, b: 0 });
    checkOls(m, d.ols);
  });
  it('dummy squared is dropped in imtest', () => {
    const d = syn.datasets.find((x) => x.name === 'dummy')!;
    expect(imtest(ols(d.y, d.X, d.names)).het.df).toBe(d.imtest.het.df);
  });
});

describe('shapiro W vs scipy', () => {
  for (const s of syn.shapiro) if (s.x.length >= 4) it(`n=${s.x.length}`, () => rel(swilk(s.x).W, s.W, 2e-6));
});

describe('demo dataset (public/demo) vs statsmodels', () => {
  it('all tests', () => { runAll(demo as any); });
});

// курсовой датасет лежит только локально (tests/fixtures/private, в git его нет)
const REF = new URL('./fixtures/private/reference.json', import.meta.url);
describe.skipIf(!existsSync(REF))('course dataset (private) vs statsmodels', () => {
  it('all tests', () => { runAll(JSON.parse(readFileSync(REF, 'utf8'))); });
});
