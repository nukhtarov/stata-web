// Сверка с примерами из официальных мануалов Stata 14 ([R] sktest, [R] correlate, [R] regress)
// на данных auto.dta (tests/fixtures/auto.json).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultFormat, numericType } from '../src/data/dataset';
import { Session } from '../src/lang/session';
import { sktest } from '../src/stats/tests';

const auto = JSON.parse(readFileSync(new URL('./fixtures/auto.json', import.meta.url), 'utf8')) as Record<string, (number | null)[]>;
const col = (n: string) => auto[n].map((v) => (v === null ? NaN : v));

async function session() {
  const s = new Session(async () => null);
  s.ds.vars = Object.keys(auto).map((name) => {
    const data = col(name);
    const type = numericType(data);
    return { name, label: '', kind: 'num' as const, type, format: defaultFormat(type), data };
  });
  s.ds.N = auto.mpg.length;
  return s;
}
const text = (r: { blocks: { type: string; text?: string }[] }) =>
  r.blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .split('\n')
    .map((l) => l.trimEnd());

describe('sktest — [R] sktest, example 1', () => {
  it('numbers', () => {
    const mpg = sktest(col('mpg'), 'mpg');
    expect(mpg.pSkew.toFixed(4)).toBe('0.0015');
    expect(mpg.pKurt.toFixed(4)).toBe('0.0804');
    expect(mpg.chi2.toFixed(2)).toBe('10.95');
    expect(mpg.p.toFixed(4)).toBe('0.0042');
    const trunk = sktest(col('trunk'), 'trunk');
    expect([trunk.pSkew, trunk.pKurt].map((x) => x.toFixed(4))).toEqual(['0.9115', '0.0445']);
    expect(trunk.chi2.toFixed(2)).toBe('4.19');
    expect(trunk.p.toFixed(4)).toBe('0.1228');
    // technical note: с noadjust chi2 = 13.13 и 4.05
    expect(sktest(col('mpg'), 'mpg', false).chi2.toFixed(2)).toBe('13.13');
    expect(sktest(col('trunk'), 'trunk', false).chi2.toFixed(2)).toBe('4.05');
  });
  it('layout', async () => {
    const s = await session();
    expect(text(await s.run('sktest mpg trunk'))).toEqual([
      '',
      '                    Skewness/Kurtosis tests for Normality',
      '                                                          ------ joint ------',
      '    Variable |        Obs  Pr(Skewness)  Pr(Kurtosis) adj chi2(2)   Prob>chi2',
      '-------------+---------------------------------------------------------------',
      '         mpg |         74     0.0015        0.0804       10.95         0.0042',
      '       trunk |         74     0.9115        0.0445        4.19         0.1228',
    ]);
  });
});

// В мануале пример на auto1 (mpg там другой), поэтому столбец mpg — по auto.dta:
// corr(price, mpg) = −0.4686 — известное значение; остальные ячейки совпадают с мануалом.
describe('pwcorr — [R] correlate', () => {
  it('obs sig', async () => {
    const s = await session();
    expect(text(await s.run('pwcorr mpg price rep78 foreign, obs sig'))).toEqual([
      '',
      '             |      mpg    price    rep78  foreign',
      '-------------+------------------------------------',
      '         mpg |   1.0000',
      '             |',
      '             |       74',
      '             |',
      '       price |  -0.4686   1.0000',
      '             |   0.0000',
      '             |       74       74',
      '             |',
      '       rep78 |   0.4023   0.0066   1.0000',
      '             |   0.0006   0.9574',
      '             |       69       69       69',
      '             |',
      '     foreign |   0.3934   0.0487   0.5922   1.0000',
      '             |   0.0005   0.6802   0.0000',
      '             |       74       74       69       74',
      '             |',
    ]);
  });
  it('star', async () => {
    const s = await session();
    expect(text(await s.run('pwcorr mpg price rep78 foreign, star(.01)'))).toEqual([
      '',
      '             |      mpg    price    rep78  foreign',
      '-------------+------------------------------------',
      '         mpg |   1.0000',
      '       price |  -0.4686*  1.0000',
      '       rep78 |   0.4023*  0.0066   1.0000',
      '     foreign |   0.3934*  0.0487   0.5922*  1.0000',
    ]);
  });
});

describe('regress, vce(robust) — [R] regress', () => {
  it('gpmw on foreign', async () => {
    const s = await session();
    await s.run('generate gpmw = ((1/mpg)/weight)*100*1000');
    const plain = text(await s.run('regress gpmw foreign'));
    expect(plain).toContain('     foreign |   .2461526   .0549487     4.48   0.000     .1366143    .3556909');
    const out = text(await s.run('regress gpmw foreign, vce(robust)'));
    expect(out).toEqual([
      'Linear regression                                  Number of obs   =        74',
      '                                                   F(1, 72)        =     13.13',
      '                                                   Prob > F        =    0.0005',
      '                                                   R-squared       =    0.2180',
      '                                                   Root MSE        =    .21605',
      '',
      '------------------------------------------------------------------------------',
      '             |               Robust',
      '        gpmw |      Coef.   Std. Err.      t    P>|t|     [95% Conf. Interval]',
      '-------------+----------------------------------------------------------------',
      '     foreign |   .2461526   .0679238     3.62   0.001     .1107489    .3815563',
      '       _cons |   1.609004   .0234535    68.60   0.000      1.56225    1.655758',
      '------------------------------------------------------------------------------',
    ]);
    // сокращение robust тоже работает
    expect(text(await s.run('reg gpmw foreign, r'))).toEqual(out);
  });
});
