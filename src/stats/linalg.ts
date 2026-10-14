// Линейная алгебра для МНК: QR (Householder) с обнаружением коллинеарности.
// Матрицы хранятся по столбцам: cols[j][i] — элемент (i, j).

export type Cols = number[][];

export interface QRResult {
  /** индексы столбцов, вошедших в модель (в исходном порядке) */
  kept: number[];
  /** индексы столбцов, исключённых из-за коллинеарности */
  dropped: number[];
  /** коэффициенты для kept */
  b: number[];
  /** (X'X)^-1 для kept, k×k */
  xtxInv: number[][];
  resid: number[];
  fitted: number[];
  rss: number;
}

const dot = (a: number[], b: number[]) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

/**
 * МНК y на столбцы X (константа, если нужна, передаётся явным столбцом).
 * Столбцы обрабатываются по порядку; столбец, почти линейно зависимый от уже принятых,
 * исключается (как _rmcoll в Stata). Порог — относительная норма остатка столбца.
 * `protect` — индексы столбцов, которые исключать нельзя (константа в Stata исключается последней,
 * но мы ставим её последней и проверяем первой — см. ols.ts).
 */
export function qrSolve(X: Cols, y: number[], tol = 1e-9, order?: number[]): QRResult {
  const n = y.length;
  const p = X.length;
  const seq = order ?? [...Array(p).keys()];
  // Householder-векторы
  const vs: number[][] = [];
  const betas: number[] = [];
  const R: number[][] = []; // R[r] — строка r треугольника, по kept-порядку
  const kept: number[] = [];
  const dropped: number[] = [];

  const applyHouseholders = (v0: number[]) => {
    const v = v0.slice();
    for (let h = 0; h < vs.length; h++) {
      const u = vs[h];
      let s = 0;
      for (let i = h; i < n; i++) s += u[i] * v[i];
      s *= betas[h];
      for (let i = h; i < n; i++) v[i] -= s * u[i];
    }
    return v;
  };

  for (const j of seq) {
    const col = X[j];
    const colNorm = Math.sqrt(dot(col, col));
    if (colNorm === 0) {
      dropped.push(j);
      continue;
    }
    const v = applyHouseholders(col);
    const r = vs.length;
    if (r >= n) {
      dropped.push(j);
      continue;
    }
    let tail = 0;
    for (let i = r; i < n; i++) tail += v[i] * v[i];
    tail = Math.sqrt(tail);
    if (tail <= tol * colNorm) {
      dropped.push(j);
      continue;
    }
    // построить отражение для v[r..n)
    const alpha = v[r] >= 0 ? -tail : tail;
    const u = new Array(n).fill(0);
    for (let i = r; i < n; i++) u[i] = v[i];
    u[r] -= alpha;
    let uu = 0;
    for (let i = r; i < n; i++) uu += u[i] * u[i];
    vs.push(u);
    betas.push(uu === 0 ? 0 : 2 / uu);
    // столбец R
    const rcol = v.slice(0, r);
    rcol.push(alpha);
    for (let i = 0; i < r; i++) R[i].push(rcol[i]);
    R.push(new Array(r).fill(0).concat([alpha]));
    kept.push(j);
  }

  const k = kept.length;
  const qty = applyHouseholders(y);
  // обратная подстановка R b = (Q'y)[0..k)
  const b = new Array(k).fill(0);
  for (let i = k - 1; i >= 0; i--) {
    let s = qty[i];
    for (let c = i + 1; c < k; c++) s -= R[i][c] * b[c];
    b[i] = s / R[i][i];
  }
  // R^-1 (верхнетреугольная), (X'X)^-1 = R^-1 R^-T
  const Rinv: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let c = 0; c < k; c++) {
    Rinv[c][c] = 1 / R[c][c];
    for (let i = c - 1; i >= 0; i--) {
      let s = 0;
      for (let m = i + 1; m <= c; m++) s += R[i][m] * Rinv[m][c];
      Rinv[i][c] = -s / R[i][i];
    }
  }
  const xtxInv: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let i = 0; i < k; i++)
    for (let j = i; j < k; j++) {
      let s = 0;
      for (let m = Math.max(i, j); m < k; m++) s += Rinv[i][m] * Rinv[j][m];
      xtxInv[i][j] = s;
      xtxInv[j][i] = s;
    }
  const fitted = new Array(n).fill(0);
  for (let c = 0; c < k; c++) {
    const col = X[kept[c]];
    const bc = b[c];
    for (let i = 0; i < n; i++) fitted[i] += bc * col[i];
  }
  const resid = y.map((v, i) => v - fitted[i]);
  // RSS точнее из хвоста Q'y
  let rss = 0;
  for (let i = k; i < n; i++) rss += qty[i] * qty[i];
  return { kept, dropped, b, xtxInv, resid, fitted, rss };
}

export function mean(x: number[]): number {
  let s = 0;
  for (const v of x) s += v;
  return s / x.length;
}

export function sumSq(x: number[], m = 0): number {
  let s = 0;
  for (const v of x) s += (v - m) * (v - m);
  return s;
}
