import type { CommandDef } from '../command';

export const clearCmd: CommandDef = {
  name: 'clear',
  min: 5,
  args: 'none',
  syntax: 'clear',
  summary: 'очистить данные в памяти',
  help: { what: 'Удаляет из памяти все переменные и результаты последней регрессии.', look: 'Вывода нет.' },
  run(ctx) {
    ctx.ds.clear();
    ctx.setEst(null);
    ctx.residVars.clear();
  },
};
