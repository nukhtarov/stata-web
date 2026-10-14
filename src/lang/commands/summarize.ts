import { abbrev, fmtG, padL, padR } from '../../stats/format';
import { summarize, summarizeDetail, PCTILES } from '../../stats/summary';
import type { CommandDef } from '../command';
import { fmtInt } from '../render';
import { pick, selectRows, varlistOrAll } from './_util';

export const summarizeCmd: CommandDef = {
  name: 'summarize',
  min: 2,
  args: 'varlist',
  ifin: true,
  syntax: 'summarize [varlist] [if] [in] [, detail]',
  summary: 'описательная статистика',
  options: [{ name: 'detail', min: 1, help: 'перцентили, асимметрия, эксцесс' }],
  help: {
    what: 'Число наблюдений (Obs), среднее (Mean), стандартное отклонение (Std. Dev.), минимум и максимум. С опцией detail — перцентили, 4 наименьших и наибольших значения, дисперсия, асимметрия (Skewness) и эксцесс (Kurtosis).',
    look: 'Obs — нет ли пропусков (у всех переменных должно быть одинаковое число). Min/Max — нет ли странных значений. Для остатков: Mean должно быть ≈ 0.',
    example: 'sum Price, detail',
  },
  run(ctx, p) {
    const names = varlistOrAll(ctx, p);
    const rows = selectRows(ctx, p);
    const detail = p.opts.has('detail');
    const out: { name: string; N: number; mean: number; sd: number; min: number; max: number }[] = [];
    const L: string[] = [];
    if (!detail) {
      L.push('    Variable |        Obs        Mean    Std. Dev.       Min        Max');
      L.push('-------------+---------------------------------------------------------');
    }
    for (const n of names) {
      const v = ctx.ds.get(n);
      if (v.kind === 'str') {
        if (!detail) L.push(padL(abbrev(n), 12) + ' |' + padL('0', 11));
        out.push({ name: n, N: 0, mean: NaN, sd: NaN, min: NaN, max: NaN });
        continue;
      }
      const x = pick(v.data, rows).filter((t) => !Number.isNaN(t));
      const s = summarize(x);
      out.push({ name: n, N: s.N, mean: s.mean, sd: s.sd, min: s.min, max: s.max });
      if (!detail) {
        L.push(
          padL(abbrev(n), 12) + ' |' + padL(fmtInt(s.N), 11) +
            (s.N ? padL(fmtG(s.mean), 12) + padL(s.N > 1 ? fmtG(s.sd) : '.', 12) + padL(fmtG(s.min), 11) + padL(fmtG(s.max), 11) : ''),
        );
        continue;
      }
      const label = v.label || n;
      L.push(padL(label, 30 + Math.ceil(label.length / 2)).trimEnd());
      L.push('-------------------------------------------------------------');
      if (!s.N) {
        L.push('no observations');
        L.push('');
        continue;
      }
      const d = summarizeDetail(x);
      const right: string[] = ['', '', `Obs         ${padL(fmtInt(d.N), 12)}`, `Sum of Wgt. ${padL(fmtInt(d.N), 12)}`, '', `Mean        ${padL(fmtG(d.mean), 12)}`];
      const left = (i: number) => padL(`${PCTILES[i]}%`, 3) + padL(fmtG(d.pctiles[PCTILES[i]]), 13);
      L.push('      Percentiles      Smallest');
      for (let i = 0; i < 4; i++) L.push(padR(left(i) + padL(fmtG(d.smallest[i] ?? NaN), 15), 38) + (right[i] ?? '').trimEnd());
      L.push('');
      L.push(padR(left(4), 38) + right[5]);
      L.push(padR('                        Largest', 38) + `Std. Dev.   ${padL(fmtG(d.sd), 12)}`);
      const tail = ['', `Variance    ${padL(fmtG(d.variance), 12)}`, `Skewness    ${padL(fmtG(d.skewness), 12)}`, `Kurtosis    ${padL(fmtG(d.kurtosis), 12)}`];
      for (let i = 0; i < 4; i++) L.push((padR(left(5 + i) + padL(fmtG(d.largest[i] ?? NaN), 15), 38) + tail[i]).trimEnd());
      L.push('');
    }
    ctx.print(L.join('\n').replace(/\n+$/, ''));
    const residVar = names.length === 1 && ctx.residVars.has(names[0]) ? names[0] : undefined;
    let residMaxAbs: number | undefined;
    if (residVar) residMaxAbs = Math.max(...ctx.ds.num(residVar).filter((t) => !Number.isNaN(t)).map(Math.abs));
    ctx.setData({ kind: 'summarize', rows: out, residVar, residMaxAbs });
  },
};
