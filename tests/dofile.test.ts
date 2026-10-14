// Интеграция: учебный do-файл на эталонном xlsx, сверка текста с выводом Stata 14.2.
import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { Session } from '../src/lang/session';
import { SAMPLE_DO } from '../src/lang/sampleDo';
import type { CommandResult } from '../src/lang/types';

// Курсовой датасет и вывод настоящей Stata 14.2. Файла нет в git — тесты пропускаются в CI.
const XLSX = new URL('./fixtures/private/Dataset_(12).xlsx', import.meta.url);
const HAS = existsSync(XLSX);

let results: CommandResult[];
const out = (i: number) => results[i].blocks.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('\n');
const find = (prefix: string) => results.findIndex((r) => r.echo.startsWith('. ' + prefix));
const lines = (s: string) => s.split('\n').map((l) => l.trimEnd());

beforeAll(async () => {
  if (!HAS) return;
  const buf = readFileSync(XLSX);
  const s = new Session(async () => ({ name: 'Dataset_(12).xlsx', data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) }));
  const imp = await s.run('import excel "C:\\path\\Dataset_(12).xlsx", sheet("Лист1") firstrow clear');
  expect(imp.ok).toBe(true);
  results = await s.runProgram(SAMPLE_DO);
});

describe.skipIf(!HAS)('do-file runs end to end', () => {
  it('no errors', () => {
    const errs = results.filter((r) => !r.ok).map((r) => r.echo + ' → ' + JSON.stringify(r.blocks));
    expect(errs).toEqual([]);
    expect(results.length).toBe(17);
  });
});

const REGRESS = `      Source |       SS           df       MS      Number of obs   =        48
-------------+----------------------------------   F(16, 31)       =      7.29
       Model |   126617070        16  7913566.85   Prob > F        =    0.0000
    Residual |  33660402.9        31  1085819.45   R-squared       =    0.7900
-------------+----------------------------------   Adj R-squared   =    0.6816
       Total |   160277473        47  3410158.99   Root MSE        =      1042

------------------------------------------------------------------------------
       Price |      Coef.   Std. Err.      t    P>|t|     [95% Conf. Interval]
-------------+----------------------------------------------------------------`;

// Stata 14.2: var | Coef. | Std. Err. | t | P>|t| | CI low | CI high
const COEFS = `Gini 111.8997 37.3056 3.00 0.005 35.81442 187.985
HOR -.3142535 9.621741 -0.03 0.974 -19.93792 19.30942
Inflation -187.2251 160.9911 -1.16 0.254 -515.5686 141.1183
URate -90.90824 44.05045 -2.06 0.048 -180.7497 -1.066759
Capital 450.1127 488.3904 0.92 0.364 -545.9661 1446.192
Euro_area 309.484 621.8584 0.50 0.622 -958.8045 1577.772
EU -1039.76 1027.134 -1.01 0.319 -3134.613 1055.092
Population -854.0639 544.4503 -1.57 0.127 -1964.478 256.3499
Density 221.4127 53.77991 4.12 0.000 111.7279 331.0976
Housing_st~k 2.417277 1.519713 1.59 0.122 -.6821976 5.516752
Pop2HS 1718.152 709.9512 2.42 0.022 270.1966 3166.107
GDP_PC_PPP 34.19077 14.61641 2.34 0.026 4.380408 64.00113
GBL_10y 6.986855 75.92128 0.09 0.927 -147.8556 161.8293
MIR 7.122293 53.60887 0.13 0.895 -102.2137 116.4583
DMIR 91.29236 326.373 0.28 0.782 -574.3498 756.9345
Mortgage_PC 16.01199 22.29099 0.72 0.478 -29.45078 61.47477
_cons -4670.431 2060.784 -2.27 0.031 -8873.428 -467.4334`;

describe.skipIf(!HAS)('regress = Stata 14.2 (character by character)', () => {
  it('header', () => {
    const o = lines(out(find('reg ')));
    expect(o.slice(0, 10).join('\n')).toBe(REGRESS);
  });
  it('coefficient rows', () => {
    const o = lines(out(find('reg ')));
    const rows = o.slice(10, 27).map((l) => l.replace('|', ' ').trim().split(/\s+/).join(' '));
    expect(rows.join('\n')).toBe(COEFS);
    // ширины колонок
    expect(o[10]).toBe('        Gini |   111.8997    37.3056     3.00   0.005     35.81442     187.985');
    expect(o[26]).toBe('       _cons |  -4670.431   2060.784    -2.27   0.031    -8873.428   -467.4334');
    expect(o[27]).toBe('-'.repeat(78));
  });
});

describe.skipIf(!HAS)('post-estimation = Stata 14.2', () => {
  it('linktest', () => {
    const o = out(find('linktest'));
    expect(o).toContain('F(2, 45)        =    106.93');
    expect(o).toContain('R-squared       =    0.8262');
    expect(o).toContain('Adj R-squared   =    0.8184');
    expect(o).toContain('Root MSE        =    786.88');
    const flat = lines(o).map((l) => l.replace('|', ' ').trim().split(/\s+/).join(' '));
    expect(flat.find((l) => l.startsWith('_hat '))).toMatch(/^_hat \.2394214 \.2582102 0\.93 0\.359 /);
    expect(flat.find((l) => l.startsWith('_hatsq '))).toMatch(/^_hatsq \.0000757 \.0000247 3\.06 0\.004 /);
    expect(flat.find((l) => l.startsWith('_cons '))).toMatch(/^_cons 1542\.076 572\.53\d* \S+ 0\.010 /);
  });
  it('ovtest', () => {
    expect(out(find('ovtest'))).toBe(
      [
        'Ramsey RESET test using powers of the fitted values of Price',
        '       Ho:  model has no omitted variables',
        '                  F(3, 28) =      6.25',
        '                  Prob > F =      0.0022',
      ].join('\n'),
    );
  });
  it('vif', () => {
    const flat = lines(out(find('vif'))).map((l) => l.replace('|', ' ').trim().split(/\s+/).join(' '));
    const exp = 'Population 75.88,Housing_st~k 57.23,Inflation 12.78,EU 9.21,Pop2HS 8.74,MIR 5.81,Euro_area 4.27,GBL_10y 4.14,GDP_PC_PPP 3.36,HOR 3.06,Mortgage_PC 2.79,Capital 2.64,Gini 2.46,DMIR 2.32,URate 2.32,Density 1.55'.split(',');
    const got = flat.filter((l) => /^\S+ \d+\.\d\d \d?\.\d+$/.test(l)).map((l) => l.split(' ').slice(0, 2).join(' '));
    expect(got).toEqual(exp);
    expect(flat.find((l) => l.startsWith('Mean VIF'))).toBe('Mean VIF 12.41');
  });
  it('sum ostatki: mean ≈ 0', () => {
    const r = results[find('sum ostatki')];
    const d = r.data as Extract<NonNullable<typeof r.data>, { kind: 'summarize' }>;
    expect(Math.abs(d.rows[0].mean)).toBeLessThan(1e-6 * d.residMaxAbs!);
    expect(lines(out(find('sum ostatki')))[2]).toMatch(/^     ostatki \|         48  +\S+ +\S+ +\S+ +\S+$/);
    expect(r.explain?.verdict).toBe('good');
  });
  it('swilk', () => {
    const o = lines(out(find('swilk')));
    expect(o.find((l) => l.includes('ostatki'))).toMatch(/ostatki \|\s+48\s+0\.98742\s+0\.573\s+-1\.185\s+0\.88202$/);
  });
  it('kdensity bandwidth', () => {
    const g = results[find('kdensity')].blocks.find((b) => b.type === 'graph')!;
    expect(g.type === 'graph' && g.graph.note).toBe('kernel = epanechnikov, bandwidth = 336.9905');
  });
  it('estat imtest', () => {
    const o = out(find('estat imtest'));
    expect(o).toBe(
      [
        "Cameron & Trivedi's decomposition of IM-test",
        '',
        '---------------------------------------------------',
        '              Source |       chi2     df      p',
        '---------------------+-----------------------------',
        '  Heteroskedasticity |      48.00     47    0.4321',
        '            Skewness |      11.72     16    0.7629',
        '            Kurtosis |       0.62      1    0.4321',
        '---------------------+-----------------------------',
        '               Total |      60.34     64    0.6067',
        '---------------------------------------------------',
      ].join('\n'),
    );
    expect(results[find('estat imtest')].explain?.warning).toMatch(/перегружен/);
  });
  it('estat hettest', () => {
    const o = lines(out(find('estat hettest')));
    expect(o).toContain('         chi2(1)      =     1.33');
    expect(o).toContain('         Prob > chi2  =   0.2483');
  });
  it('graphs rendered', () => {
    const graphs = results.flatMap((r) => r.blocks.filter((b) => b.type === 'graph'));
    expect(graphs.length).toBe(4);
  });
});
