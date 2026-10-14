import { fmtG, padL, padR, abbrev } from '../../stats/format';
import type { CommandDef } from '../command';
import { selectRows, varlistOrAll } from './_util';

export const listCmd: CommandDef = {
  name: 'list',
  min: 1,
  args: 'varlist',
  ifin: true,
  syntax: 'list [varlist] [if] [in a/b]',
  summary: 'показать значения',
  options: [{ name: 'clean', help: 'без рамок' }, { name: 'noobs', min: 4, help: 'без номеров наблюдений' }],
  help: { what: 'Печатает значения переменных по наблюдениям.', look: 'Удобно, чтобы глазами проверить данные: list Price Gini in 1/10', example: 'list City Price in 1/5' },
  run(ctx, p) {
    const names = varlistOrAll(ctx, p);
    const rows = selectRows(ctx, p);
    const cols = names.map((n) => {
      const v = ctx.ds.get(n);
      const w = parseInt(v.format.replace(/[^0-9.]/g, ''), 10) || 9;
      const cells = rows.map((i) => (v.kind === 'num' ? fmtG(v.data[i], v.type === 'double' ? 10 : w) : v.data[i]));
      const head = abbrev(n, 12);
      const width = Math.max(head.length, ...cells.map((c) => c.length));
      return { head, cells, width, left: v.kind === 'str' };
    });
    const clean = p.opts.has('clean');
    const noobs = p.opts.has('noobs');
    const numW = String(ctx.ds.N).length + 1;
    const pre = noobs ? '  ' : ' '.repeat(numW + 3);
    const inner = cols.reduce((s, c) => s + c.width + 2, 0) + (cols.length ? 0 : 0);
    const L: string[] = [];
    const fmtRow = (cells: string[]) => cols.map((c, j) => (c.left ? padR(cells[j], c.width) : padL(cells[j], c.width))).join('  ');
    if (clean) {
      L.push(pre + fmtRow(cols.map((c) => c.head)));
      rows.forEach((r, k) => L.push((noobs ? '  ' : padL(`${r + 1}.`, numW + 2) + ' ') + fmtRow(cols.map((c) => c.cells[k]))));
    } else {
      const bar = pre + '+' + '-'.repeat(inner) + '+';
      L.push(bar);
      L.push(pre + '| ' + fmtRow(cols.map((c) => c.head)) + ' |');
      L.push(pre + '|' + '-'.repeat(inner) + '|');
      rows.forEach((r, k) => {
        if (k > 0 && k % 5 === 0) L.push(pre + '|' + '-'.repeat(inner) + '|');
        L.push((noobs ? '  ' : padL(`${r + 1}.`, numW + 2) + ' ') + '| ' + fmtRow(cols.map((c) => c.cells[k])) + ' |');
      });
      L.push(bar);
    }
    ctx.print(L.join('\n'));
  },
};
