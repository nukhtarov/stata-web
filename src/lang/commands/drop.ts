import { StataError } from '../../data/dataset';
import type { CommandDef } from '../command';
import { words } from '../parser';

export const dropCmd: CommandDef = {
  name: 'drop',
  min: 4,
  args: 'varlist',
  syntax: 'drop varlist',
  summary: 'удалить переменные',
  help: { what: 'Удаляет переменные из памяти.', look: 'Вывода нет. Если переменной может не быть, используйте capture drop имя.', example: 'capture drop ostatki' },
  run(ctx, p) {
    const w = words(p);
    if (!w.length) throw new StataError('varlist required', 100);
    // drop требует точных имён или шаблонов — сокращения допустимы как в Stata
    const names = ctx.ds.varlist(w);
    ctx.ds.drop(names);
    for (const n of names) ctx.residVars.delete(n);
  },
};
