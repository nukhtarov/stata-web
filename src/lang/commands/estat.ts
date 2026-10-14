import { StataError } from '../../data/dataset';
import { fmtF, padL } from '../../stats/format';
import { hettest, imtest } from '../../stats/tests';
import type { CommandDef } from '../command';
import { words, type OptionDef } from '../parser';
import { requireEst } from './_util';

export const ESTAT_SUBS: { name: string; min: number; summary: string; options: OptionDef[] }[] = [
  { name: 'hettest', min: 4, summary: 'тест Бройша–Пагана на гетероскедастичность (П4)', options: [] },
  { name: 'imtest', min: 3, summary: 'IM-тест Камерона–Триведи (П4, П5)', options: [{ name: 'white', help: 'классический тест Уайта' }] },
];

export const estatCmd: CommandDef = {
  name: 'estat',
  min: 5,
  args: 'sub',
  syntax: 'estat hettest | estat imtest [, white]',
  summary: 'проверки после регрессии',
  options: [{ name: 'white', help: 'тест Уайта (для imtest)' }],
  help: {
    what: 'estat hettest — тест Бройша–Пагана: одинаков ли разброс остатков (гомоскедастичность). estat imtest — разложение IM-теста: гетероскедастичность, асимметрия и эксцесс остатков.',
    look: 'Для всех проверок: p ≥ 0,05 — хорошо, предпосылка выполнена.',
  },
  run(ctx, p) {
    const est = requireEst(ctx);
    const [sub] = words(p);
    const def = ESTAT_SUBS.find((s) => sub && sub.length >= s.min && s.name.startsWith(sub));
    if (!def) throw new StataError(`invalid subcommand ${sub ?? ''}`, 321, 'Доступно: estat hettest, estat imtest.');
    if (def.name === 'hettest') {
      if (p.opts.size) throw new StataError(`option ${[...p.opts.keys()][0]} not allowed`, 198);
      const r = hettest(est.m);
      ctx.print(
        [
          'Breusch-Pagan / Cook-Weisberg test for heteroskedasticity ',
          '         Ho: Constant variance',
          `         Variables: fitted values of ${r.depvar}`,
          '',
          `         chi2(${r.df})      = ${fmtF(r.chi2, 2).padStart(8)}`,
          `         Prob > chi2  = ${fmtF(r.p, 4).padStart(8)}`,
        ].join('\n'),
      );
      ctx.setData({ kind: 'hettest', ...r });
      return;
    }
    const r = imtest(est.m);
    const white = p.opts.has('white');
    const L: string[] = [];
    if (white) {
      L.push("White's test for Ho: homoskedasticity");
      L.push('         against Ha: unrestricted heteroskedasticity');
      L.push('');
      L.push(`         chi2(${r.het.df})     = ${fmtF(r.het.chi2, 2).padStart(9)}`);
      L.push(`         Prob > chi2  = ${fmtF(r.het.p, 4).padStart(9)}`);
      L.push('');
    }
    L.push("Cameron & Trivedi's decomposition of IM-test");
    L.push('');
    L.push('---------------------------------------------------');
    L.push('              Source |       chi2     df      p');
    L.push('---------------------+-----------------------------');
    const row = (n: string, x: { chi2: number; df: number; p: number }) =>
      padL(n, 20) + ' |' + padL(fmtF(x.chi2, 2), 11) + padL(String(x.df), 7) + padL(fmtF(x.p, 4), 10);
    L.push(row('Heteroskedasticity', r.het));
    L.push(row('Skewness', r.skew));
    L.push(row('Kurtosis', r.kurt));
    L.push('---------------------+-----------------------------');
    L.push(row('Total', r.total));
    L.push('---------------------------------------------------');
    ctx.print(L.join('\n'));
    ctx.setData({ kind: 'imtest', ...r, white });
  },
};
