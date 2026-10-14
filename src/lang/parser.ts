// Разбор строки команды: префикс capture, имя команды с сокращениями, if/in, опции.
import { StataError } from '../data/dataset';
import { tokenize, type Token } from './tokenizer';

export interface OptionDef {
  name: string;
  /** минимальная длина сокращения */
  min?: number;
  /** опция принимает аргумент в скобках */
  arg?: boolean;
  /** короткая подсказка на русском */
  help: string;
}

export interface Parsed {
  /** исходный текст команды */
  raw: string;
  /** текст после имени команды до `if`/`in`/`,` */
  main: string;
  mainTokens: Token[];
  /** опции: каноническое имя → аргумент (или true) */
  opts: Map<string, string | true>;
  ifExpr?: string;
  inRange?: [number, number];
}

/** Индекс запятой верхнего уровня (вне скобок и кавычек) */
export function topLevelComma(s: string): number {
  let depth = 0;
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') inStr = !inStr;
    if (inStr) continue;
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) return i;
  }
  return -1;
}

/** Разбить строку опций на элементы name или name(arg) */
export function splitOptions(s: string): { name: string; arg?: string }[] {
  const out: { name: string; arg?: string }[] = [];
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /[\s,]/.test(s[i])) i++;
    if (i >= s.length) break;
    let name = '';
    while (i < s.length && /[A-Za-z0-9_]/.test(s[i])) name += s[i++];
    if (!name) throw new StataError('invalid syntax', 198);
    while (i < s.length && s[i] === ' ') i++;
    if (s[i] === '(') {
      let depth = 0;
      let arg = '';
      let inStr = false;
      for (; i < s.length; i++) {
        const c = s[i];
        if (c === '"') inStr = !inStr;
        if (!inStr && c === '(') {
          depth++;
          if (depth === 1) continue;
        }
        if (!inStr && c === ')') {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
        arg += c;
      }
      out.push({ name, arg: arg.trim() });
    } else out.push({ name });
  }
  return out;
}

export function matchOption(name: string, defs: OptionDef[]): OptionDef | undefined {
  return defs.find((d) => name === d.name || (name.length >= (d.min ?? d.name.length) && d.name.startsWith(name)));
}

export function parseArgs(rest: string, optDefs: OptionDef[], allowIfIn = true): Parsed {
  const ci = topLevelComma(rest);
  let main = ci >= 0 ? rest.slice(0, ci) : rest;
  const optStr = ci >= 0 ? rest.slice(ci + 1) : '';
  const opts = new Map<string, string | true>();
  for (const o of splitOptions(optStr)) {
    const def = matchOption(o.name, optDefs);
    if (!def) throw new StataError(`option ${o.name} not allowed`, 198, optDefs.length ? `Допустимые опции: ${optDefs.map((d) => d.name + (d.arg ? '()' : '')).join(', ')}.` : 'У этой команды нет опций.');
    if (def.arg && o.arg === undefined) throw new StataError(`option ${def.name}() requires an argument`, 198);
    opts.set(def.name, o.arg ?? true);
  }
  let ifExpr: string | undefined;
  let inRange: [number, number] | undefined;
  if (allowIfIn) {
    const mIn = main.match(/(^|\s)in\s+(-?\d+|f)(?:\s*\/\s*(-?\d+|l))?\s*(?=$|\sif\s)/);
    if (mIn) {
      const a = mIn[2] === 'f' ? 1 : parseInt(mIn[2], 10);
      const b = mIn[3] === undefined ? a : mIn[3] === 'l' ? -1 : parseInt(mIn[3], 10);
      inRange = [a, b];
      main = main.slice(0, mIn.index) + ' ' + main.slice(mIn.index! + mIn[0].length);
    }
    const mIf = main.match(/(^|\s)if\s+/);
    if (mIf) {
      ifExpr = main.slice(mIf.index! + mIf[0].length).trim();
      main = main.slice(0, mIf.index);
      const mIn2 = ifExpr.match(/\s+in\s+(-?\d+|f)(?:\s*\/\s*(-?\d+|l))?\s*$/);
      if (mIn2) {
        const a = mIn2[1] === 'f' ? 1 : parseInt(mIn2[1], 10);
        const b = mIn2[2] === undefined ? a : mIn2[2] === 'l' ? -1 : parseInt(mIn2[2], 10);
        inRange = [a, b];
        ifExpr = ifExpr.slice(0, mIn2.index);
      }
    }
  }
  main = main.trim();
  return { raw: rest, main, mainTokens: tokenize(main), opts, ifExpr, inRange };
}

/** Слова основной части (имена переменных и т. п.) */
export function words(p: Parsed): string[] {
  return p.mainTokens.map((t) => t.value);
}
