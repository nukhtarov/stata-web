import { StataError } from '../../data/dataset';
import { ols } from '../../stats/ols';
import { lowess } from '../../stats/smooth';
import type { CommandDef } from '../command';
import { words } from '../parser';
import type { Series } from '../types';
import { COLORS, lfitLine, varTitle } from './_graph';
import { requireEst } from './_util';

export const acprplotCmd: CommandDef = {
  name: 'acprplot',
  min: 8,
  args: 'var',
  syntax: 'acprplot indepvar [, lowess]',
  summary: 'график «компонента + остаток» (линейность, П1)',
  options: [{ name: 'lowess', min: 3, help: 'добавить сглаживающую кривую' }],
  help: {
    what: 'Показывает, линейна ли связь зависимой переменной с выбранным фактором с учётом остальных факторов.',
    look: 'Сравните прямую (красная) и сглаженную кривую lowess (синяя): если кривая идёт рядом с прямой — связь линейная, хорошо. Сильный изгиб — нужна нелинейная форма (квадрат или логарифм).',
    example: 'acprplot Gini, lowess',
  },
  run(ctx, p) {
    const est = requireEst(ctx);
    const w = words(p);
    if (w.length !== 1) throw new StataError('varlist required', 100, 'Укажите один фактор из последней регрессии: acprplot Gini, lowess');
    const name = ctx.ds.varlist(w)[0];
    const j = est.m.usedNames.indexOf(name);
    if (j < 0) throw new StataError(`${name} is not an independent variable`, 398, 'acprplot работает только с факторами последней регрессии.');
    const m = est.m;
    const x = m.usedX[j];
    const x2 = x.map((v) => v * v);
    const aug = ols(m.y, [...m.usedX, x2], [...m.usedNames, '__sq'], m.depvar);
    const bx = aug.coefs[j].b;
    const bx2 = aug.coefs[m.usedNames.length].omitted ? 0 : aug.coefs[m.usedNames.length].b;
    const comp = x.map((v, i) => aug.resid[i] + bx * v + bx2 * v * v);
    const series: Series[] = [{ type: 'scatter', x, y: comp, label: 'Augmented component plus residual', color: COLORS.navy }];
    const lf = lfitLine(x, comp);
    series.push({ type: 'line', x: lf.x, y: lf.y, label: 'Linear fit', color: COLORS.red });
    const lowessOn = p.opts.has('lowess');
    if (lowessOn) {
      const lw = lowess(x, comp);
      series.push({ type: 'line', x: lw.x, y: lw.y, label: 'Lowess smooth', color: COLORS.blue });
    }
    ctx.graph({ xtitle: varTitle(ctx, name), ytitle: 'Augmented component plus residual', series, legend: false }, `acprplot_${name}`);
    ctx.setData({ kind: 'graph', graph: 'acprplot', x: name, lowess: lowessOn, slope: lf.slope });
  },
};
