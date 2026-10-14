import { StataError } from '../../data/dataset';
import { ols } from '../../stats/ols';
import type { CommandDef } from '../command';
import { words } from '../parser';
import { regressTable } from '../render';
import { completeRows, noObs, pick, requireData } from './_util';

export const regressCmd: CommandDef = {
  name: 'regress',
  min: 3,
  args: 'varlist',
  ifin: true,
  syntax: 'regress depvar [indepvars] [if] [in]',
  summary: 'линейная регрессия (МНК)',
  help: {
    what: 'Оценивает линейную регрессию методом наименьших квадратов (МНК). Первая переменная — зависимая (что объясняем), остальные — факторы.',
    look: 'Prob > F — значима ли модель в целом (хорошо < 0,05). R-squared — доля объяснённых различий. В таблице: Coef. — на сколько меняется зависимая при росте фактора на 1; P>|t| < 0,05 — фактор значим.',
    example: 'reg Price Gini HOR Inflation',
  },
  run(ctx, p) {
    requireData(ctx);
    const w = words(p);
    if (!w.length) throw new StataError('varlist required', 100, 'Укажите зависимую переменную и факторы: reg Price Gini HOR');
    const vars = ctx.ds.varlist(w);
    const [dep, ...xs] = vars;
    const rows = completeRows(ctx, p, vars);
    if (!rows.length) noObs();
    if (rows.length <= xs.length) throw new StataError('insufficient observations', 2001, 'Наблюдений меньше, чем параметров модели — уменьшите число факторов.');
    const y = pick(ctx.ds.num(dep), rows);
    const X = xs.map((x) => pick(ctx.ds.num(x), rows));
    // дубликаты в списке тоже коллинеарны
    const m = ols(y, X, xs, dep);
    for (const o of m.omitted) ctx.print(`note: ${o} omitted because of collinearity`);
    ctx.print(regressTable(m));
    ctx.setEst({ m, rows, xnames: xs, cmdline: p.raw });
    ctx.setData({ kind: 'regress', m });
  },
};
