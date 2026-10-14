// Робастные (Huber–White, HC1) стандартные ошибки — как regress, vce(robust) в Stata.
import { Ftail, invt, tprob2 } from './distributions';
import type { OLSResult } from './ols';

/** Обратная к симметричной положительно определённой матрице (Гаусс–Жордан с выбором ведущего) */
export function invert(A: number[][]): number[][] | null {
  const n = A.length;
  const M = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-300) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c];
    for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c || M[r][c] === 0) continue;
      const f = M[r][c];
      for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map((r) => r.slice(n));
}

/**
 * Пересчитать модель с V = (X'X)⁻¹ (Σ eᵢ² xᵢxᵢ') (X'X)⁻¹ · N/(N−k).
 * Коэффициенты, R² и Root MSE не меняются; F — тест Вальда для всех наклонов с df (k−1, N−k).
 */
export function robustOLS(m: OLSResult): OLSResult {
  const N = m.N;
  const k = m.k;
  const s2 = m.rss / m.dfr;
  // столбцы в порядке V: [usedX..., константа]
  const cols = [...m.usedX, new Array(N).fill(1)];
  const A = m.V.map((r) => r.map((v) => v / s2));
  const meat: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let i = 0; i < N; i++) {
    const e2 = m.resid[i] * m.resid[i];
    for (let a = 0; a < k; a++) {
      const xa = cols[a][i] * e2;
      for (let b = 0; b <= a; b++) meat[a][b] += xa * cols[b][i];
    }
  }
  for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) meat[a][b] = meat[b][a];
  const mul = (P: number[][], Q: number[][]) => P.map((r) => Q[0].map((_, j) => r.reduce((s, v, t) => s + v * Q[t][j], 0)));
  const scale = N / (N - k);
  const V = mul(mul(A, meat), A).map((r) => r.map((v) => v * scale));

  const tcrit = invt(0.975, m.dfr);
  let pos = 0;
  const coefs = m.coefs.map((c) => {
    if (c.omitted) return c;
    // порядок coefs: регрессоры (как в V), затем _cons — совпадает с порядком V
    const se = Math.sqrt(V[pos][pos]);
    pos++;
    const t = c.b / se;
    return { ...c, se, t, p: tprob2(t, m.dfr), lo: c.b - tcrit * se, hi: c.b + tcrit * se };
  });

  // Вальд: b_s' V_ss⁻¹ b_s / q
  const q = k - 1;
  let F = NaN;
  if (q > 0) {
    const b = coefs.filter((c) => !c.omitted && c.name !== '_cons').map((c) => c.b);
    const Vi = invert(V.slice(0, q).map((r) => r.slice(0, q)));
    if (Vi) {
      let w = 0;
      for (let a = 0; a < q; a++) for (let c = 0; c < q; c++) w += b[a] * Vi[a][c] * b[c];
      F = w / q;
    }
  }
  return { ...m, coefs, V, F, pF: Number.isFinite(F) ? Ftail(F, q, m.dfr) : NaN, vce: 'robust' };
}
