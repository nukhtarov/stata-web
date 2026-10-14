import { StataError, isValidName, strType, defaultFormat } from '../../data/dataset';
import type { CommandDef, Ctx } from '../command';
import { compileExpr } from '../expr';
import type { Parsed } from '../parser';
import { selectRows } from './_util';

const TYPES = ['byte', 'int', 'long', 'float', 'double'];

/** "newvar = expr" → [имя, выражение, тип] */
function splitAssign(p: Parsed): [string, string, string | undefined] {
  const m = p.main.match(/^\s*(?:(byte|int|long|float|double|str\d+)\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)\s*(.+)$/s);
  if (!m) throw new StataError('invalid syntax', 198, 'Формат: gen новая_переменная = выражение, например gen lnPrice = ln(Price)');
  return [m[2], m[3], m[1]];
}

function evalRows(ctx: Ctx, p: Parsed, expr: string) {
  const e = compileExpr(expr, ctx.ds);
  const rows = new Set(selectRows(ctx, p));
  return { e, rows };
}

export const generateCmd: CommandDef = {
  name: 'generate',
  min: 1,
  args: 'assign',
  ifin: true,
  syntax: 'generate newvar = exp [if] [in]',
  summary: 'создать переменную',
  help: {
    what: 'Создаёт новую переменную по формуле. Операции: + − * / ^, скобки, функции ln(), exp(), sqrt(), abs(). Если в формуле пропуск — результат тоже пропуск (.).',
    look: 'Сообщение «(N missing values generated)» — у N наблюдений результат не определён (пропуск, логарифм ≤ 0 и т. п.).',
    example: 'gen lnPrice = ln(Price)',
  },
  run(ctx, p) {
    if (ctx.ds.vars.length === 0 && ctx.ds.N === 0) throw new StataError('no observations', 2000, 'Сначала загрузите данные.');
    const [name, expr, type] = splitAssign(p);
    if (ctx.ds.has(name)) throw new StataError(`variable ${name} already defined`, 110, `Переменная ${name} уже существует. Используйте replace ${name} = … или другое имя.`);
    if (!isValidName(name)) throw new StataError(`${name} invalid name`, 198);
    const { e, rows } = evalRows(ctx, p, expr);
    const N = ctx.ds.N;
    if (e.isString || type?.startsWith('str')) {
      const d = Array.from({ length: N }, (_, i) => (rows.has(i) ? String(e.eval(i)) : ''));
      const t = strType(d);
      ctx.ds.vars.push({ name, label: '', kind: 'str', type: t, format: defaultFormat(t), data: d });
      ctx.ds.changed = true;
      return;
    }
    const t = (type && TYPES.includes(type) ? type : 'float') as 'float';
    const d = Array.from({ length: N }, (_, i) => (rows.has(i) ? (e.eval(i) as number) : NaN));
    ctx.ds.addNum(name, d, t);
    const miss = d.filter(Number.isNaN).length;
    if (miss) ctx.print(`(${miss} missing value${miss > 1 ? 's' : ''} generated)`);
  },
};

export const replaceCmd: CommandDef = {
  name: 'replace',
  min: 7,
  args: 'assign',
  ifin: true,
  syntax: 'replace oldvar = exp [if] [in]',
  summary: 'изменить значения переменной',
  help: { what: 'Заменяет значения существующей переменной по формуле.', look: '«(N real changes made)» — сколько значений изменилось.', example: 'replace Price = Price/1000' },
  run(ctx, p) {
    const [nameIn, expr] = splitAssign(p);
    const name = ctx.ds.resolve(nameIn);
    if (name !== nameIn) throw new StataError(`variable ${nameIn} not found`, 111, `replace требует полное имя: ${name}`);
    const v = ctx.ds.get(name);
    const { e, rows } = evalRows(ctx, p, expr);
    let changes = 0;
    let miss = 0;
    if (v.kind === 'str') {
      if (!e.isString) throw new StataError('type mismatch', 109);
      for (const i of rows) {
        const nv = String(e.eval(i));
        if (nv !== v.data[i]) changes++;
        v.data[i] = nv;
      }
      v.type = strType(v.data);
      v.format = defaultFormat(v.type);
    } else {
      if (e.isString) throw new StataError('type mismatch', 109);
      const round = v.type === 'float' ? Math.fround : (x: number) => x;
      for (const i of rows) {
        let nv = e.eval(i) as number;
        nv = Number.isNaN(nv) ? NaN : round(nv);
        if (v.type !== 'float' && v.type !== 'double' && !Number.isNaN(nv) && !Number.isInteger(nv)) {
          ctx.print(`${name} was ${v.type} now float`);
          v.type = 'float';
          v.format = '%9.0g';
          nv = Math.fround(nv);
        }
        if (!(Object.is(nv, v.data[i]) || nv === v.data[i])) changes++;
        if (Number.isNaN(nv) && !Number.isNaN(v.data[i])) miss++;
        v.data[i] = nv;
      }
    }
    ctx.ds.changed = true;
    ctx.residVars.delete(name);
    ctx.print(`(${changes} real change${changes === 1 ? '' : 's'} made${miss ? `, ${miss} to missing` : ''})`);
  },
};
