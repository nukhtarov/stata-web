import type { CommandDef } from '../command';
import { COLORS } from './_graph';
import { requireEst } from './_util';

export const rvfplotCmd: CommandDef = {
  name: 'rvfplot',
  min: 7,
  args: 'none',
  syntax: 'rvfplot [, yline(#)]',
  summary: 'остатки против прогноза (П4)',
  options: [{ name: 'yline', arg: true, help: 'горизонтальная линия, обычно yline(0)' }],
  help: {
    what: 'Точечный график: по горизонтали — прогноз модели, по вертикали — остатки (ошибки).',
    look: 'Хорошо — ровная горизонтальная полоса вокруг нуля. Плохо — «воронка» (разброс растёт или сужается) или изгиб (дуга).',
    example: 'rvfplot, yline(0)',
  },
  run(ctx, p) {
    const est = requireEst(ctx);
    const yl = p.opts.get('yline');
    const yline = typeof yl === 'string' ? yl.split(/[\s,]+/).filter(Boolean).map(Number) : [];
    ctx.graph(
      { xtitle: 'Fitted values', ytitle: 'Residuals', series: [{ type: 'scatter', x: est.m.fitted, y: est.m.resid, label: 'Residuals', color: COLORS.navy }], legend: false, yline },
      'rvfplot',
    );
    ctx.setData({ kind: 'graph', graph: 'rvfplot' });
  },
};
