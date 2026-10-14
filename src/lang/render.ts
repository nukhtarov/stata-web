// Текстовый вывод в стиле Stata 14.
import { abbrev, fmtF, fmtG, padL, padR } from '../stats/format';
import type { OLSResult } from '../stats/ols';

/** %10.0fc — целое с разделителем тысяч */
export function fmtInt(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export const DASH78 = '-'.repeat(78);

export function regressTable(m: OLSResult): string {
  const L: string[] = [];
  const hdr = (label: string, val: string) => '   ' + padR(label, 16) + '=' + padL(val, 10);
  const row = (name: string, ss: number, df: number, ms: number) =>
    padL(name, 12) + ' |' + padL(fmtG(ss, 11), 12) + padL(String(df), 10) + padL(fmtG(ms, 11), 12);
  const sep = '-------------+----------------------------------';
  if (m.vce === 'robust') {
    // Stata 14: шапка без ANOVA-таблицы, без Adj R-squared
    L.push(padR('Linear regression', 48) + hdr('Number of obs', fmtInt(m.N)));
    L.push(' '.repeat(48) + hdr(`F(${m.dfm}, ${m.dfr})`, fmtF(m.F, 2)));
    L.push(' '.repeat(48) + hdr('Prob > F', fmtF(m.pF, 4)));
    L.push(' '.repeat(48) + hdr('R-squared', fmtF(m.r2, 4)));
    L.push(' '.repeat(48) + hdr('Root MSE', fmtG(m.rmse, 10, 5)));
    L.push('');
    L.push(coefTable(m));
    return L.join('\n');
  }
  L.push('      Source |       SS           df       MS   ' + hdr('Number of obs', fmtInt(m.N)));
  L.push(sep + hdr(`F(${m.dfm}, ${m.dfr})`, fmtF(m.F, 2)));
  L.push(row('Model', m.mss, m.dfm, m.dfm > 0 ? m.mss / m.dfm : NaN) + hdr('Prob > F', fmtF(m.pF, 4)));
  L.push(row('Residual', m.rss, m.dfr, m.rss / m.dfr) + hdr('R-squared', fmtF(m.r2, 4)));
  L.push(sep + hdr('Adj R-squared', fmtF(m.adjr2, 4)));
  L.push(row('Total', m.tss, m.N - 1, m.tss / (m.N - 1)) + hdr('Root MSE', fmtG(m.rmse, 10, 5)));
  L.push('');
  L.push(coefTable(m));
  return L.join('\n');
}

export function coefTable(m: OLSResult): string {
  const L: string[] = [];
  L.push(DASH78);
  if (m.vce === 'robust') L.push('             |               Robust');
  L.push(padL(abbrev(m.depvar), 12) + ' |      Coef.   Std. Err.      t    P>|t|     [95% Conf. Interval]');
  L.push('-------------+----------------------------------------------------------------');
  for (const c of m.coefs) {
    const name = padL(abbrev(c.name), 12) + ' |';
    if (c.omitted) {
      L.push(name + padL('0', 11) + '  (omitted)');
      continue;
    }
    L.push(
      name +
        padL(fmtG(c.b), 11) +
        padL(fmtG(c.se), 11) +
        padL(fmtF(c.t, 2), 9) +
        padL(fmtF(c.p, 3), 8) +
        padL(fmtG(c.lo), 13) +
        padL(fmtG(c.hi), 12),
    );
  }
  L.push(DASH78);
  return L.join('\n');
}

/** Простая таблица Stata: заголовок | колонки */
export function simpleTable(headLeft: string, heads: string[], widths: number[], rows: { name: string; cells: string[] }[], footer?: { name: string; cells: string[] }): string {
  const total = widths.reduce((a, b) => a + b, 0);
  const sep = '-------------+' + '-'.repeat(total);
  const L: string[] = [];
  L.push(padL(headLeft, 12) + ' |' + heads.map((h, i) => padL(h, widths[i])).join(''));
  L.push(sep);
  for (const r of rows) L.push(padL(abbrev(r.name), 12) + ' |' + r.cells.map((c, i) => padL(c, widths[i])).join(''));
  if (footer) {
    L.push(sep);
    L.push(padL(footer.name, 12) + ' |' + footer.cells.map((c, i) => padL(c, widths[i])).join(''));
  }
  return L.join('\n');
}
