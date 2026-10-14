import { StataError } from '../../data/dataset';
import { abbrev, abbrevMid, fmtF, padL } from '../../stats/format';
import { correlate, corrSig } from '../../stats/summary';
import type { CommandDef } from '../command';
import { completeRows, noObs, pick, selectRows, varlistOrAll } from './_util';

export const pwcorrCmd: CommandDef = {
  name: 'pwcorr',
  min: 6,
  args: 'varlist',
  ifin: true,
  syntax: 'pwcorr [varlist] [if] [in] [, obs sig star(#) print(#) bonferroni sidak listwise]',
  summary: 'попарные корреляции со значимостью',
  options: [
    { name: 'obs', min: 1, help: 'число наблюдений в каждой паре' },
    { name: 'sig', min: 2, help: 'p-значения коэффициентов' },
    { name: 'star', min: 2, arg: true, help: 'звёздочка при p ≤ #, например star(0.05)' },
    { name: 'print', min: 1, arg: true, help: 'показывать только коэффициенты с p ≤ #' },
    { name: 'bonferroni', min: 1, help: 'поправка Бонферрони' },
    { name: 'sidak', min: 2, help: 'поправка Шидака' },
    { name: 'listwise', min: 4, help: 'только наблюдения без пропусков во всех переменных' },
    { name: 'casewise', min: 4, help: 'то же, что listwise' },
  ],
  help: {
    what: 'Коэффициенты корреляции Пирсона для каждой пары переменных. В отличие от correlate, каждая пара считается по своим наблюдениям без пропусков, и можно показать значимость (sig) и звёздочки (star).',
    look: 'Первый столбец — связь каждого фактора с зависимой. Звёздочка — коэффициент значимо отличается от нуля. Между факторами |r| > 0,7–0,8 — признак мультиколлинеарности.',
    example: 'pwcorr Price Gini HOR URate, star(0.05)',
  },
  run(ctx, p) {
    const names = varlistOrAll(ctx, p).filter((n) => ctx.ds.get(n).kind === 'num');
    if (!names.length) throw new StataError('no variables', 102);
    const num = (o: string) => {
      const v = p.opts.get(o);
      if (v === undefined) return undefined;
      const x = Number(String(v).replace(/^"|"$/g, ''));
      if (!Number.isFinite(x)) throw new StataError(`option ${o}() incorrectly specified`, 198, `Укажите уровень значимости числом: ${o}(0.05)`);
      return x;
    };
    const star = num('star');
    const print = num('print');
    const showObs = p.opts.has('obs');
    const showSig = p.opts.has('sig');
    const bon = p.opts.has('bonferroni');
    const sidak = p.opts.has('sidak');
    const listwise = p.opts.has('listwise') || p.opts.has('casewise');

    const base = listwise ? completeRows(ctx, p, names) : selectRows(ctx, p);
    if (!base.length) noObs();
    const data = names.map((n) => pick(ctx.ds.num(n), base));
    const k = names.length;
    const R: number[][] = Array.from({ length: k }, () => new Array(k).fill(NaN));
    const P: number[][] = Array.from({ length: k }, () => new Array(k).fill(NaN));
    const Nm: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
    const npairs = (k * (k - 1)) / 2;
    for (let i = 0; i < k; i++)
      for (let j = 0; j <= i; j++) {
        const idx = base.map((_, t) => t).filter((t) => !Number.isNaN(data[i][t]) && !Number.isNaN(data[j][t]));
        const n = idx.length;
        const r = n > 1 ? correlate([idx.map((t) => data[i][t]), idx.map((t) => data[j][t])])[1][0] : NaN;
        let pv = i === j ? NaN : corrSig(r, n);
        if (bon) pv = Math.min(1, pv * npairs);
        else if (sidak) pv = Math.min(1, 1 - (1 - pv) ** npairs);
        R[i][j] = R[j][i] = i === j && n > 0 ? 1 : r;
        P[i][j] = P[j][i] = pv;
        Nm[i][j] = Nm[j][i] = n;
      }

    const per = 7;
    const L: string[] = [''];
    for (let b = 0; b < k; b += per) {
      const blk = names.slice(b, b + per);
      L.push('             |' + blk.map((n) => padL(abbrevMid(n, 8), 9)).join(''));
      L.push('-------------+' + '-'.repeat(9 * blk.length));
      for (let i = b; i < k; i++) {
        const hi = Math.min(b + per, i + 1);
        let line = padL(abbrev(names[i]), 12) + ' |';
        let sig = '             |';
        let obs = '             |';
        let prevStar = false;
        for (let j = b; j < hi; j++) {
          const shown = i === j || print === undefined || P[i][j] <= print;
          let cell = shown ? padL(fmtF(R[i][j], 4), 9) : ' '.repeat(9);
          if (prevStar) cell = '*' + cell.slice(1);
          prevStar = shown && i !== j && star !== undefined && P[i][j] <= star;
          line += cell;
          sig += i === j || !shown ? ' '.repeat(9) : padL(fmtF(P[i][j], 4), 9);
          obs += shown ? padL(String(Nm[i][j]), 9) : ' '.repeat(9);
        }
        L.push((line + (prevStar ? '*' : ' ')).trimEnd());
        if (showSig) L.push(sig.trimEnd());
        if (showObs) L.push(obs.trimEnd());
        if (showSig || showObs) L.push('             |');
      }
      if (b + per < k) L.push('');
    }
    ctx.print(L.join('\n'));
    const minN = Math.min(...Nm.flat());
    ctx.setData({ kind: 'correlate', names, R, N: minN, P, star, pairwise: !listwise });
  },
};
