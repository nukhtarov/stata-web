import { StataError } from '../../data/dataset';
import { abbrev, fmtF, padL } from '../../stats/format';
import { sktest } from '../../stats/tests';
import type { CommandDef } from '../command';
import { fmtInt } from '../render';
import { pick, selectRows, varlistOrAll } from './_util';

export const sktestCmd: CommandDef = {
  name: 'sktest',
  min: 6,
  args: 'varlist',
  ifin: true,
  syntax: 'sktest varlist [if] [in] [, noadjust]',
  summary: 'тест на нормальность по асимметрии и эксцессу (П5)',
  options: [{ name: 'noadjust', min: 3, help: 'без поправки Ройстона' }],
  help: {
    what: 'Проверяет нормальность распределения по двум признакам: асимметрии (перекос в одну сторону) и эксцессу (слишком острая или плоская вершина, «тяжёлые хвосты»). Обычно применяется к остаткам регрессии.',
    look: 'Главное — Prob>chi2 (совместный тест): ≥ 0,05 — отличий от нормального нет. Pr(Skewness) и Pr(Kurtosis) подсказывают, в чём именно проблема.',
    example: 'sktest ostatki',
  },
  run(ctx, p) {
    const names = varlistOrAll(ctx, p);
    const sel = selectRows(ctx, p);
    const adjust = !p.opts.has('noadjust');
    const L = [
      '',
      '                    Skewness/Kurtosis tests for Normality',
      ' '.repeat(58) + '------ joint ------',
      `    Variable |        Obs  Pr(Skewness)  Pr(Kurtosis) ${adjust ? 'adj chi2(2)' : '    chi2(2)'}   Prob>chi2`,
      '-------------+---------------------------------------------------------------',
    ];
    const rows = [];
    for (const n of names) {
      if (ctx.ds.get(n).kind !== 'num') throw new StataError(`${n} is a string variable`, 109);
      const x = pick(ctx.ds.num(n), sel).filter((v) => !Number.isNaN(v));
      if (x.length < 8) throw new StataError('insufficient observations', 2001, 'sktest требует не меньше 8 наблюдений.');
      const r = sktest(x, n, adjust);
      rows.push(r);
      L.push(padL(abbrev(n), 12) + ' |' + padL(fmtInt(r.N), 11) + padL(fmtF(r.pSkew, 4), 11) + padL(fmtF(r.pKurt, 4), 14) + padL(fmtF(r.chi2, 2), 12) + padL(fmtF(r.p, 4), 15));
    }
    ctx.print(L.join('\n'));
    ctx.setData({ kind: 'sktest', rows, isResid: names.every((n) => ctx.residVars.has(n)) });
  },
};
