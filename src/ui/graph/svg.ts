// SVG-рендер графиков в стиле схемы Stata s2color. Чистая функция: spec → строка SVG.
import type { GraphSpec } from '../../lang/types';

export const W = 600;
export const H = 436;

/** «Красивые» деления оси, ~5 штук, как в Stata */
export function niceTicks(lo: number, hi: number, target = 5): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
  if (lo === hi) {
    const d = Math.abs(lo) || 1;
    lo -= d / 2;
    hi += d / 2;
  }
  const raw = (hi - lo) / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const start = Math.floor(lo / step + 1e-9) * step;
  const out: number[] = [];
  for (let v = start; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  if (out[0] > lo + 1e-12) out.unshift(out[0] - step);
  // не расширяем вниз больше чем на шаг
  return out.filter((v) => v >= lo - step + 1e-12);
}

function fmtTick(v: number): string {
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e6 || a < 1e-4)) return v.toExponential(0).replace('e+', 'e+0').replace(/e\+0(\d\d)/, 'e+$1');
  return String(Number(v.toPrecision(10)));
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let clipSeq = 0;

export function graphToSvg(g: GraphSpec): string {
  const clip = `plotclip${++clipSeq}`;
  const xs = g.series.flatMap((s) => s.x).filter(Number.isFinite);
  const ys = g.series.flatMap((s) => s.y).filter(Number.isFinite).concat(g.yline ?? []);
  let xmin = Math.min(...xs);
  let xmax = Math.max(...xs);
  let ymin = Math.min(...ys);
  let ymax = Math.max(...ys);
  // небольшой отступ, чтобы крайние точки не лежали на рамке
  const padX = (xmax - xmin) * 0.02;
  const padY = (ymax - ymin) * 0.03;
  xmin -= padX;
  xmax += padX;
  ymin -= padY;
  ymax += padY;
  // Stata подбирает оси по делениям, данные не «прилипают» к рамке
  const xt = niceTicks(xmin, xmax);
  const yt = niceTicks(ymin, ymax);
  xmin = Math.min(xmin, xt[0]);
  xmax = Math.max(xmax, xt[xt.length - 1]);
  ymin = Math.min(ymin, yt[0]);
  ymax = Math.max(ymax, yt[yt.length - 1]);
  const xticks = xt.filter((v) => v >= xmin - 1e-12 && v <= xmax + 1e-12);
  const yticks = yt.filter((v) => v >= ymin - 1e-12 && v <= ymax + 1e-12);

  const top = g.title ? 52 : 22;
  const legendH = g.legend ? 44 : 0;
  const noteH = g.note ? 20 : 0;
  const left = 74;
  const right = 22;
  const bottom = 58 + legendH + noteH;
  const pw = W - left - right;
  const ph = H - top - bottom;
  const px = (v: number) => left + ((v - xmin) / (xmax - xmin || 1)) * pw;
  const py = (v: number) => top + ph - ((v - ymin) / (ymax - ymin || 1)) * ph;

  const P: string[] = [];
  P.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Arial, Helvetica, sans-serif" role="img">`);
  P.push(`<rect width="${W}" height="${H}" fill="#eaf2f3"/>`);
  P.push(`<rect x="${left}" y="${top}" width="${pw}" height="${ph}" fill="#ffffff"/>`);
  if (g.title) P.push(`<text x="${W / 2}" y="32" text-anchor="middle" font-size="17" fill="#1a1a1a">${esc(g.title)}</text>`);
  // сетка по Y (как в s2color)
  for (const v of yticks) P.push(`<line x1="${left}" x2="${left + pw}" y1="${py(v).toFixed(1)}" y2="${py(v).toFixed(1)}" stroke="#eaf2f3" stroke-width="1"/>`);
  // оси
  P.push(`<line x1="${left}" x2="${left}" y1="${top}" y2="${top + ph}" stroke="#000" stroke-width="0.8"/>`);
  P.push(`<line x1="${left}" x2="${left + pw}" y1="${top + ph}" y2="${top + ph}" stroke="#000" stroke-width="0.8"/>`);
  for (const v of xticks) {
    const x = px(v).toFixed(1);
    P.push(`<line x1="${x}" x2="${x}" y1="${top + ph}" y2="${top + ph + 5}" stroke="#000" stroke-width="0.8"/>`);
    P.push(`<text x="${x}" y="${top + ph + 19}" text-anchor="middle" font-size="12" fill="#000">${fmtTick(v)}</text>`);
  }
  for (const v of yticks) {
    const y = py(v).toFixed(1);
    P.push(`<line x1="${left - 5}" x2="${left}" y1="${y}" y2="${y}" stroke="#000" stroke-width="0.8"/>`);
    P.push(`<text x="${left - 10}" y="${y}" text-anchor="middle" font-size="12" fill="#000" transform="rotate(-90 ${left - 10} ${y})">${fmtTick(v)}</text>`);
  }
  P.push(`<text x="${left + pw / 2}" y="${top + ph + 42}" text-anchor="middle" font-size="13" fill="#000">${esc(g.xtitle)}</text>`);
  if (g.ytitle) P.push(`<text x="18" y="${top + ph / 2}" text-anchor="middle" font-size="13" fill="#000" transform="rotate(-90 18 ${top + ph / 2})">${esc(g.ytitle)}</text>`);

  P.push(`<clipPath id="${clip}"><rect x="${left}" y="${top}" width="${pw}" height="${ph}"/></clipPath><g clip-path="url(#${clip})">`);
  for (const v of g.yline ?? []) P.push(`<line x1="${left}" x2="${left + pw}" y1="${py(v).toFixed(1)}" y2="${py(v).toFixed(1)}" stroke="#000" stroke-width="0.8"/>`);
  for (const s of g.series) {
    if (s.type === 'scatter') {
      for (let i = 0; i < s.x.length; i++) {
        if (!Number.isFinite(s.x[i]) || !Number.isFinite(s.y[i])) continue;
        P.push(`<circle cx="${px(s.x[i]).toFixed(1)}" cy="${py(s.y[i]).toFixed(1)}" r="3.6" fill="${s.color}"/>`);
      }
    } else {
      const pts = s.x.map((x, i) => (Number.isFinite(x) && Number.isFinite(s.y[i]) ? `${px(x).toFixed(1)},${py(s.y[i]).toFixed(1)}` : '')).filter(Boolean);
      P.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${s.color}" stroke-width="2"${s.dash ? ' stroke-dasharray="6 4"' : ''}/>`);
    }
  }
  P.push('</g>');

  if (g.legend) {
    const items = g.series;
    const itemW = 210;
    const total = Math.min(items.length, 2) * itemW;
    const lx = (W - total) / 2;
    const rows = Math.ceil(items.length / 2);
    const ly = top + ph + 54;
    P.push(`<rect x="${lx - 8}" y="${ly}" width="${total + 16}" height="${18 * rows + 12}" fill="#ffffff" stroke="#000" stroke-width="0.5"/>`);
    items.forEach((s, i) => {
      const x = lx + (i % 2) * itemW;
      const y = ly + 16 + Math.floor(i / 2) * 18;
      if (s.type === 'scatter') P.push(`<circle cx="${x + 16}" cy="${y - 4}" r="3.6" fill="${s.color}"/>`);
      else P.push(`<line x1="${x + 2}" x2="${x + 30}" y1="${y - 4}" y2="${y - 4}" stroke="${s.color}" stroke-width="2"/>`);
      P.push(`<text x="${x + 38}" y="${y}" font-size="12" fill="#000">${esc(s.label)}</text>`);
    });
  }
  if (g.note) P.push(`<text x="8" y="${H - 8}" font-size="11" fill="#000">${esc(g.note)}</text>`);
  P.push('</svg>');
  return P.join('');
}

/** SVG → PNG (в браузере) */
export async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('svg load failed'));
      img.src = url;
    });
    const c = document.createElement('canvas');
    c.width = W * scale;
    c.height = H * scale;
    const g = c.getContext('2d')!;
    g.scale(scale, scale);
    g.drawImage(img, 0, 0, W, H);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}
