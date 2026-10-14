// Описательная статистика по формулам Stata (summarize, correlate).
import { mean } from './linalg';

/** Перцентиль Stata (без весов): P = N·p/100; целое ⇒ среднее x[P], x[P+1]; иначе x[⌈P⌉] */
export function pctile(sorted: number[], p: number): number {
  const n = sorted.length;
  const P = (n * p) / 100;
  const i = Math.floor(P);
  if (P === i) {
    if (i <= 0) return sorted[0];
    if (i >= n) return sorted[n - 1];
    return (sorted[i - 1] + sorted[i]) / 2;
  }
  return sorted[Math.min(i, n - 1)];
}

export interface Summary {
  N: number;
  mean: number;
  sd: number;
  min: number;
  max: number;
  sum: number;
}

export interface SummaryDetail extends Summary {
  variance: number;
  skewness: number;
  kurtosis: number;
  pctiles: Record<number, number>;
  smallest: number[];
  largest: number[];
}

export const PCTILES = [1, 5, 10, 25, 50, 75, 90, 95, 99];

export function summarize(x: number[]): Summary {
  const N = x.length;
  if (N === 0) return { N: 0, mean: NaN, sd: NaN, min: NaN, max: NaN, sum: 0 };
  const m = mean(x);
  let ss = 0;
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const v of x) {
    ss += (v - m) * (v - m);
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return { N, mean: m, sd: N > 1 ? Math.sqrt(ss / (N - 1)) : NaN, min, max, sum };
}

export function summarizeDetail(x: number[]): SummaryDetail {
  const s = summarize(x);
  const sorted = [...x].sort((a, b) => a - b);
  const N = x.length;
  let m2 = 0;
  let m3 = 0;
  let m4 = 0;
  for (const v of x) {
    const d = v - s.mean;
    m2 += d * d;
    m3 += d * d * d;
    m4 += d * d * d * d;
  }
  m2 /= N;
  m3 /= N;
  m4 /= N;
  const pctiles: Record<number, number> = {};
  for (const p of PCTILES) pctiles[p] = N ? pctile(sorted, p) : NaN;
  return {
    ...s,
    variance: s.sd * s.sd,
    skewness: m3 / m2 ** 1.5,
    kurtosis: m4 / (m2 * m2),
    pctiles,
    smallest: sorted.slice(0, 4),
    largest: sorted.slice(-4),
  };
}

/** Корреляция Пирсона по матрице столбцов (без missing) */
export function correlate(cols: number[][]): number[][] {
  const k = cols.length;
  const ms = cols.map(mean);
  const d = cols.map((c, j) => c.map((v) => v - ms[j]));
  const ss = d.map((c) => Math.sqrt(c.reduce((s, v) => s + v * v, 0)));
  const R: number[][] = Array.from({ length: k }, () => new Array(k).fill(1));
  for (let i = 0; i < k; i++)
    for (let j = 0; j < i; j++) {
      let s = 0;
      for (let t = 0; t < d[i].length; t++) s += d[i][t] * d[j][t];
      R[i][j] = R[j][i] = s / (ss[i] * ss[j]);
    }
  return R;
}
