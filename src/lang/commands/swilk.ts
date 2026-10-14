import { StataError } from '../../data/dataset';
import { abbrev, fmtF, padL } from '../../stats/format';
import { swilk } from '../../stats/tests';
import type { CommandDef } from '../command';
import { fmtInt } from '../render';
import { pick, selectRows, varlistOrAll } from './_util';

export const swilkCmd: CommandDef = {
  name: 'swilk',
  min: 5,
  args: 'varlist',
  ifin: true,
  syntax: 'swilk varlist [if] [in]',
  summary: 'тест Шапиро–Уилка на нормальность (П5)',
  help: {
    what: 'Проверяет, похоже ли распределение переменной на нормальное (колокол). Обычно применяется к остаткам регрессии.',
    look: 'Prob>z ≥ 0,05 — хорошо: отличий от нормального распределения нет. W близко к 1 — распределение близко к нормальному.',
    example: 'swilk ostatki',
  },
  run(ctx, p) {
    const names = varlistOrAll(ctx, p);
    const sel = selectRows(ctx, p);
    const L = [
      '',
      '                   Shapiro-Wilk W test for normal data',
      '',
      '    Variable |        Obs       W           V         z       Prob>z',
      '-------------+------------------------------------------------------',
    ];
    const rows = [];
    for (const n of names) {
      const x = pick(ctx.ds.num(n), sel).filter((v) => !Number.isNaN(v));
      if (x.length < 4) throw new StataError('insufficient observations', 2001, 'Для теста Шапиро–Уилка нужно хотя бы 4 наблюдения.');
      const r = swilk(x, n);
      rows.push(r);
      L.push(padL(abbrev(n), 12) + ' |' + padL(fmtInt(r.N), 11) + padL(fmtF(r.W, 5), 11) + padL(fmtF(r.V, 3), 11) + padL(fmtF(r.z, 3), 10) + padL(fmtF(r.p, 5), 11));
    }
    ctx.print(L.join('\n'));
    ctx.setData({ kind: 'swilk', rows, isResid: names.every((n) => ctx.residVars.has(n)) });
  },
};
