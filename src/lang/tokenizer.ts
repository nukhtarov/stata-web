// Токенизатор строки команды Stata.

export type TokType = 'word' | 'num' | 'str' | 'op' | 'comma' | 'lparen' | 'rparen' | 'eq';

export interface Token {
  type: TokType;
  value: string;
  start: number;
  end: number;
}

const WORD = /[A-Za-z_0-9.~*?\-]/;

/** Убрать комментарии `//`, `/* *\/` и строку целиком, если она начинается с `*`. Ведущую `. ` — тоже. */
export function stripComment(line: string): string {
  let s = line.replace(/^\s*\.\s+/, '').replace(/^\s*\.$/, '');
  if (/^\s*\*/.test(s)) return '';
  let out = '';
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') inStr = !inStr;
    if (!inStr && c === '/' && s[i + 1] === '/') break;
    if (!inStr && c === '/' && s[i + 1] === '*') {
      const end = s.indexOf('*/', i + 2);
      if (end < 0) break;
      i = end + 1;
      continue;
    }
    out += c;
  }
  return out.trim();
}

/**
 * Разбить do-файл на команды: комментарии, продолжение строки `///`,
 * блочные комментарии через несколько строк. Возвращает пары [номер строки, команда].
 */
export function splitProgram(text: string): { line: number; text: string }[] {
  const lines = text.split(/\r?\n/);
  const out: { line: number; text: string }[] = [];
  let buf = '';
  let start = 0;
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i];
    if (inBlock) {
      const e = l.indexOf('*/');
      if (e < 0) continue;
      l = l.slice(e + 2);
      inBlock = false;
    }
    const bs = l.indexOf('/*');
    if (bs >= 0 && l.indexOf('*/', bs) < 0 && !/^\s*\*/.test(l)) {
      inBlock = true;
      l = l.slice(0, bs);
    }
    if (!buf) start = i + 1;
    else l = l.trimStart();
    const cont = l.match(/\s\/\/\/.*$|^\/\/\/.*$/);
    if (cont) {
      buf += l.slice(0, cont.index).trimEnd() + ' ';
      continue;
    }
    buf += l;
    const cmd = stripComment(buf);
    buf = '';
    if (cmd) out.push({ line: start, text: cmd });
  }
  if (buf.trim()) {
    const cmd = stripComment(buf);
    if (cmd) out.push({ line: start, text: cmd });
  }
  return out;
}

export function tokenize(s: string): Token[] {
  const toks: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const start = i;
    if (c === '"' || (c === '`' && s[i + 1] === '"')) {
      const compound = c === '`';
      i += compound ? 2 : 1;
      let v = '';
      while (i < s.length && !(s[i] === '"' && (!compound || s[i + 1] === "'"))) v += s[i++];
      i += compound ? 2 : 1;
      toks.push({ type: 'str', value: v, start, end: i });
      continue;
    }
    if (c === ',') {
      toks.push({ type: 'comma', value: ',', start, end: ++i });
      continue;
    }
    if (c === '(') {
      toks.push({ type: 'lparen', value: '(', start, end: ++i });
      continue;
    }
    if (c === ')') {
      toks.push({ type: 'rparen', value: ')', start, end: ++i });
      continue;
    }
    if (c === '=' && s[i + 1] !== '=') {
      toks.push({ type: 'eq', value: '=', start, end: ++i });
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] ?? ''))) {
      const m = s.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i)!;
      i += m[0].length;
      // 1/5 в `in 1/5` — оставляем числом, `/` — оператором
      toks.push({ type: 'num', value: m[0], start, end: i });
      continue;
    }
    if (/[A-Za-z_]/.test(c) || c === '*' || c === '?') {
      let v = '';
      while (i < s.length && WORD.test(s[i])) {
        // `-` внутри слова — только для диапазонов a-b, не перед числом/пробелом в выражении
        if (s[i] === '-' && !/[A-Za-z_]/.test(s[i + 1] ?? '')) break;
        if (s[i] === '.' ) break;
        v += s[i++];
      }
      if (v === '') v = s[i++];
      toks.push({ type: 'word', value: v, start, end: i });
      continue;
    }
    const two = s.slice(i, i + 2);
    if (['==', '!=', '~=', '>=', '<='].includes(two)) {
      toks.push({ type: 'op', value: two, start, end: (i += 2) });
      continue;
    }
    if (c === '.') {
      // missing value
      toks.push({ type: 'num', value: '.', start, end: ++i });
      continue;
    }
    toks.push({ type: 'op', value: c, start, end: ++i });
  }
  return toks;
}
