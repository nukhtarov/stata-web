import { padR } from '../../stats/format';
import type { CommandDef } from '../command';
import { words } from '../parser';
import { fmtInt } from '../render';

const LINE = '-'.repeat(80);

export const describeCmd: CommandDef = {
  name: 'describe',
  min: 1,
  args: 'varlist',
  syntax: 'describe [varlist]',
  summary: 'список переменных и их типы',
  help: {
    what: 'Показывает число наблюдений и переменных, тип хранения каждой переменной (byte/int/long/float/double — числа, str# — текст) и формат.',
    look: 'Проверьте, что все переменные для регрессии числовые. Если тип str — переменная текстовая, её нужно перевести в числа (destring).',
  },
  run(ctx, p) {
    const ds = ctx.ds;
    const w = words(p);
    const names = w.length ? ds.varlist(w) : ds.names();
    const L: string[] = [];
    if (!w.length) {
      L.push(`Contains data${ds.source ? '' : ''}`);
      L.push(`  obs:${fmtInt(ds.N).padStart(14)}`);
      L.push(` vars:${String(ds.vars.length).padStart(14)}`);
      L.push(` size:${fmtInt(ds.width() * ds.N).padStart(14)}`);
    }
    L.push(LINE);
    L.push('              storage   display    value');
    L.push('variable name   type    format     label      variable label');
    L.push(LINE);
    for (const n of names) {
      const v = ds.get(n);
      L.push(padR(v.name, 15) + ' ' + padR(v.type, 7) + ' ' + padR(v.format, 10) + ' ' + padR('', 10) + ' ' + v.label);
    }
    if (!w.length) {
      L.push(LINE);
      L.push('Sorted by: ');
      if (ds.changed || ds.source) L.push('     Note: Dataset has changed since last saved.');
    }
    ctx.print(L.join('\n'));
    ctx.setData({ kind: 'describe', N: ds.N, k: ds.vars.length });
  },
};
