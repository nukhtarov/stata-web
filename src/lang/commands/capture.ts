import { StataError } from '../../data/dataset';
import type { CommandDef } from '../command';

export const captureCmd: CommandDef = {
  name: 'capture',
  min: 3,
  args: 'command',
  syntax: 'capture command',
  summary: 'выполнить команду, подавив ошибку',
  help: {
    what: 'Выполняет команду и скрывает её вывод и ошибку. Удобно, чтобы do-файл не останавливался, например capture drop ostatki — удалить, если переменная есть.',
    look: 'Вывода нет.',
    example: 'capture drop ostatki',
  },
  async run(ctx, p) {
    if (!p.raw.trim()) throw new StataError('invalid syntax', 198);
    await ctx.exec(p.raw.trim());
  },
};
