import { StataError } from '../../data/dataset';
import { ols } from '../../stats/ols';
import { robustOLS } from '../../stats/robust';
import type { CommandDef } from '../command';
import { words } from '../parser';
import { regressTable } from '../render';
import { completeRows, noObs, pick, requireData } from './_util';

export const regressCmd: CommandDef = {
  name: 'regress',
  min: 3,
  args: 'varlist',
  ifin: true,
  syntax: 'regress depvar [indepvars] [if] [in] [, vce(robust)]',
  summary: 'линейная регрессия (МНК)',
  options: [
    { name: 'robust', min: 1, help: 'робастные (устойчивые к гетероскедастичности) ошибки' },
    { name: 'vce', arg: true, help: 'тип ошибок: vce(robust)' },
  ],
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
    const vce = p.opts.get('vce');
    const vceType = typeof vce === 'string' ? vce.trim() : '';
    if (vceType && !/^(r|ro|rob|robu|robus|robust|ols)$/.test(vceType))
      throw new StataError(`vcetype '${vceType}' not allowed`, 198, 'Поддерживаются vce(robust) и vce(ols).');
    const robust = p.opts.has('robust') || (vceType !== '' && vceType !== 'ols');
    // дубликаты в списке тоже коллинеарны
    const m0 = ols(y, X, xs, dep);
    const m = robust && m0.dfr > 0 ? robustOLS(m0) : m0;
    for (const o of m.omitted) ctx.print(`note: ${o} omitted because of collinearity`);
    ctx.print(regressTable(m));
    ctx.setEst({ m, rows, xnames: xs, cmdline: p.raw });
    ctx.setData({ kind: 'regress', m });
  },
};
