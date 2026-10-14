// kdensity и lowess по Stata ([R] kdensity, [R] lowess — Methods and formulas).
import { summarize, summarizeDetail } from './summary';

const SQRT5 = Math.sqrt(5);

/** Ядро Epanechnikov в варианте Stata: 3/(4√5)·(1 − u²/5), |u| < √5 */
export function epan(u: number): number {
  return Math.abs(u) < SQRT5 ? (3 / (4 * SQRT5)) * (1 - (u * u) / 5) : 0;
}

/** Оптимальная полоса Сильвермана, как в Stata: 0.9·min(sd, IQR/1.349)·N^(−1/5) */
export function kdensityBandwidth(x: number[]): number {
  const d = summarizeDetail(x);
  const iqr = d.pctiles[75] - d.pctiles[25];
  const m = iqr > 0 ? Math.min(d.sd, iqr / 1.349) : d.sd;
  return 0.9 * m * x.length ** -0.2;
}

export interface KDensity {
  bw: number;
  n: number;
  x: number[];
  y: number[];
  mean: number;
  sd: number;
}

/** Плотность на сетке из n точек от min−h до max+h (Stata: n = min(N, 50)) */
export function kdensity(x: number[], n?: number, bw?: number): KDensity {
  const N = x.length;
  const h = bw ?? kdensityBandwidth(x);
  const pts = n ?? Math.min(N, 50);
  const s = summarize(x);
  const lo = s.min - h;
  const step = (s.max - s.min + 2 * h) / (pts - 1);
  const gx: number[] = [];
  const gy: number[] = [];
  for (let i = 0; i < pts; i++) {
    const at = lo + i * step;
    let sum = 0;
    for (const v of x) sum += epan((at - v) / h);
    gx.push(at);
    gy.push(sum / (N * h));
  }
  return { bw: h, n: pts, x: gx, y: gy, mean: s.mean, sd: s.sd };
}

/**
 * lowess как в Stata (без робастных итераций): для каждой точки x_i — окрестность
 * i± k по порядку, k = floor((N·bwidth − 0.5)/2), трикубические веса с
 * Δ = 1.0001·max(x_{i+} − x_i, x_i − x_{i−}), локальная линейная регрессия.
 * Возвращает сглаженные значения в порядке возрастания x.
 */
export function lowess(xIn: number[], yIn: number[], bwidth = 0.8): { x: number[]; y: number[] } {
  const N = xIn.length;
  const idx = [...Array(N).keys()].sort((a, b) => xIn[a] - xIn[b] || a - b);
  const x = idx.map((i) => xIn[i]);
  const y = idx.map((i) => yIn[i]);
  const k = Math.floor((N * bwidth - 0.5) / 2);
  const out: number[] = [];
  for (let i = 0; i < N; i++) {
    const lo = Math.max(0, i - k);
    const hi = Math.min(N - 1, i + k);
    const delta = 1.0001 * Math.max(x[hi] - x[i], x[i] - x[lo]);
    let sw = 0;
    let swx = 0;
    let swy = 0;
    let swxx = 0;
    let swxy = 0;
    for (let j = lo; j <= hi; j++) {
      const u = delta > 0 ? Math.abs(x[j] - x[i]) / delta : 0;
      const w = u < 1 ? (1 - u ** 3) ** 3 : 0;
      sw += w;
      swx += w * x[j];
      swy += w * y[j];
      swxx += w * x[j] * x[j];
      swxy += w * x[j] * y[j];
    }
    const mx = swx / sw;
    const my = swy / sw;
    const sxx = swxx / sw - mx * mx;
    const sxy = swxy / sw - mx * my;
    const b = sxx > 1e-14 * (mx * mx + 1) ? sxy / sxx : 0;
    out.push(my + b * (x[i] - mx));
  }
  return { x, y: out };
}
