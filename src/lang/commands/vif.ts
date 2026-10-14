import { StataError } from '../../data/dataset';
import { fmtF } from '../../stats/format';
import { vif } from '../../stats/tests';
import type { CommandDef } from '../command';
import { simpleTable } from '../render';
import { requireEst } from './_util';

export const vifCmd: CommandDef = {
  name: 'vif',
  min: 3,
  args: 'none',
  syntax: 'vif',
  summary: 'мультиколлинеарность (П2)',
  help: {
    what: 'VIF (variance inflation factor) — во сколько раз дисперсия оценки коэффициента раздута из-за того, что фактор похож на другие факторы.',
    look: 'VIF > 10 — сильная мультиколлинеарность. Mean VIF — среднее. √VIF показывает, во сколько раз завышена стандартная ошибка.',
  },
  run(ctx) {
    const est = requireEst(ctx);
    if (est.m.usedNames.length < 2) throw new StataError('not appropriate after regress with fewer than two regressors', 498);
    const r = vif(est.m);
    ctx.print(
      simpleTable(
        'Variable',
        ['VIF', '1/VIF  '],
        [10, 14],
        r.rows.map((x) => ({ name: x.name, cells: [fmtF(x.vif, 2), fmtF(1 / x.vif, 6) + '  '] })),
        { name: 'Mean VIF', cells: [fmtF(r.mean, 2), ''] },
      ),
    );
    ctx.setData({ kind: 'vif', ...r });
  },
};
