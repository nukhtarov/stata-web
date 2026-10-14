// Цвета схемы s2color и помощники графиков.
import type { Ctx } from '../command';
import { ols } from '../../stats/ols';

export const COLORS = { navy: '#1a476f', maroon: '#90353b', green: '#55752f', orange: '#e37e00', blue: '#2a7fd4', red: '#c0392b' };

export function varTitle(ctx: Ctx, name: string): string {
  const v = ctx.ds.get(name);
  return v.label || name;
}

/** Прямая МНК y на x: точки на концах диапазона */
export function lfitLine(x: number[], y: number[]): { x: number[]; y: number[]; slope: number } {
  const m = ols(y, [x], ['x']);
  const b = m.coefs[0].b;
  const a = m.coefs[1].b;
  const lo = Math.min(...x);
  const hi = Math.max(...x);
  const xs = Array.from({ length: 50 }, (_, i) => lo + ((hi - lo) * i) / 49);
  return { x: xs, y: xs.map((v) => a + b * v), slope: b };
}
