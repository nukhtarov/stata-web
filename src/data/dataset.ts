// Хранилище переменных. Числовой missing — NaN, строковый — ''.

export type StorageType = 'byte' | 'int' | 'long' | 'float' | 'double' | `str${number}`;

export interface NumVar {
  name: string;
  label: string;
  kind: 'num';
  type: StorageType;
  format: string;
  data: number[];
}

export interface StrVar {
  name: string;
  label: string;
  kind: 'str';
  type: StorageType;
  format: string;
  data: string[];
}

export type Variable = NumVar | StrVar;

export class StataError extends Error {
  constructor(
    message: string,
    public code: number,
    public hint?: string,
  ) {
    super(message);
  }
}

const BYTES: Record<string, number> = { byte: 1, int: 2, long: 4, float: 4, double: 8 };

export function defaultFormat(type: StorageType): string {
  switch (type) {
    case 'byte':
    case 'int':
      return '%8.0g';
    case 'long':
      return '%12.0g';
    case 'float':
      return '%9.0g';
    case 'double':
      return '%10.0g';
    default:
      return `%${Math.max(1, parseInt(type.slice(3), 10))}s`;
  }
}

/** Наименьший целочисленный тип или double — как compress/import excel */
export function numericType(data: number[]): StorageType {
  let allInt = true;
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of data) {
    if (Number.isNaN(v)) continue;
    if (!Number.isInteger(v)) {
      allInt = false;
      break;
    }
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (!allInt) return 'double';
  if (lo === Infinity) return 'byte';
  if (lo >= -127 && hi <= 100) return 'byte';
  if (lo >= -32767 && hi <= 32740) return 'int';
  if (lo >= -2147483647 && hi <= 2147483620) return 'long';
  return 'double';
}

export function strType(data: string[]): StorageType {
  let max = 1;
  for (const s of data) max = Math.max(max, new TextEncoder().encode(s).length);
  return `str${Math.min(max, 2045)}`;
}

const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/;
const RESERVED = new Set([
  '_all', '_b', 'byte', '_coef', '_cons', 'double', 'float', 'if', 'in', 'int', 'long', '_n', '_N', '_pi', '_pred',
  '_rc', '_skip', 'strL', 'using', 'with',
]);

export function isValidName(name: string): boolean {
  return NAME_RE.test(name) && !RESERVED.has(name) && !/^str\d+$/.test(name);
}

/** Stata strtoname(): недопустимые символы → _, имя с цифры → префикс _, обрезка до 32 */
export function strtoname(s: string): string {
  let out = s.replace(/[^A-Za-z0-9_]/g, '_');
  if (out === '') out = '_';
  if (/^[0-9]/.test(out)) out = '_' + out;
  return out.slice(0, 32);
}

export class Dataset {
  vars: Variable[] = [];
  N = 0;
  /** изменён после загрузки */
  changed = false;
  /** имя источника (файл) */
  source = '';

  get empty() {
    return this.vars.length === 0 && this.N === 0;
  }

  clear() {
    this.vars = [];
    this.N = 0;
    this.changed = false;
    this.source = '';
  }

  names(): string[] {
    return this.vars.map((v) => v.name);
  }

  has(name: string) {
    return this.vars.some((v) => v.name === name);
  }

  get(name: string): Variable {
    const v = this.vars.find((x) => x.name === name);
    if (!v) throw new StataError(`variable ${name} not found`, 111);
    return v;
  }

  /** Разрешить имя с учётом сокращений Stata (уникальный префикс) */
  resolve(token: string): string {
    if (this.has(token)) return token;
    const cands = this.vars.filter((v) => v.name.startsWith(token)).map((v) => v.name);
    if (cands.length === 1) return cands[0];
    if (cands.length > 1) throw new StataError(`${token} ambiguous abbreviation`, 111);
    throw new StataError(`variable ${token} not found`, 111, notFoundHint(token, this.names()));
  }

  /** Разрешить список переменных: сокращения, `*`/`?`, диапазоны `a-b`, `_all` */
  varlist(tokens: string[]): string[] {
    const out: string[] = [];
    const names = this.names();
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t === '_all' || t === '*') {
        out.push(...names);
      } else if (/[*?~]/.test(t)) {
        const re = new RegExp('^' + t.replace(/[*~]/g, '.*').replace(/\?/g, '.') + '$');
        const m = names.filter((n) => re.test(n));
        if (!m.length) throw new StataError(`variable ${t} not found`, 111, notFoundHint(t, names));
        out.push(...m);
      } else if (t.includes('-') && !names.includes(t)) {
        const [a, b] = t.split('-');
        const ia = names.indexOf(this.resolve(a));
        const ib = names.indexOf(this.resolve(b));
        if (ib < ia) throw new StataError(`${t}: invalid range`, 198);
        out.push(...names.slice(ia, ib + 1));
      } else {
        out.push(this.resolve(t));
      }
    }
    return out;
  }

  num(name: string): number[] {
    const v = this.get(name);
    if (v.kind !== 'num')
      throw new StataError(
        'type mismatch',
        109,
        `Переменная ${name} — текстовая. Если в ней числа, переведите её в числа: destring ${name}, replace` +
          (v.data.some((s) => /^\s*-?\d+,\d+\s*$/.test(s)) ? ' dpcomma' : ''),
      );
    return v.data;
  }

  addNum(name: string, data: number[], type?: StorageType, label = '') {
    if (this.has(name)) throw new StataError(`variable ${name} already defined`, 110);
    if (!isValidName(name)) throw new StataError(`${name} invalid name`, 198);
    const t = type ?? 'float';
    // float хранится с одинарной точностью — как в Stata (влияет, например, на среднее остатков)
    if (t === 'float') data = data.map((v) => Math.fround(v));
    this.vars.push({ name, label, kind: 'num', type: t, format: defaultFormat(t), data });
    this.changed = true;
  }

  drop(names: string[]) {
    const set = new Set(names);
    this.vars = this.vars.filter((v) => !set.has(v.name));
    if (this.vars.length === 0) this.N = 0;
    this.changed = true;
  }

  rename(from: string, to: string) {
    const v = this.get(from);
    if (this.has(to)) throw new StataError(`variable ${to} already defined`, 110);
    if (!isValidName(to)) throw new StataError(`${to} invalid name`, 198);
    v.name = to;
    this.changed = true;
  }

  /** Размер в байтах, как в describe */
  width(): number {
    return this.vars.reduce((s, v) => s + (BYTES[v.type] ?? parseInt(v.type.slice(3), 10)), 0);
  }

  /** Номера наблюдений без missing во всех переменных (listwise deletion) */
  completeRows(names: string[]): number[] {
    const cols = names.map((n) => this.get(n));
    const rows: number[] = [];
    for (let i = 0; i < this.N; i++) {
      if (cols.every((c) => (c.kind === 'num' ? !Number.isNaN(c.data[i]) : c.data[i] !== ''))) rows.push(i);
    }
    return rows;
  }
}

/** Подсказка «возможно, вы имели в виду» по расстоянию Левенштейна и регистру */
export function notFoundHint(token: string, names: string[]): string | undefined {
  if (!names.length) return 'Данные не загружены. Сначала откройте Excel-файл (кнопка «Открыть Excel» или import excel).';
  const ci = names.find((n) => n.toLowerCase() === token.toLowerCase());
  if (ci) return `Stata различает регистр букв. Правильно: ${ci}`;
  let best = '';
  let bd = Infinity;
  for (const n of names) {
    const d = lev(token.toLowerCase(), n.toLowerCase());
    if (d < bd) {
      bd = d;
      best = n;
    }
  }
  if (bd <= Math.max(2, token.length / 3)) return `Возможно, вы имели в виду ${best}. Проверьте имя в панели Variables.`;
  return 'Проверьте имя в панели Variables слева — щёлкните по нему, чтобы вставить без опечаток.';
}

function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
