import { StataError } from '../../data/dataset';
import type { CommandDef } from '../command';
import { words } from '../parser';

export const renameCmd: CommandDef = {
  name: 'rename',
  min: 3,
  args: 'varlist',
  syntax: 'rename oldname newname',
  summary: 'переименовать переменную',
  help: { what: 'Меняет имя переменной.', look: 'Вывода нет.', example: 'rename Price price' },
  run(ctx, p) {
    const w = words(p);
    if (w.length !== 2) throw new StataError('invalid syntax', 198, 'Формат: rename старое_имя новое_имя');
    const from = ctx.ds.resolve(w[0]);
    ctx.ds.rename(from, w[1]);
    if (ctx.residVars.delete(from)) ctx.residVars.add(w[1]);
  },
};
