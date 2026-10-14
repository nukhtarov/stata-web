// Источник автодополнения: команды, переменные, опции, подкоманды estat, типы графиков twoway.
import type { CommandDef } from './command';
import { COMMANDS, findCommand } from './commands';
import { ESTAT_SUBS } from './commands/estat';
import { topLevelComma } from './parser';

export interface Completion {
  label: string;
  /** что вставить (по умолчанию label) */
  apply?: string;
  detail?: string;
  type: 'command' | 'variable' | 'option' | 'keyword';
}

export interface CompletionResult {
  /** позиция начала заменяемого слова */
  from: number;
  options: Completion[];
}

/** Сокращения, которые студенты видят в методичках */
const SHORT: Record<string, string[]> = {
  regress: ['reg'],
  summarize: ['sum', 'su'],
  describe: ['des'],
  correlate: ['corr'],
  generate: ['gen'],
  twoway: ['tw'],
  capture: ['cap'],
  rename: ['ren'],
};

export function commandCompletions(): Completion[] {
  const out: Completion[] = [];
  for (const c of COMMANDS) {
    for (const s of SHORT[c.name] ?? []) out.push({ label: s, apply: s, detail: `${s} — ${c.summary}`, type: 'command' });
    out.push({ label: c.name, detail: `${c.name} — ${c.summary}`, type: 'command' });
  }
  return out;
}

export interface VarInfo {
  name: string;
  type: string;
  label?: string;
}

/** Определить команду в начале строки (с учётом capture и `graph twoway`) */
export function commandAt(line: string): { cmd?: CommandDef; argsStart: number } {
  let s = line;
  let off = 0;
  const cap = s.match(/^(\s*\.?\s*)(cap|capt|captu|captur|capture)\s+/);
  if (cap) {
    off = cap[0].length;
    s = s.slice(off);
  }
  const g = s.match(/^\s*(?:gr|graph)\s+(?=tw)/);
  if (g) {
    off += g[0].length;
    s = s.slice(g[0].length);
  }
  const m = s.match(/^\s*\.?\s*([A-Za-z_]+)(\s+excel)?(?=\s)/);
  if (!m) return { argsStart: off };
  const cmd = findCommand((m[1] + (m[2] ?? '')).replace(/\s+/g, ' '));
  return { cmd, argsStart: off + m[0].length };
}

export function complete(line: string, pos: number, vars: VarInfo[]): CompletionResult | null {
  const before = line.slice(0, pos);
  const wm = before.match(/[A-Za-z_0-9~*]*$/)!;
  const word = wm[0];
  const from = pos - word.length;
  const lead = before.slice(0, from);

  // позиция 1 — команда (в том числе после capture)
  if (/^\s*\.?\s*$/.test(lead) || /^\s*\.?\s*(cap|capt|captu|captur|capture)\s+$/.test(lead)) {
    const w = word.toLowerCase();
    const opts = commandCompletions().filter((c) => c.label.startsWith(w) && c.label !== w);
    const exact = commandCompletions().filter((c) => c.label === w);
    return { from, options: [...exact, ...opts].filter((c, i, a) => a.findIndex((x) => x.label === c.label) === i) };
  }

  const { cmd, argsStart } = commandAt(before);
  if (!cmd) return null;
  const args = before.slice(argsStart);

  // estat <sub>
  if (cmd.name === 'estat' && /^\s*[A-Za-z]*$/.test(args)) {
    return { from, options: ESTAT_SUBS.filter((s) => s.name.startsWith(word)).map((s) => ({ label: s.name, detail: s.summary, type: 'keyword' })) };
  }

  // twoway ( <plottype>
  if (cmd.name === 'twoway' && (/\(\s*[A-Za-z]*$/.test(before) || /\|\|\s*[A-Za-z]*$/.test(before) || /^\s*[A-Za-z]*$/.test(args))) {
    const types = [
      { label: 'scatter', detail: 'точки (облако)' },
      { label: 'lfit', detail: 'прямая МНК' },
      { label: 'line', detail: 'линия' },
    ];
    return { from, options: types.filter((t) => t.label.startsWith(word)).map((t) => ({ ...t, type: 'keyword' as const })) };
  }

  // опции после запятой
  const ci = topLevelComma(args);
  if (ci >= 0 && !/\([^)]*$/.test(args.slice(ci))) {
    const optsDefs = cmd.name === 'estat' ? ESTAT_SUBS.find((s) => args.trim().startsWith(s.name.slice(0, s.min)))?.options ?? [] : cmd.options ?? [];
    const used = new Set(args.slice(ci + 1).match(/[A-Za-z]+/g) ?? []);
    return {
      from,
      options: optsDefs
        .filter((o) => o.name.startsWith(word) && !(used.has(o.name) && o.name !== word))
        .map((o) => ({ label: o.arg ? `${o.name}()` : o.name, apply: o.arg ? `${o.name}(` : o.name, detail: o.help, type: 'option' as const })),
    };
  }

  // help <command>
  if (cmd.name === 'help') return { from, options: commandCompletions().filter((c) => c.label.startsWith(word)) };
  if (cmd.args === 'none' || cmd.args === 'path') return null;

  // имена переменных
  if (cmd.args === 'newvar' && /^\s*[A-Za-z_0-9]*$/.test(args)) return null;
  if (cmd.args === 'assign' && /^\s*(?:(?:byte|int|long|float|double)\s+)?[A-Za-z_0-9]*$/.test(args) && cmd.name !== 'replace') return null;
  const already = new Set((args.slice(0, args.length - word.length).match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []));
  const options = vars
    .filter((v) => v.name.startsWith(word) && !(cmd.args === 'varlist' && already.has(v.name)))
    .map((v) => ({ label: v.name, detail: v.type + (v.label && v.label !== v.name ? ` · ${v.label}` : ''), type: 'variable' as const }));
  return { from, options };
}

/** Подсказка синтаксиса для текущей строки */
export function syntaxHint(line: string): string | null {
  const { cmd } = commandAt(line + ' ');
  if (!cmd) {
    const w = line.trim().split(/\s+/)[0];
    const c = w ? findCommand(w) : undefined;
    return c ? `${c.syntax}  —  ${c.summary}` : null;
  }
  return `${cmd.syntax}  —  ${cmd.summary}`;
}
