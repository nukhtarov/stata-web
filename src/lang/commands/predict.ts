import { StataError } from '../../data/dataset';
import type { CommandDef } from '../command';
import { words } from '../parser';
import { requireEst, selectRows } from './_util';

export const predictCmd: CommandDef = {
  name: 'predict',
  min: 7,
  args: 'newvar',
  ifin: true,
  syntax: 'predict newvar [if] [in] [, xb | residuals]',
  summary: 'прогноз или остатки последней регрессии',
  options: [
    { name: 'xb', help: 'прогноз ŷ (по умолчанию)' },
    { name: 'residuals', min: 5, help: 'остатки e = y − ŷ' },
  ],
  help: {
    what: 'Создаёт новую переменную по последней регрессии: прогноз (xb) или остатки (resid).',
    look: 'Остатки нужны для проверки предпосылок: sum (среднее ≈ 0), kdensity и swilk (нормальность).',
    example: 'predict ostatki, resid',
  },
  run(ctx, p) {
    const est = requireEst(ctx);
    const w = words(p);
    if (w.length !== 1) throw new StataError('invalid syntax', 198, 'Укажите имя новой переменной: predict ostatki, resid');
    const name = w[0];
    if (ctx.ds.has(name)) throw new StataError(`variable ${name} already defined`, 110, `Переменная ${name} уже есть. Удалите её: capture drop ${name} — или выберите другое имя.`);
    const resid = p.opts.has('residuals');
    if (resid && p.opts.has('xb')) throw new StataError('only one statistic may be specified', 198);
    const m = est.m;
    const cols = m.usedNames.map((n) => ctx.ds.num(n));
    const cons = m.coefs[m.coefs.length - 1].b;
    const bs = m.usedNames.map((n) => m.coefs.find((c) => c.name === n)!.b);
    const y = ctx.ds.num(m.depvar);
    // вне if/in — missing, как в Stata
    const inSel = new Array(ctx.ds.N).fill(false);
    for (const i of selectRows(ctx, p)) inSel[i] = true;
    const out = new Array(ctx.ds.N).fill(NaN).map((_, i) => {
      if (!inSel[i]) return NaN;
      let s = cons;
      for (let j = 0; j < cols.length; j++) {
        const v = cols[j][i];
        if (Number.isNaN(v)) return NaN;
        s += bs[j] * v;
      }
      return resid ? y[i] - s : s;
    });
    if (!resid && !p.opts.has('xb')) ctx.print('(option xb assumed; fitted values)');
    ctx.ds.addNum(name, out, 'float');
    const miss = out.filter(Number.isNaN).length;
    if (miss) ctx.print(`(${miss} missing value${miss > 1 ? 's' : ''} generated)`);
    if (resid) ctx.residVars.add(name);
    ctx.setData({ kind: 'predict', name, what: resid ? 'resid' : 'xb' });
  },
};
