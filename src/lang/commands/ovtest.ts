import { fmtF } from '../../stats/format';
import { ovtest } from '../../stats/tests';
import type { CommandDef } from '../command';
import { requireEst } from './_util';

export const ovtestCmd: CommandDef = {
  name: 'ovtest',
  min: 6,
  args: 'none',
  syntax: 'ovtest',
  summary: 'тест Рамсея: пропущенные переменные (П1)',
  help: {
    what: 'Тест Рамсея (RESET): добавляет в модель степени прогноза и проверяет, улучшилась ли она. Если да — в модели не хватает переменных или нелинейности.',
    look: 'Prob > F ≥ 0,05 — хорошо (пропущенных переменных нет).',
  },
  run(ctx) {
    const est = requireEst(ctx);
    const r = ovtest(est.m);
    ctx.print(
      [
        `Ramsey RESET test using powers of the fitted values of ${r.depvar}`,
        '       Ho:  model has no omitted variables',
        `                  F(${r.df1}, ${r.df2}) = ${fmtF(r.F, 2).padStart(9)}`,
        `                  Prob > F = ${fmtF(r.p, 4).padStart(11)}`,
      ].join('\n'),
    );
    ctx.setData({ kind: 'ovtest', ...r });
  },
};
