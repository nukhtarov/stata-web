import { StataError } from '../../data/dataset';
import { abbrevMid, fmtF, padL, abbrev } from '../../stats/format';
import { correlate } from '../../stats/summary';
import type { CommandDef } from '../command';
import { completeRows, noObs, pick, varlistOrAll } from './_util';

export const correlateCmd: CommandDef = {
  name: 'correlate',
  min: 3,
  args: 'varlist',
  ifin: true,
  syntax: 'correlate [varlist] [if] [in]',
  summary: 'корреляционная матрица',
  help: {
    what: 'Коэффициенты корреляции Пирсона между всеми парами переменных (от −1 до 1). Используются только наблюдения без пропусков во всех переменных.',
    look: 'Первый столбец — связь каждого фактора с зависимой переменной. Между факторами корреляция выше 0,7–0,8 — признак мультиколлинеарности.',
  },
  run(ctx, p) {
    const names = varlistOrAll(ctx, p).filter((n) => ctx.ds.get(n).kind === 'num');
    if (!names.length) throw new StataError('no variables', 102);
    const rows = completeRows(ctx, p, names);
    if (!rows.length) noObs();
    const cols = names.map((n) => pick(ctx.ds.num(n), rows));
    const R = correlate(cols);
    const per = 7;
    const L: string[] = [`(obs=${rows.length})`, ''];
    for (let b = 0; b < names.length; b += per) {
      const blk = names.slice(b, b + per);
      L.push('             |' + blk.map((n) => padL(abbrevMid(n, 8), 9)).join(''));
      L.push('-------------+' + '-'.repeat(9 * blk.length));
      for (let i = b; i < names.length; i++) {
        let line = padL(abbrev(names[i]), 12) + ' |';
        for (let j = b; j < Math.min(b + per, i + 1); j++) line += padL(fmtF(R[i][j], 4), 9);
        L.push(line);
      }
      if (b + per < names.length) L.push('');
    }
    ctx.print(L.join('\n'));
    ctx.setData({ kind: 'correlate', names, R, N: rows.length });
  },
};
