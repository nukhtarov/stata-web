// Импорт Excel по правилам Stata `import excel`.
import { Dataset, StataError, numericType, strType, defaultFormat, strtoname, type Variable } from './dataset';

export interface ImportOptions {
  sheet?: string;
  firstrow?: boolean;
}

export interface ImportResult {
  nvars: number;
  nobs: number;
  /** переменные, похожие на числа с запятой (импортированы как str) */
  commaNumeric: string[];
  sheet: string;
}

/** Excel-буквы столбцов: 0 → A, 26 → AA */
export function colLetter(i: number): string {
  let s = '';
  i += 1;
  while (i > 0) {
    const r = (i - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

export async function sheetNames(data: ArrayBuffer | Uint8Array): Promise<string[]> {
  const XLSX = await import('xlsx');
  return XLSX.read(data, { type: 'array', bookSheets: true }).SheetNames;
}

type Cell = string | number | boolean | Date | null;

export async function importExcel(ds: Dataset, data: ArrayBuffer | Uint8Array, opts: ImportOptions, fileName = ''): Promise<ImportResult> {
  // SheetJS грузится только при первом импорте — отдельный чанк
  const XLSX = await import('xlsx');
  const wb = XLSX.read(data, { type: 'array' });
  let sheet = wb.SheetNames[0];
  if (opts.sheet !== undefined) {
    if (!wb.SheetNames.includes(opts.sheet))
      throw new StataError(
        `worksheet ${opts.sheet} not found`,
        601,
        `В файле есть листы: ${wb.SheetNames.map((s) => `"${s}"`).join(', ')}. Укажите один из них в sheet("…").`,
      );
    sheet = opts.sheet;
  }
  const rows = XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[sheet], { header: 1, raw: true, defval: null, blankrows: false });
  const ncol = rows.reduce((m, r) => Math.max(m, r.length), 0);
  let header: string[] = [];
  let body = rows;
  if (opts.firstrow && rows.length) {
    header = Array.from({ length: ncol }, (_, j) => {
      const c = rows[0][j];
      return c === null || c === undefined ? '' : String(c);
    });
    body = rows.slice(1);
  }
  // удалить хвостовые полностью пустые строки
  while (body.length && body[body.length - 1].every((c) => c === null || c === '')) body = body.slice(0, -1);

  const vars: Variable[] = [];
  const used = new Set<string>();
  const commaNumeric: string[] = [];
  for (let j = 0; j < ncol; j++) {
    const cells = body.map((r) => (j < r.length ? r[j] : null));
    if (opts.firstrow && header[j] === '' && cells.every((c) => c === null || c === '')) continue;
    let name = opts.firstrow && header[j] !== '' ? strtoname(header[j]) : colLetter(j);
    // уникальность
    if (used.has(name)) {
      let n = 1;
      while (used.has(name.slice(0, 30) + '_' + n)) n++;
      name = name.slice(0, 30) + '_' + n;
    }
    used.add(name);
    const label = opts.firstrow ? header[j] : '';
    const isNum = cells.every((c) => c === null || c === '' || typeof c === 'number' || typeof c === 'boolean' || c instanceof Date);
    if (isNum) {
      const d = cells.map((c) =>
        c === null || c === '' ? NaN : typeof c === 'boolean' ? Number(c) : c instanceof Date ? excelDate(c) : (c as number),
      );
      const type = numericType(d);
      vars.push({ name, label, kind: 'num', type, format: defaultFormat(type), data: d });
    } else {
      const d = cells.map((c) => (c === null ? '' : c instanceof Date ? c.toISOString().slice(0, 10) : String(c)));
      const type = strType(d);
      vars.push({ name, label, kind: 'str', type, format: defaultFormat(type), data: d });
      const nonEmpty = d.filter((s) => s.trim() !== '');
      if (nonEmpty.length && nonEmpty.every((s) => /^\s*-?[\d\s]*\d(,\d+)?\s*$/.test(s)) && nonEmpty.some((s) => s.includes(',')))
        commaNumeric.push(name);
    }
  }
  ds.clear();
  ds.vars = vars;
  ds.N = body.length;
  ds.source = fileName;
  return { nvars: vars.length, nobs: body.length, commaNumeric, sheet };
}

/** Дата Excel → число дней Stata (%td, от 01jan1960) */
function excelDate(d: Date): number {
  return Math.round((d.getTime() - Date.UTC(1960, 0, 1)) / 86400000);
}
