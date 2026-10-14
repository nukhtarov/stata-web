import { linktest } from '../../stats/tests';
import type { CommandDef } from '../command';
import { regressTable } from '../render';
import { requireEst } from './_util';

export const linktestCmd: CommandDef = {
  name: 'linktest',
  min: 8,
  args: 'none',
  syntax: 'linktest',
  summary: 'тест спецификации (форма модели, П1)',
  help: {
    what: 'Строит вспомогательную регрессию зависимой переменной на прогноз (_hat) и квадрат прогноза (_hatsq). Если модель задана правильно, квадрат прогноза ничего не добавляет.',
    look: 'Смотрите только строку _hatsq: P>|t| ≥ 0,05 — хорошо (форма модели верна). Шапку (R², F) не смотрите — это вспомогательная регрессия.',
  },
  run(ctx) {
    const est = requireEst(ctx);
    const lt = linktest(est.m);
    ctx.print(regressTable(lt));
    // исходная модель остаётся в e() — как в Stata
    ctx.setData({ kind: 'linktest', m: lt });
  },
};
