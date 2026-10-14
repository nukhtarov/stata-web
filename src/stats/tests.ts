// Пост-оценочные тесты: linktest, ovtest, vif, swilk, hettest, imtest.
import { ols, type OLSResult } from './ols';
import { qrSolve, mean, sumSq } from './linalg';
import { chi2tail, Ftail, invnormal, normal } from './distributions';

// ---------------------------------------------------------------- linktest
export function linktest(m: OLSResult): OLSResult {
  const hat = m.fitted;
  const hatsq = hat.map((v) => v * v);
  return ols(m.y, [hat, hatsq], ['_hat', '_hatsq'], m.depvar);
}

// ---------------------------------------------------------------- ovtest
export interface OvtestResult {
  F: number;
  df1: number;
  df2: number;
  p: number;
  depvar: string;
}

export function ovtest(m: OLSResult): OvtestResult {
  const yh = m.fitted;
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of yh) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const z = yh.map((v) => (v - lo) / (hi - lo));
  const z2 = z.map((v) => v * v);
  const z3 = z.map((v) => v * v * v);
  const z4 = z.map((v) => v * v * v * v);
  const long = ols(m.y, [...m.usedX, z2, z3, z4], [...m.usedNames, 'z2', 'z3', 'z4'], m.depvar);
  const df1 = long.k - m.k;
  const df2 = long.dfr;
  const F = (m.rss - long.rss) / df1 / (long.rss / df2);
  return { F, df1, df2, p: Ftail(F, df1, df2), depvar: m.depvar };
}

// ---------------------------------------------------------------- vif
export interface VifRow {
  name: string;
  vif: number;
}

export function vif(m: OLSResult): { rows: VifRow[]; mean: number } {
  const rows = m.usedNames.map((name, j) => {
    const others = m.usedX.filter((_, i) => i !== j);
    const r = ols(m.usedX[j], others, m.usedNames.filter((_, i) => i !== j), name);
    return { name, vif: 1 / (1 - r.r2) };
  });
  // Stata: сортировка по убыванию VIF (при равенстве — исходный порядок)
  rows.sort((a, b) => b.vif - a.vif);
  return { rows, mean: rows.reduce((s, r) => s + r.vif, 0) / rows.length };
}

// ---------------------------------------------------------------- swilk
const poly = (c: number[], x: number) => {
  let r = c[c.length - 1];
  for (let i = c.length - 2; i >= 0; i--) r = r * x + c[i];
  return r;
};

/** Коэффициенты a_i (i = 1..n/2) по AS R94 */
export function swilkCoefs(n: number): number[] {
  const n2 = Math.floor(n / 2);
  if (n === 3) return [Math.SQRT1_2];
  const c1 = [0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056];
  const c2 = [0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633];
  const an25 = n + 0.25;
  const m: number[] = [];
  let summ2 = 0;
  for (let i = 1; i <= n2; i++) {
    const v = invnormal((i - 0.375) / an25);
    m.push(v);
    summ2 += v * v;
  }
  summ2 *= 2;
  const ssumm2 = Math.sqrt(summ2);
  const rsn = 1 / Math.sqrt(n);
  const a1 = poly(c1, rsn) - m[0] / ssumm2;
  const a = new Array(n2).fill(0);
  let i1: number;
  let fac: number;
  if (n > 5) {
    i1 = 3;
    const a2 = -m[1] / ssumm2 + poly(c2, rsn);
    fac = Math.sqrt((summ2 - 2 * m[0] ** 2 - 2 * m[1] ** 2) / (1 - 2 * a1 ** 2 - 2 * a2 ** 2));
    a[1] = a2;
  } else {
    i1 = 2;
    fac = Math.sqrt((summ2 - 2 * m[0] ** 2) / (1 - 2 * a1 ** 2));
  }
  a[0] = a1;
  for (let i = i1; i <= n2; i++) a[i - 1] = -m[i - 1] / fac;
  return a;
}

export interface SwilkResult {
  name: string;
  N: number;
  W: number;
  V: number;
  z: number;
  p: number;
}

export function swilk(x: number[], name = 'x'): SwilkResult {
  const n = x.length;
  const s = [...x].sort((p, q) => p - q);
  const a = swilkCoefs(n);
  let num = 0;
  for (let i = 0; i < a.length; i++) num += a[i] * (s[n - 1 - i] - s[i]);
  const ssq = sumSq(s, mean(s));
  let W = (num * num) / ssq;
  if (W > 1) W = 1;
  let z: number;
  let V: number;
  let p: number;
  if (n === 3) {
    p = Math.max(0, (6 / Math.PI) * (Math.asin(Math.sqrt(W)) - Math.asin(Math.sqrt(0.75))));
    z = -invnormal(p);
    V = NaN;
  } else if (n <= 11) {
    const gamma = 0.459 * n - 2.273;
    const mu = poly([0.544, -0.39978, 0.025054, -6.714e-4], n);
    const sigma = Math.exp(poly([1.3822, -0.77857, 0.062767, -0.0020322], n));
    const w1 = Math.log(1 - W);
    z = (-Math.log(gamma - w1) - mu) / sigma;
    // медиана 1−W: z = 0 ⇒ ln(1−W) = γ − e^(−μ)
    V = (1 - W) / Math.exp(gamma - Math.exp(-mu));
    p = 1 - normal(z);
  } else {
    const ln = Math.log(n);
    const mu = poly([-1.5861, -0.31082, -0.083751, 0.0038915], ln);
    const sigma = Math.exp(poly([-0.4803, -0.082676, 0.0030302], ln));
    z = (Math.log(1 - W) - mu) / sigma;
    V = (1 - W) / Math.exp(mu);
    p = 1 - normal(z);
  }
  return { name, N: n, W, V, z, p };
}

// ---------------------------------------------------------------- hettest
export interface HettestResult {
  chi2: number;
  df: number;
  p: number;
  depvar: string;
}

export function hettest(m: OLSResult): HettestResult {
  const s2 = m.rss / m.N;
  const g = m.resid.map((e) => (e * e) / s2);
  const aux = ols(g, [m.fitted], ['yhat'], 'g');
  const chi2 = aux.mss / 2;
  return { chi2, df: 1, p: chi2tail(chi2, 1), depvar: m.depvar };
}

// ---------------------------------------------------------------- imtest
export interface ChiRow {
  chi2: number;
  df: number;
  p: number;
}

export interface ImtestResult {
  het: ChiRow;
  skew: ChiRow;
  kurt: ChiRow;
  total: ChiRow;
  N: number;
  /** вспомогательная регрессия насыщена (df ≥ N−1) */
  saturated: boolean;
}

/** Нецентрированный R² регрессии dep на [X, 1] */
function uncenteredR2(dep: number[], X: number[][]): number {
  const ones = new Array(dep.length).fill(1);
  const r = qrSolve([ones, ...X], dep);
  return 1 - r.rss / dep.reduce((s, v) => s + v * v, 0);
}

export function imtest(m: OLSResult): ImtestResult {
  const N = m.N;
  const X = m.usedX;
  const p = X.length;
  const e = m.resid;
  // элементы xx': регрессоры, квадраты и попарные произведения
  const cols: number[][] = [...X];
  for (let i = 0; i < p; i++) for (let j = i; j < p; j++) cols.push(X[i].map((v, t) => v * X[j][t]));
  // нормировка: центрируем и масштабируем, чтобы порог коллинеарности не зависел от единиц
  const scaled = cols.map((c) => {
    const mu = mean(c);
    const d = c.map((v) => v - mu);
    const nrm = Math.sqrt(sumSq(d));
    return nrm > 0 ? d.map((v) => v / nrm) : d;
  });
  const e2 = e.map((v) => v * v);
  const ones = new Array(N).fill(1);
  const qr = qrSolve([ones, ...scaled], e2, 1e-9);
  const hetDf = qr.kept.length - 1;
  const e2m = mean(e2);
  const tss2 = sumSq(e2, e2m);
  let r2 = tss2 > 0 ? 1 - qr.rss / tss2 : 0;
  const saturated = hetDf >= N - 1;
  if (saturated) r2 = 1;
  const het = N * r2;

  const s2 = m.rss / N;
  const u3 = e.map((v) => v ** 3 - 3 * s2 * v);
  const u4 = e.map((v) => v ** 4 - 6 * s2 * v * v + 3 * s2 * s2);
  const skew = N * uncenteredR2(u3, X);
  // регрессия на одну константу: нецентрированный R² = (Σu)² / (N·Σu²)
  const su4 = u4.reduce((s, v) => s + v, 0);
  const kurt = (su4 * su4) / u4.reduce((s, v) => s + v * v, 0);

  const row = (chi2: number, df: number): ChiRow => ({ chi2, df, p: chi2tail(chi2, df) });
  const hetR = row(het, hetDf);
  const skewR = row(skew, p);
  const kurtR = row(kurt, 1);
  return { het: hetR, skew: skewR, kurt: kurtR, total: row(het + skew + kurt, hetDf + p + 1), N, saturated };
}
