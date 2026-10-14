import { StataError, numericType, defaultFormat } from '../../data/dataset';
import type { CommandDef } from '../command';
import { words } from '../parser';

export const destringCmd: CommandDef = {
  name: 'destring',
  min: 8,
  args: 'varlist',
  syntax: 'destring varlist, replace [dpcomma ignore("chars")]',
  summary: 'текст → число',
  options: [
    { name: 'replace', help: 'заменить исходные переменные' },
    { name: 'dpcomma', help: 'запятая — десятичный разделитель' },
    { name: 'ignore', arg: true, help: 'игнорировать символы' },
  ],
  help: {
    what: 'Переводит текстовую переменную (str) в числовую. Если в Excel числа записаны с запятой (1234,5), добавьте dpcomma.',
    look: 'Сообщение «contains nonnumeric characters; no replace» — в столбце есть не-числа (буквы, пробелы). Проверьте list.',
    example: 'destring Price, replace dpcomma',
  },
  run(ctx, p) {
    if (!p.opts.has('replace')) throw new StataError('must specify either generate or replace option', 198, 'Добавьте опцию replace: destring X, replace');
    const names = ctx.ds.varlist(words(p));
    const dp = p.opts.has('dpcomma');
    const ign = p.opts.get('ignore');
    const ignore = typeof ign === 'string' ? ign.replace(/^"|"$/g, '') : '';
    const L: string[] = [];
    for (const n of names) {
      const v = ctx.ds.get(n);
      if (v.kind === 'num') {
        L.push(`${n} already numeric; no replace`);
        continue;
      }
      const out: number[] = [];
      let bad = false;
      for (const raw of v.data) {
        let s = raw.trim();
        for (const ch of ignore) s = s.split(ch).join('');
        if (dp) s = s.replace(/\./g, '').replace(',', '.');
        if (s === '' || s === '.') {
          out.push(NaN);
          continue;
        }
        if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) {
          bad = true;
          break;
        }
        out.push(Number(s));
      }
      if (bad) {
        L.push(`${n}: contains nonnumeric characters; no replace`);
        continue;
      }
      const t = numericType(out);
      const idx = ctx.ds.vars.indexOf(v);
      ctx.ds.vars[idx] = { name: v.name, label: v.label, kind: 'num', type: t, format: defaultFormat(t), data: out };
      ctx.ds.changed = true;
      L.push(`${n}: all characters numeric; replaced as ${t}`);
    }
    ctx.print(L.join('\n'));
  },
};
