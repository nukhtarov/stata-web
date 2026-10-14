import { StataError } from '../../data/dataset';
import { invnormal } from '../../stats/distributions';
import { summarize } from '../../stats/summary';
import type { CommandDef } from '../command';
import { words } from '../parser';
import { COLORS, varTitle } from './_graph';
import { pick, selectRows } from './_util';

export const qnormCmd: CommandDef = {
  name: 'qnorm',
  min: 5,
  args: 'var',
  ifin: true,
  syntax: 'qnorm varname [if] [in]',
  summary: 'квантильный график нормальности (П5)',
  help: {
    what: 'Сравнивает квантили переменной с квантилями нормального распределения с тем же средним и стандартным отклонением. Обычно строится для остатков регрессии.',
    look: 'Если распределение нормальное, точки лежат на прямой. Отклонения на концах (точки загибаются вверх/вниз) — «тяжёлые хвосты» или выбросы; дуга — асимметрия.',
    example: 'qnorm ostatki',
  },
  run(ctx, p) {
    const w = words(p);
    if (w.length !== 1) throw new StataError(w.length ? 'too many variables specified' : 'varlist required', w.length ? 103 : 100, 'qnorm строит график одной переменной: qnorm ostatki');
    const name = ctx.ds.varlist(w)[0];
    if (ctx.ds.get(name).kind !== 'num') throw new StataError(`${name} is a string variable`, 109);
    const x = pick(ctx.ds.num(name), selectRows(ctx, p))
      .filter((v) => !Number.isNaN(v))
      .sort((a, b) => a - b);
    if (x.length < 2) throw new StataError('insufficient observations', 2001);
    const s = summarize(x);
    const N = x.length;
    // ожидаемые квантили: x̄ + s·Φ⁻¹(i/(N+1))
    const q = x.map((_, i) => s.mean + s.sd * invnormal((i + 1) / (N + 1)));
    const lo = Math.min(q[0], x[0]);
    const hi = Math.max(q[N - 1], x[N - 1]);
    ctx.graph(
      {
        xtitle: 'Inverse Normal',
        ytitle: varTitle(ctx, name),
        series: [
          { type: 'scatter', x: q, y: x, label: varTitle(ctx, name), color: COLORS.navy },
          { type: 'line', x: [lo, hi], y: [lo, hi], label: 'Inverse Normal', color: COLORS.maroon },
        ],
        legend: false,
      },
      `qnorm_${name}`,
    );
    ctx.setData({ kind: 'graph', graph: 'qnorm', x: name });
  },
};
