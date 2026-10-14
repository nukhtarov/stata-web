// Распределения: нормальное, t, F, χ². Без внешних библиотек.

const LOG_SQRT_2PI = 0.9189385332046728;

// ---------------------------------------------------------------- gamma
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

export function lgamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  x -= 1;
  let a = LANCZOS[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
  return LOG_SQRT_2PI + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

// ---------------------------------------------------------------- normal
/** erfc(x) = Q(1/2, x²) — регуляризованная неполная гамма, точность ~1e-15 */
export function erfc(x: number): number {
  if (x === 0) return 1;
  const q = gammaPQ(0.5, x * x)[1];
  return x > 0 ? q : 2 - q;
}

/** Φ(x) */
export function normal(x: number): number {
  return 0.5 * erfc(-x / Math.SQRT2);
}

/** Φ⁻¹(p), AS 241 PPND16 */
export function invnormal(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const q = p - 0.5;
  if (Math.abs(q) <= 0.425) {
    const r = 0.180625 - q * q;
    return (
      (q *
        (((((((r * 2509.0809287301226727 + 33430.575583588128105) * r + 67265.770927008700853) * r + 45921.953931549871457) * r +
          13731.693765509461125) * r + 1971.5909503065514427) * r + 133.14166789178437745) * r + 3.387132872796366608)) /
      (((((((r * 5226.495278852545925 + 28729.085735721942674) * r + 39307.89580009271061) * r + 21213.794301586595867) * r +
        5394.1960214247511077) * r + 687.1870074920579083) * r + 42.313330701600911252) * r + 1)
    );
  }
  let r = q < 0 ? p : 1 - p;
  r = Math.sqrt(-Math.log(r));
  let val: number;
  if (r <= 5) {
    r -= 1.6;
    val =
      (((((((r * 7.7454501427834140764e-4 + 0.0227238449892691845833) * r + 0.24178072517745061177) * r + 1.27045825245236838258) * r +
        3.64784832476320460504) * r + 5.7694972214606914055) * r + 4.6303378461565452959) * r + 1.42343711074968357734) /
      (((((((r * 1.05075007164441684324e-9 + 5.475938084995344946e-4) * r + 0.0151986665636164571966) * r + 0.14810397642748007459) * r +
        0.68976733498510000455) * r + 1.6763848301838038494) * r + 2.05319162663775882187) * r + 1);
  } else {
    r -= 5;
    val =
      (((((((r * 2.01033439929228813265e-7 + 2.71155556874348757815e-5) * r + 0.0012426609473880784386) * r + 0.026532189526576123093) * r +
        0.29656057182850489123) * r + 1.7848265399172913358) * r + 5.4637849111641143699) * r + 6.6579046435011037772) /
      (((((((r * 2.04426310338993978564e-15 + 1.4215117583164458887e-7) * r + 1.8463183175100546818e-5) * r + 7.868691311456132591e-4) * r +
        0.0148753612908506148525) * r + 0.13692988092273580531) * r + 0.59983220655588793769) * r + 1);
  }
  return q < 0 ? -val : val;
}

// ---------------------------------------------------------------- incomplete beta (Lentz)
function betacf(a: number, b: number, x: number): number {
  const TINY = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 10000; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return h;
}

/** Регуляризованная неполная бета I_x(a, b) */
export function ibeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbt = lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log1p(-x);
  if (x < (a + 1) / (a + b + 2)) return (Math.exp(lbt) * betacf(a, b, x)) / a;
  return 1 - (Math.exp(lbt) * betacf(b, a, 1 - x)) / b;
}

/** 1 − I_x(a, b) без потери точности в хвосте */
export function ibetac(x: number, a: number, b: number): number {
  return ibeta(1 - x, b, a);
}

// ---------------------------------------------------------------- incomplete gamma
/** Регуляризованная P(a, x) и Q(a, x) */
export function gammaPQ(a: number, x: number): [number, number] {
  if (x <= 0) return [0, 1];
  const lg = a * Math.log(x) - x - lgamma(a);
  if (x < a + 1) {
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 0; n < 100000; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-17) break;
    }
    const P = sum * Math.exp(lg);
    return [P, 1 - P];
  }
  const TINY = 1e-300;
  let b = x + 1 - a;
  let c = 1 / TINY;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 100000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-17) break;
  }
  const Q = Math.exp(lg) * h;
  return [1 - Q, Q];
}

// ---------------------------------------------------------------- t, F, χ²
/** P(T ≤ x), T ~ t(df) */
export function tcdf(x: number, df: number): number {
  const xb = df / (df + x * x);
  const tail = 0.5 * ibeta(xb, df / 2, 0.5);
  return x >= 0 ? 1 - tail : tail;
}

/** P(T > x) */
export function ttail(x: number, df: number): number {
  return tcdf(-x, df);
}

/** Двусторонний p-value для t */
export function tprob2(t: number, df: number): number {
  return ibeta(df / (df + t * t), df / 2, 0.5);
}

/** P(F > x) */
export function Ftail(x: number, d1: number, d2: number): number {
  if (x <= 0) return 1;
  return ibeta(d2 / (d2 + d1 * x), d2 / 2, d1 / 2);
}

export function Fcdf(x: number, d1: number, d2: number): number {
  if (x <= 0) return 0;
  return ibeta((d1 * x) / (d1 * x + d2), d1 / 2, d2 / 2);
}

/** P(χ² > x) */
export function chi2tail(x: number, df: number): number {
  return gammaPQ(df / 2, x / 2)[1];
}

export function chi2cdf(x: number, df: number): number {
  return gammaPQ(df / 2, x / 2)[0];
}

/** t-квантиль: Ньютон от нормального приближения с откатом на бисекцию */
export function invt(p: number, df: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;
  // Ньютон в лог-пространстве хвоста неустойчив при малых df — используем бисекцию + Ньютон
  let lo = -1;
  let hi = 1;
  while (tcdf(lo, df) > p) lo *= 2;
  while (tcdf(hi, df) < p) hi *= 2;
  let x = invnormal(p);
  if (!(x > lo && x < hi)) x = (lo + hi) / 2;
  const lc = lgamma((df + 1) / 2) - lgamma(df / 2) - 0.5 * Math.log(df * Math.PI);
  for (let i = 0; i < 200; i++) {
    const f = tcdf(x, df) - p;
    if (f > 0) hi = x;
    else lo = x;
    const dens = Math.exp(lc - ((df + 1) / 2) * Math.log1p((x * x) / df));
    let nx = x - f / dens;
    if (!(nx > lo && nx < hi)) nx = (lo + hi) / 2;
    if (Math.abs(nx - x) <= 1e-14 * Math.max(1, Math.abs(x))) {
      x = nx;
      break;
    }
    x = nx;
  }
  return x;
}

export function normalDensity(x: number, m = 0, s = 1): number {
  const z = (x - m) / s;
  return Math.exp(-0.5 * z * z - LOG_SQRT_2PI) / s;
}
