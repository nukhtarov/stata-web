import { StataError } from '../../data/dataset';
import type { CommandDef } from '../command';
import type { Series } from '../types';
import { tokenize } from '../tokenizer';
import { topLevelComma, parseArgs } from '../parser';
import { COLORS, lfitLine, varTitle } from './_graph';
import { completeRows } from './_util';

/** Разбить "(scatter y x) (lfit y x)" или "scatter y x || lfit y x" на подкоманды */
export function splitPlots(s: string): string[] {
  const out: string[] = [];
  s = s.trim();
  if (s.startsWith('(')) {
    let depth = 0;
    let cur = '';
    for (const c of s) {
      if (c === '(') {
        if (depth > 0) cur += c;
        depth++;
      } else if (c === ')') {
        depth--;
        if (depth === 0) {
          out.push(cur.trim());
          cur = '';
        } else cur += c;
      } else if (depth > 0) cur += c;
    }
    return out.filter(Boolean);
  }
  return s.split('||').map((x) => x.trim()).filter(Boolean);
}

const PLOTS = [
  { name: 'scatter', min: 2 },
  { name: 'lfit', min: 4 },
  { name: 'line', min: 4 },
];

export function plotType(w: string) {
  return PLOTS.find((p) => w.length >= p.min && p.name.startsWith(w))?.name;
}

export function runTwoway(ctx: Parameters<CommandDef['run']>[0], body: string, global: string) {
  const plots = splitPlots(body);
  if (!plots.length) throw new StataError('invalid syntax', 198, 'Пример: twoway (scatter Price Gini) (lfit Price Gini)');
  const series: Series[] = [];
  const palette = [COLORS.navy, COLORS.maroon, COLORS.green, COLORS.orange];
  let xt = '';
  let yt = '';
  let slope: number | undefined;
  let yname = '';
  let xname = '';
  const yline: number[] = [];
  for (const [i, pl] of plots.entries()) {
    const ci = topLevelComma(pl);
    const main = ci >= 0 ? pl.slice(0, ci) : pl;
    const toks = tokenize(main).map((t) => t.value);
    const type = plotType(toks[0] ?? '');
    if (!type) throw new StataError(`plottype ${toks[0] ?? ''} not found`, 198, 'Поддерживаются scatter, line и lfit.');
    const vars = ctx.ds.varlist(toks.slice(1));
    if (vars.length !== 2) throw new StataError('too few variables specified', 102, `${type} y x — нужны две переменные: сначала по вертикали (Y), потом по горизонтали (X).`);
    const [yv, xv] = vars;
    const rows = completeRows(ctx, parseArgs('', []), vars);
    const x = rows.map((r) => ctx.ds.num(xv)[r]);
    const y = rows.map((r) => ctx.ds.num(yv)[r]);
    const color = palette[i % palette.length];
    if (type === 'lfit') {
      const l = lfitLine(x, y);
      slope = l.slope;
      series.push({ type: 'line', x: l.x, y: l.y, label: 'Fitted values', color });
    } else if (type === 'line') {
      const idx = x.map((_, k) => k).sort((a, b) => x[a] - x[b]);
      series.push({ type: 'line', x: idx.map((k) => x[k]), y: idx.map((k) => y[k]), label: varTitle(ctx, yv), color });
    } else series.push({ type: 'scatter', x, y, label: varTitle(ctx, yv), color });
    xt ||= varTitle(ctx, xv);
    yt ||= varTitle(ctx, yv);
    yname ||= yv;
    xname ||= xv;
  }
  const yl = global.match(/yline\(([^)]*)\)/);
  if (yl) yline.push(...yl[1].split(/[\s,]+/).filter(Boolean).map(Number));
  ctx.graph({ xtitle: xt, ytitle: plots.length === 1 ? yt : '', series, legend: series.length > 1, yline }, `twoway_${yname}_${xname}`);
  ctx.setData({ kind: 'graph', graph: series.length > 1 ? 'twoway' : 'scatter', x: xname, y: yname, slope });
}

export const twowayCmd: CommandDef = {
  name: 'twoway',
  min: 2,
  args: 'twoway',
  syntax: 'twoway (scatter y x) (lfit y x)',
  summary: 'график: точки и линия регрессии',
  options: [{ name: 'yline', arg: true, help: 'горизонтальная линия' }],
  help: {
    what: 'Строит двумерный график: scatter — точки (облако), lfit — прямая МНК по этим точкам.',
    look: 'Наклон линии: вверх — прямая связь, вниз — обратная. Чем плотнее точки вокруг линии, тем сильнее связь.',
    example: 'twoway (scatter Price Gini) (lfit Price Gini)',
  },
  run(ctx, p) {
    const raw = p.raw;
    const ci = topLevelComma(raw);
    runTwoway(ctx, ci >= 0 ? raw.slice(0, ci) : raw, ci >= 0 ? raw.slice(ci + 1) : '');
  },
};

export const scatterCmd: CommandDef = {
  name: 'scatter',
  min: 2,
  args: 'varlist',
  syntax: 'scatter yvar xvar',
  summary: 'диаграмма рассеяния',
  options: [{ name: 'yline', arg: true, help: 'горизонтальная линия' }],
  help: { what: 'Точечный график: каждая точка — одно наблюдение.', look: 'Есть ли наклон облака, выбросы, нелинейность.', example: 'scatter Price Gini' },
  run(ctx, p) {
    const raw = p.raw;
    const ci = topLevelComma(raw);
    runTwoway(ctx, 'scatter ' + (ci >= 0 ? raw.slice(0, ci) : raw), ci >= 0 ? raw.slice(ci + 1) : '');
  },
};
