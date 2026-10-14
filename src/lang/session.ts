// Сессия: данные, последняя модель, выполнение команд и do-файлов.
import { Dataset, StataError } from '../data/dataset';
import { explain } from '../explain';
import type { Ctx, Estimates, FileRequest } from './command';
import { ALIASES, COMMANDS, findCommand } from './commands';
import { parseArgs } from './parser';
import { splitProgram, stripComment } from './tokenizer';
import type { Block, CommandResult, GraphSpec, ResultData } from './types';

export type FileProvider = (pathHint: string) => Promise<FileRequest | null>;

const SUGGEST: Record<string, string> = {
  regression: 'regress',
  sum: 'summarize',
  mean: 'summarize',
  corr: 'correlate',
  hettest: 'estat hettest',
  imtest: 'estat imtest',
  'import': 'import excel',
  gen: 'generate',
};

export class Session {
  ds = new Dataset();
  est: Estimates | null = null;
  residVars = new Set<string>();
  /** файлы, уже выбранные пользователем: имя (без пути, в нижнем регистре) → содержимое */
  files = new Map<string, FileRequest>();

  constructor(public fileProvider: FileProvider = async () => null) {}

  /** Запомнить файл (кнопка «Открыть Excel» / drag & drop) */
  addFile(f: FileRequest) {
    this.files.set(baseName(f.name), f);
  }

  private async requestFile(hint: string): Promise<FileRequest | null> {
    const key = baseName(hint);
    if (key && this.files.has(key)) return this.files.get(key)!;
    const f = await this.fileProvider(hint);
    if (f) this.addFile(f);
    return f;
  }

  /** Выполнить одну команду (строку) */
  async run(line: string): Promise<CommandResult> {
    const text = stripComment(line);
    const res: CommandResult = { echo: '. ' + line.replace(/^\s*\.\s+/, '').trim(), blocks: [], ok: true };
    if (!text) return res;
    let data: ResultData | undefined;
    const blocks: Block[] = res.blocks;
    const ctx = this.makeCtx(blocks, (d) => (data = d));
    try {
      await this.dispatch(ctx, text);
    } catch (e) {
      res.ok = false;
      blocks.push(errorBlock(e));
    }
    if (data && res.ok) {
      res.data = data;
      res.explain = explain(data, this);
    }
    return res;
  }

  /** Выполнить do-файл: останавливается на первой ошибке, как Stata */
  async runProgram(text: string, onResult?: (r: CommandResult) => void): Promise<CommandResult[]> {
    const out: CommandResult[] = [];
    for (const cmd of splitProgram(text)) {
      const r = await this.run(cmd.text);
      out.push(r);
      onResult?.(r);
      if (!r.ok) {
        r.blocks.push({ type: 'text', text: `end of do-file\n(ошибка в строке ${cmd.line})` });
        break;
      }
    }
    return out;
  }

  private makeCtx(blocks: Block[], setData: (d: ResultData) => void): Ctx {
    const self = this;
    const ctx: Ctx = {
      ds: this.ds,
      get est() {
        return self.est;
      },
      setEst: (e) => (self.est = e),
      residVars: this.residVars,
      print(t: string) {
        const last = blocks[blocks.length - 1];
        if (last && last.type === 'text') last.text += '\n' + t;
        else blocks.push({ type: 'text', text: t });
      },
      graph(spec: GraphSpec, name: string) {
        blocks.push({ type: 'graph', graph: spec, name });
      },
      setData,
      requestFile: (h) => this.requestFile(h),
      async exec(line: string) {
        // capture: вывод и ошибки подавляются, данные о результате тоже
        const inner = self.makeCtx([], () => {});
        try {
          await self.dispatch(inner, line);
        } catch {
          /* r(0) — ошибка подавлена */
        }
      },
    };
    return ctx;
  }

  private async dispatch(ctx: Ctx, text: string) {
    let t = text.trim();
    for (const [a, b] of Object.entries(ALIASES)) if (t === a || t.startsWith(a + ' ')) t = b + t.slice(a.length);
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)(\s+excel\b)?/);
    if (!m) throw new StataError(`${t.split(/\s/)[0]} is not a valid command name`, 199);
    const word = m[1] + (m[2] ?? '');
    const cmd = findCommand(word.replace(/\s+/g, ' '));
    if (!cmd) {
      const sug = SUGGEST[m[1].toLowerCase()];
      const hint = m[1] === 'import' ? 'Используйте import excel "файл.xlsx", firstrow clear' : sug ? `Возможно, вы имели в виду: ${sug}. Список команд: help` : 'Проверьте написание. Список команд: help';
      throw new StataError(`command ${m[1]} is unrecognized`, 199, hint);
    }
    const rest = t.slice(m[0].length);
    if (cmd.args === 'command' && cmd.name === 'capture') {
      await cmd.run(ctx, { raw: rest, main: rest, mainTokens: [], opts: new Map() });
      return;
    }
    const p = parseArgs(rest, cmd.options ?? [], !!cmd.ifin);
    await cmd.run(ctx, p);
  }

  commands() {
    return COMMANDS;
  }
}

function baseName(p: string): string {
  return p.replace(/^.*[\\/]/, '').trim().toLowerCase();
}

export function errorBlock(e: unknown): Block {
  if (e instanceof StataError) return { type: 'error', text: e.message, code: e.code, hint: e.hint };
  console.error(e);
  return { type: 'error', text: String((e as Error)?.message ?? e), code: 9999, hint: 'Внутренняя ошибка тренажёра.' };
}
