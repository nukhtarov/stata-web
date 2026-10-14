// Форматирование чисел как в Stata: %w.dg, %w.df, выравнивание, сокращение имён.

/** Missing в нашем хранилище — NaN */
export const isMissing = (x: number) => Number.isNaN(x);

function stripZeros(s: string): string {
  if (!s.includes('.')) return s;
  s = s.replace(/0+$/, '');
  return s.endsWith('.') ? s.slice(0, -1) : s;
}

function dropLeadingZero(s: string): string {
  return s.startsWith('0.') ? s.slice(1) : s;
}

function sigDigits(s: string): number {
  const digits = s.replace(/e.*$/, '').replace(/[^0-9]/g, '').replace(/^0+/, '');
  return digits.length;
}

/** Экспоненциальная запись Stata: 3.58e-06, 1.23e+10 */
function expString(a: number, mant: number): string {
  const [m, e] = a.toExponential(mant).split('e');
  const exp = parseInt(e, 10);
  const es = (exp < 0 ? '-' : '+') + String(Math.abs(exp)).padStart(2, '0');
  return stripZeros(m) + 'e' + es;
}

/**
 * Stata %w.dg (d = 0 — «столько цифр, сколько влезет»).
 * Эмпирика по выводу Stata 14: модуль числа занимает не больше w−1 символов
 * (один символ зарезервирован под знак), ведущий 0 перед точкой опускается,
 * экспоненциальная запись выбирается, только если даёт больше значащих цифр.
 */
export function fmtG(x: number, w = 9, d = 0): string {
  if (isMissing(x)) return '.';
  if (x === 0) return '0';
  if (!Number.isFinite(x)) return '.';
  const neg = x < 0;
  const a = Math.abs(x);
  const maxLen = w - 1;
  const maxSig = d > 0 ? d : Infinity;

  let fixed: string | null = null;
  // целая часть
  const intDigits = a >= 1 ? Math.floor(Math.log10(a)) + 1 : 0;
  for (let dec = Math.max(0, maxLen - 1); dec >= 0; dec--) {
    if (dec > 0 && intDigits + dec + 1 > maxLen + 1) continue;
    let s = a.toFixed(dec);
    s = dropLeadingZero(stripZeros(s));
    if (s.length > maxLen && !(dec === 0 && s.length <= w)) continue;
    if (sigDigits(s) > maxSig) continue;
    fixed = s;
    break;
  }
  let expo: string | null = null;
  for (let mant = Math.min(maxLen, 16); mant >= 0; mant--) {
    const s = expString(a, mant);
    if (s.length > maxLen) continue;
    if (sigDigits(s) > maxSig) continue;
    expo = s;
    break;
  }
  let out: string;
  if (fixed !== null && Number(fixed) !== 0 && (expo === null || sigDigits(expo) <= sigDigits(fixed))) out = fixed;
  else out = expo ?? fixed ?? '.';
  if (out !== '0' && neg) out = '-' + out;
  return out;
}

/** Stata %w.df (без выравнивания) */
export function fmtF(x: number, d: number): string {
  if (isMissing(x) || !Number.isFinite(x)) return '.';
  let s = x.toFixed(d);
  if (/^-0\.?0*$/.test(s)) s = s.slice(1);
  return s;
}

export const padL = (s: string, w: number) => (s.length >= w ? s : ' '.repeat(w - s.length) + s);
export const padR = (s: string, w: number) => (s.length >= w ? s : s + ' '.repeat(w - s.length));

/** Сокращение имени как в Stata: Housing_stock → Housing_st~k (до w символов) */
export function abbrev(name: string, w = 12): string {
  if (name.length <= w) return name;
  return name.slice(0, w - 2) + '~' + name.slice(-1);
}

/** Сокращение имени в заголовке столбца corr (8 символов): Housing~k */
export function abbrevMid(name: string, w: number): string {
  if (name.length <= w) return name;
  return name.slice(0, w - 2) + '~' + name.slice(-1);
}

/** Строки чисел в «человеческом» виде для пояснений: 3.58e-06 → 0,00000358 */
export function humanNumber(x: number, digits = 3): string {
  if (isMissing(x)) return '—';
  const a = Math.abs(x);
  let s: string;
  if (a === 0) s = '0';
  else if (a >= 1000) s = x.toLocaleString('ru-RU', { maximumFractionDigits: 2, useGrouping: true }).replace(',', '.');
  else if (a >= 1) s = String(Number(x.toFixed(digits)));
  else {
    const lead = Math.ceil(-Math.log10(a));
    s = x.toFixed(Math.min(20, lead + digits - 1)).replace(/0+$/, '').replace(/\.$/, '');
  }
  return s.replace('.', ',').replace(/ /g, ' ');
}

/** p-value для текста пояснения */
export function humanP(p: number): string {
  if (p < 0.0001) return '< 0,0001';
  return p.toFixed(4).replace('.', ',');
}

/** «= 0,0123» или «< 0,0001» — чтобы не писать «p = < 0,0001» */
export function pEq(p: number, digits = 4): string {
  const min = 10 ** -digits;
  if (p < min) return `< ${min.toFixed(digits).replace('.', ',')}`;
  return `= ${p.toFixed(digits).replace('.', ',')}`;
}
