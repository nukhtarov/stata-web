// Общие помощники команд.
import { StataError } from '../../data/dataset';
import { compileExpr } from '../expr';
import type { Ctx, Estimates } from '../command';
import type { Parsed } from '../parser';
import { words } from '../parser';

export function requireData(ctx: Ctx) {
  if (ctx.ds.vars.length === 0)
    throw new StataError('no variables defined', 111, 'Данные не загружены. Откройте Excel-файл кнопкой «Открыть Excel» или командой import excel.');
}

export function requireEst(ctx: Ctx): Estimates {
  if (!ctx.est)
    throw new StataError('last estimates not found', 301, 'Эта проверка работает с последней регрессией. Сначала выполните reg зависимая_переменная факторы.');
  return ctx.est;
}

/** Номера наблюдений с учётом in/if */
export function selectRows(ctx: Ctx, p: Parsed): number[] {
  const N = ctx.ds.N;
  let rows = [...Array(N).keys()];
  if (p.inRange) {
    let [a, b] = p.inRange;
    if (a < 0) a = N + a + 1;
    if (b < 0) b = N + b + 1;
    if (a < 1 || b > N || a > b) throw new StataError('Obs. nos. out of range', 198);
    rows = rows.slice(a - 1, b);
  }
  if (p.ifExpr) {
    const e = compileExpr(p.ifExpr, ctx.ds);
    rows = rows.filter((i) => {
      const v = e.eval(i);
      return typeof v === 'number' && v !== 0 && !Number.isNaN(v);
    });
  }
  return rows;
}

/** Строки без missing во всех переменных (listwise) с учётом if/in */
export function completeRows(ctx: Ctx, p: Parsed, vars: string[]): number[] {
  const base = selectRows(ctx, p);
  const cols = vars.map((v) => ctx.ds.num(v));
  return base.filter((i) => cols.every((c) => !Number.isNaN(c[i])));
}

export function varlistOrAll(ctx: Ctx, p: Parsed): string[] {
  const w = words(p);
  return w.length ? ctx.ds.varlist(w) : ctx.ds.names();
}

export const pick = (x: number[], rows: number[]) => rows.map((i) => x[i]);

export function noObs(): never {
  throw new StataError('no observations', 2000, 'Нет ни одного наблюдения без пропусков. Проверьте, что переменные числовые (describe) и заполнены.');
}
