import { normalDensity } from '../../stats/distributions';
import { fmtF } from '../../stats/format';
import { kdensity } from '../../stats/smooth';
import { StataError } from '../../data/dataset';
import type { CommandDef } from '../command';
import { words } from '../parser';
import { COLORS, varTitle } from './_graph';
import { pick, selectRows } from './_util';

export const kdensityCmd: CommandDef = {
  name: 'kdensity',
  min: 5,
  args: 'var',
  ifin: true,
  syntax: 'kdensity varname [, normal bwidth(#) n(#)]',
  summary: 'график плотности распределения',
  options: [
    { name: 'normal', min: 4, help: 'наложить нормальную плотность' },
    { name: 'bwidth', min: 2, arg: true, help: 'ширина окна' },
    { name: 'n', arg: true, help: 'число точек' },
  ],
  help: {
    what: 'Сглаженная гистограмма: показывает форму распределения переменной. С опцией normal добавляется «идеальный» нормальный колокол с тем же средним и разбросом.',
    look: 'Синяя линия должна быть похожа на красную: один горб, примерно симметричный, без длинных хвостов.',
    example: 'kdensity ostatki, normal',
  },
  run(ctx, p) {
    const w = words(p);
    if (w.length !== 1) throw new StataError('too many variables specified', 103, 'kdensity строит график одной переменной: kdensity ostatki, normal');
    const name = ctx.ds.varlist(w)[0];
    const x = pick(ctx.ds.num(name), selectRows(ctx, p)).filter((v) => !Number.isNaN(v));
    if (x.length < 2) throw new StataError('insufficient observations', 2001);
    const bwOpt = p.opts.get('bwidth');
    const nOpt = p.opts.get('n');
    const k = kdensity(x, typeof nOpt === 'string' ? parseInt(nOpt, 10) : undefined, typeof bwOpt === 'string' ? Number(bwOpt) : undefined);
    const normal = p.opts.has('normal');
    const series = [{ type: 'line' as const, x: k.x, y: k.y, label: 'Kernel density estimate', color: COLORS.navy }];
    if (normal) {
      const nx = Array.from({ length: 200 }, (_, i) => k.x[0] + ((k.x[k.x.length - 1] - k.x[0]) * i) / 199);
      series.push({ type: 'line', x: nx, y: nx.map((v) => normalDensity(v, k.mean, k.sd)), label: 'Normal density', color: COLORS.maroon });
    }
    const bw = fmtF(k.bw, 4).replace(/^(-?)0\./, '$1.');
    ctx.graph(
      { title: 'Kernel density estimate', xtitle: varTitle(ctx, name), ytitle: 'Density', series, note: `kernel = epanechnikov, bandwidth = ${bw}`, legend: normal },
      `kdensity_${name}`,
    );
    ctx.setData({ kind: 'graph', graph: 'kdensity', x: name, normal, bw: k.bw });
  },
};
