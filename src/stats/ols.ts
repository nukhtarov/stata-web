import { qrSolve, mean, sumSq } from './linalg';
import { Ftail, invt, tprob2 } from './distributions';

export interface CoefRow {
  name: string;
  omitted: boolean;
  b: number;
  se: number;
  t: number;
  p: number;
  lo: number;
  hi: number;
}

export interface OLSResult {
  depvar: string;
  N: number;
  /** число оценённых параметров с константой */
  k: number;
  dfm: number;
  dfr: number;
  mss: number;
  rss: number;
  tss: number;
  F: number;
  pF: number;
  r2: number;
  adjr2: number;
  rmse: number;
  /** строки в порядке вывода: регрессоры, затем _cons */
  coefs: CoefRow[];
  /** исключённые из-за коллинеарности */
  omitted: string[];
  resid: number[];
  fitted: number[];
  /** только неисключённые регрессоры (без константы) — имена и столбцы */
  usedNames: string[];
  usedX: number[][];
  y: number[];
  /** V = s²(X'X)^-1 в порядке [usedNames..., _cons] */
  V: number[][];
  /** тип стандартных ошибок; robust — HC1 (regress, vce(robust)) */
  vce?: 'robust';
}

/**
 * МНК с константой. X — столбцы регрессоров (без константы), все без missing.
 * Коллинеарные регрессоры исключаются по порядку (константа проверяется первой и не исключается).
 */
export function ols(y: number[], X: number[][], names: string[], depvar = 'y', tol = 1e-9): OLSResult {
  const N = y.length;
  const ones = new Array(N).fill(1);
  const cols = [ones, ...X];
  const qr = qrSolve(cols, y, tol);
  // qr.kept — индексы в cols; 0 — константа
  const pos = new Map<number, number>();
  qr.kept.forEach((c, i) => pos.set(c, i));
  const k = qr.kept.length;
  const dfr = N - k;
  const dfm = k - 1;
  const rss = qr.rss;
  const ym = mean(y);
  const tss = sumSq(y, ym);
  const mss = Math.max(0, tss - rss);
  const s2 = dfr > 0 ? rss / dfr : NaN;
  const r2 = tss > 0 ? mss / tss : NaN;
  const adjr2 = dfr > 0 ? 1 - ((1 - r2) * (N - 1)) / dfr : NaN;
  const F = dfm > 0 && dfr > 0 ? mss / dfm / s2 : NaN;
  const pF = Number.isFinite(F) ? Ftail(F, dfm, dfr) : NaN;
  const tcrit = dfr > 0 ? invt(0.975, dfr) : NaN;

  const row = (c: number, name: string): CoefRow => {
    const i = pos.get(c);
    if (i === undefined) return { name, omitted: true, b: 0, se: NaN, t: NaN, p: NaN, lo: NaN, hi: NaN };
    const b = qr.b[i];
    const se = Math.sqrt(s2 * qr.xtxInv[i][i]);
    const t = b / se;
    return { name, omitted: false, b, se, t, p: tprob2(t, dfr), lo: b - tcrit * se, hi: b + tcrit * se };
  };
  const coefs = names.map((nm, j) => row(j + 1, nm));
  coefs.push(row(0, '_cons'));
  const omitted = names.filter((_, j) => !pos.has(j + 1));

  const usedIdx = names.map((_, j) => j + 1).filter((c) => pos.has(c));
  const order = [...usedIdx, 0].map((c) => pos.get(c)!);
  const V = order.map((i) => order.map((j) => s2 * qr.xtxInv[i][j]));

  return {
    depvar,
    N,
    k,
    dfm,
    dfr,
    mss,
    rss,
    tss,
    F,
    pF,
    r2,
    adjr2,
    rmse: Math.sqrt(s2),
    coefs,
    omitted,
    resid: qr.resid,
    fitted: qr.fitted,
    usedNames: usedIdx.map((c) => names[c - 1]),
    usedX: usedIdx.map((c) => X[c - 1]),
    y,
    V,
  };
}
