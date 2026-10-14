// Выражения для generate/replace: + - * / ^, сравнения, & | !, функции, missing.
import { Dataset, StataError } from '../data/dataset';

type Node =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'var'; name: string }
  | { t: 'un'; op: string; a: Node }
  | { t: 'bin'; op: string; a: Node; b: Node }
  | { t: 'call'; fn: string; args: Node[] };

interface Tok {
  k: 'num' | 'id' | 'op' | 'str' | '(' | ')' | ',';
  v: string;
}

function lex(s: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] ?? ''))) {
      const m = s.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i)!;
      out.push({ k: 'num', v: m[0] });
      i += m[0].length;
      continue;
    }
    if (c === '.') {
      out.push({ k: 'num', v: '.' });
      i++;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = s.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/)!;
      out.push({ k: 'id', v: m[0] });
      i += m[0].length;
      continue;
    }
    if (c === '"') {
      const e = s.indexOf('"', i + 1);
      if (e < 0) throw new StataError('unmatched quote', 198);
      out.push({ k: 'str', v: s.slice(i + 1, e) });
      i = e + 1;
      continue;
    }
    if (c === '(' || c === ')' || c === ',') {
      out.push({ k: c, v: c });
      i++;
      continue;
    }
    const two = s.slice(i, i + 2);
    if (['==', '!=', '~=', '>=', '<='].includes(two)) {
      out.push({ k: 'op', v: two === '~=' ? '!=' : two });
      i += 2;
      continue;
    }
    if ('+-*/^<>&|!~'.includes(c)) {
      out.push({ k: 'op', v: c === '~' ? '!' : c });
      i++;
      continue;
    }
    if (c === '=') throw new StataError('invalid syntax', 198, 'Для сравнения в Stata используется двойное равенство: ==');
    throw new StataError(`${c} invalid name`, 198);
  }
  return out;
}

// приоритеты: | < & < сравнения < + - < * / < унарные < ^
const BIN: Record<string, number> = { '|': 1, '&': 2, '==': 3, '!=': 3, '<': 3, '>': 3, '<=': 3, '>=': 3, '+': 4, '-': 4, '*': 5, '/': 5, '^': 7 };

export function parseExpr(src: string): Node {
  const toks = lex(src);
  let p = 0;
  const peek = () => toks[p];
  const fail = (): never => {
    throw new StataError('invalid syntax', 198, 'Проверьте выражение: скобки, знаки операций и имена переменных.');
  };

  function primary(): Node {
    const t = toks[p++];
    if (!t) fail();
    if (t.k === 'num') return { t: 'num', v: t.v === '.' ? NaN : Number(t.v) };
    if (t.k === 'str') return { t: 'str', v: t.v };
    if (t.k === '(') {
      const e = expr(0);
      if (toks[p++]?.k !== ')') fail();
      return e;
    }
    if (t.k === 'id') {
      if (peek()?.k === '(') {
        p++;
        const args: Node[] = [];
        if (peek()?.k !== ')') {
          args.push(expr(0));
          while (peek()?.k === ',') {
            p++;
            args.push(expr(0));
          }
        }
        if (toks[p++]?.k !== ')') fail();
        return { t: 'call', fn: t.v, args };
      }
      return { t: 'var', name: t.v };
    }
    if (t.k === 'op' && (t.v === '-' || t.v === '!' || t.v === '+')) {
      // унарный минус связывает слабее ^: -2^2 = -4
      const a = expr(6);
      return t.v === '+' ? a : { t: 'un', op: t.v, a };
    }
    return fail();
  }

  function expr(minPrec: number): Node {
    let left = primary();
    for (;;) {
      const t = peek();
      if (!t || t.k !== 'op' || !(t.v in BIN)) break;
      const prec = BIN[t.v];
      if (prec < minPrec) break;
      p++;
      // ^ в Stata левоассоциативна: 2^3^2 = 64
      const right = expr(prec + 1);
      left = { t: 'bin', op: t.v, a: left, b: right };
    }
    return left;
  }

  const e = expr(0);
  if (p < toks.length) fail();
  return e;
}

type Val = number | string;

const FUNCS: Record<string, (...a: number[]) => number> = {
  ln: (x) => (x > 0 ? Math.log(x) : NaN),
  log: (x) => (x > 0 ? Math.log(x) : NaN),
  log10: (x) => (x > 0 ? Math.log10(x) : NaN),
  exp: Math.exp,
  sqrt: (x) => (x >= 0 ? Math.sqrt(x) : NaN),
  abs: Math.abs,
  int: Math.trunc,
  floor: Math.floor,
  ceil: Math.ceil,
  round: (x, y = 1) => Math.round(x / y) * y,
  sign: Math.sign,
  sin: Math.sin,
  cos: Math.cos,
  min: (...a) => {
    const v = a.filter((x) => !Number.isNaN(x));
    return v.length ? Math.min(...v) : NaN;
  },
  max: (...a) => {
    const v = a.filter((x) => !Number.isNaN(x));
    return v.length ? Math.max(...v) : NaN;
  },
  missing: (...a) => (a.some((x) => Number.isNaN(x)) ? 1 : 0),
};

export interface Compiled {
  eval(i: number): Val;
  isString: boolean;
  vars: string[];
}

export function compileExpr(src: string, ds: Dataset): Compiled {
  const ast = parseExpr(src);
  const vars: string[] = [];
  const N = ds.N;

  const cmp = (op: string, a: Val, b: Val): number => {
    if (typeof a === 'number' && typeof b === 'number') {
      // missing больше любого числа
      const x = Number.isNaN(a) ? Infinity : a;
      const y = Number.isNaN(b) ? Infinity : b;
      if (Number.isNaN(a) && Number.isNaN(b)) return op === '==' || op === '<=' || op === '>=' ? 1 : 0;
      switch (op) {
        case '==':
          return x === y ? 1 : 0;
        case '!=':
          return x !== y ? 1 : 0;
        case '<':
          return x < y ? 1 : 0;
        case '>':
          return x > y ? 1 : 0;
        case '<=':
          return x <= y ? 1 : 0;
        default:
          return x >= y ? 1 : 0;
      }
    }
    if (typeof a !== typeof b) throw new StataError('type mismatch', 109);
    const r = (a as string).localeCompare(b as string);
    return { '==': r === 0, '!=': r !== 0, '<': r < 0, '>': r > 0, '<=': r <= 0, '>=': r >= 0 }[op] ? 1 : 0;
  };

  function build(n: Node): (i: number) => Val {
    switch (n.t) {
      case 'num':
        return () => n.v;
      case 'str':
        return () => n.v;
      case 'var': {
        if (n.name === '_n') return (i) => i + 1;
        if (n.name === '_N') return () => N;
        if (n.name === '_pi') return () => Math.PI;
        const name = ds.resolve(n.name);
        vars.push(name);
        const v = ds.get(name);
        const d = v.data;
        return (i) => d[i];
      }
      case 'un': {
        const a = build(n.a);
        if (n.op === '-')
          return (i) => {
            const x = a(i);
            if (typeof x !== 'number') throw new StataError('type mismatch', 109);
            return -x;
          };
        return (i) => {
          const x = a(i);
          return x === 0 ? 1 : 0;
        };
      }
      case 'bin': {
        const a = build(n.a);
        const b = build(n.b);
        const op = n.op;
        return (i) => {
          const x = a(i);
          const y = b(i);
          if (op in { '==': 1, '!=': 1, '<': 1, '>': 1, '<=': 1, '>=': 1 }) return cmp(op, x, y);
          if (op === '&') return x !== 0 && y !== 0 ? 1 : 0;
          if (op === '|') return x !== 0 || y !== 0 ? 1 : 0;
          if (typeof x === 'string' || typeof y === 'string') {
            if (op === '+' && typeof x === 'string' && typeof y === 'string') return x + y;
            throw new StataError('type mismatch', 109);
          }
          if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
          switch (op) {
            case '+':
              return x + y;
            case '-':
              return x - y;
            case '*':
              return x * y;
            case '/':
              return y === 0 ? NaN : x / y;
            default: {
              const r = Math.pow(x, y);
              return Number.isFinite(r) ? r : NaN;
            }
          }
        };
      }
      case 'call': {
        const f = FUNCS[n.fn];
        if (!f) throw new StataError(`unknown function ${n.fn}()`, 133, 'Доступные функции: ln(), log(), exp(), sqrt(), abs(), round(), int(), min(), max().');
        const args = n.args.map(build);
        if (!['min', 'max', 'missing', 'round'].includes(n.fn) && args.length !== 1) throw new StataError('invalid syntax', 198);
        return (i) => {
          const v = args.map((g) => g(i));
          if (v.some((x) => typeof x !== 'number')) throw new StataError('type mismatch', 109);
          const nums = v as number[];
          if (n.fn !== 'missing' && n.fn !== 'min' && n.fn !== 'max' && nums.some(Number.isNaN)) return NaN;
          const r = f(...nums);
          return Number.isFinite(r) ? r : NaN;
        };
      }
    }
  }

  const f = build(ast);
  const probe = N > 0 ? f(0) : 0;
  return { eval: f, isString: typeof probe === 'string', vars };
}
