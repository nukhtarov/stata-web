// Глобальное состояние UI (Svelte 5 runes). Ядро (Session) живёт вне реактивности.
import { Session } from '../lang/session';
import type { FileRequest } from '../lang/command';
import type { CommandResult } from '../lang/types';
import type { VarInfo } from '../lang/completions';
import { SAMPLE_DO } from '../lang/sampleDo';
import { collectAssumptions, buildConclusion } from '../explain/assumptions';
import { pickFile } from './files';

export interface Card extends CommandResult {
  id: number;
}

const LS = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* приватный режим и т. п. */
    }
  },
};

export type Theme = 'system' | 'light' | 'dark';

class AppState {
  session = new Session((hint) => pickFile(hint));
  cards = $state.raw<Card[]>([]);
  vars = $state.raw<VarInfo[]>([]);
  nobs = $state(0);
  history = $state.raw<string[]>([]);
  showExplain = $state(LS.get('stata.explain') !== '0');
  theme = $state<Theme>((LS.get('stata.theme') as Theme) || 'system');
  tab = $state<'results' | 'do'>('results');
  showAssumptions = $state(false);
  busy = $state(false);
  doText = $state(LS.get('stata.dofile') ?? SAMPLE_DO);
  /** запрос на вставку текста в командную строку */
  insertRequest = $state<{ text: string; replace: boolean; run?: boolean; seq: number } | null>(null);
  dataName = $state('');

  private seq = 0;

  assumptions = $derived(collectAssumptions(this.cards));

  conclusion() {
    return buildConclusion(this.cards);
  }

  private refreshVars() {
    this.vars = this.session.ds.vars.map((v) => ({ name: v.name, type: v.type, label: v.label }));
    this.nobs = this.session.ds.N;
  }

  private push(r: CommandResult) {
    this.cards = [...this.cards, { ...r, id: ++this.seq }];
  }

  async run(line: string) {
    const text = line.trim();
    if (!text) return;
    this.busy = true;
    try {
      this.history = [...this.history.filter((h) => h !== text), text];
      const r = await this.session.run(text);
      this.push(r);
    } finally {
      this.refreshVars();
      this.busy = false;
      this.tab = 'results';
    }
  }

  async runProgram(text: string) {
    this.busy = true;
    this.tab = 'results';
    try {
      this.push({ echo: '. do "editor"', blocks: [], ok: true });
      await this.session.runProgram(text, (r) => {
        this.push(r);
        this.refreshVars();
      });
    } finally {
      this.refreshVars();
      this.busy = false;
    }
  }

  /** Файл выбран кнопкой или перетащен на страницу */
  async openFile(f: FileRequest) {
    this.session.addFile(f);
    this.dataName = f.name;
    const clear = this.session.ds.empty ? '' : ' clear';
    await this.run(`import excel "${f.name}", firstrow${clear}`);
  }

  insert(text: string, replace = false, run = false) {
    this.insertRequest = { text, replace, run, seq: ++this.seq };
  }

  clearResults() {
    this.cards = [];
  }

  setDo(text: string) {
    this.doText = text;
    LS.set('stata.dofile', text);
  }

  toggleExplain() {
    this.showExplain = !this.showExplain;
    LS.set('stata.explain', this.showExplain ? '1' : '0');
  }

  setTheme(t: Theme) {
    this.theme = t;
    LS.set('stata.theme', t);
  }
}

export const app = new AppState();
