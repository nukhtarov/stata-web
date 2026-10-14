import { StataError } from '../../data/dataset';
import { importExcel } from '../../data/excel';
import type { CommandDef } from '../command';
import { tokenize } from '../tokenizer';

export const importCmd: CommandDef = {
  name: 'import excel',
  min: 6,
  args: 'path',
  syntax: 'import excel "файл.xlsx" [, sheet("лист") firstrow clear]',
  summary: 'загрузить данные из Excel',
  options: [
    { name: 'sheet', arg: true, help: 'лист книги, по умолчанию первый' },
    { name: 'firstrow', help: 'первая строка — имена переменных' },
    { name: 'clear', help: 'заменить данные в памяти' },
    { name: 'cellrange', arg: true, help: 'диапазон ячеек (игнорируется)' },
    { name: 'allstring', help: 'все переменные как текст (игнорируется)' },
  ],
  help: {
    what: 'Загружает лист Excel в память. Браузер не видит пути на диске, поэтому откроется окно выбора файла (или будет взят файл, уже открытый кнопкой «Открыть Excel» с тем же именем).',
    look: 'После загрузки посмотрите describe: все ли нужные переменные числовые (double/byte/int), а не текстовые (str#).',
    example: 'import excel "Dataset.xlsx", sheet("Лист1") firstrow clear',
  },
  async run(ctx, p) {
    let main = p.main.replace(/^using\s+/, '');
    const t = tokenize(main);
    const path = t[0]?.type === 'str' ? t[0].value : main.trim();
    if (!ctx.ds.empty && !p.opts.has('clear'))
      throw new StataError('no; data in memory would be lost', 4, 'В памяти уже есть данные. Добавьте опцию clear: import excel "…", firstrow clear');
    const file = await ctx.requestFile(path);
    if (!file) throw new StataError(`file ${path || '?'} not found`, 601, 'Файл не выбран. Нажмите «Открыть Excel» или перетащите .xlsx на страницу.');
    const sheet = p.opts.get('sheet');
    const r = await importExcel(ctx.ds, file.data, { sheet: typeof sheet === 'string' ? sheet.replace(/^"|"$/g, '') : undefined, firstrow: p.opts.has('firstrow') }, file.name);
    ctx.setEst(null);
    ctx.residVars.clear();
    ctx.print(`(${r.nvars} vars, ${r.nobs} obs)`);
    ctx.setData({ kind: 'import', nvars: r.nvars, nobs: r.nobs, commaNumeric: r.commaNumeric });
  },
};
