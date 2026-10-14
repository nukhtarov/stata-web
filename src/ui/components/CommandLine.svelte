<script lang="ts">
  import { onMount } from 'svelte';
  import { EditorState, Prec } from '@codemirror/state';
  import { EditorView, keymap, placeholder } from '@codemirror/view';
  import { defaultKeymap, history as cmHistory, historyKeymap } from '@codemirror/commands';
  import { acceptCompletion, completionKeymap, completionStatus, startCompletion, closeCompletion } from '@codemirror/autocomplete';
  import { stataLanguage, stataHighlight, stataCompletion } from '../cm/stata';
  import { syntaxHint } from '../../lang/completions';
  import { app } from '../state.svelte';

  let host: HTMLDivElement;
  let view: EditorView;
  let hint = $state<string | null>(null);
  let histPos = -1;
  let draft = '';

  function setText(text: string, cursorEnd = true) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, selection: cursorEnd ? { anchor: text.length } : undefined });
  }

  function submit() {
    const text = view.state.doc.toString();
    if (!text.trim() || app.busy) return true;
    histPos = -1;
    setText('');
    app.run(text);
    return true;
  }

  /** Tab при быстром наборе может прийти, пока подсказки ещё пересчитываются */
  function acceptOrWait(v: EditorView): boolean {
    if (completionStatus(v.state) === 'pending') {
      const t0 = Date.now();
      const tryAccept = () => {
        if (completionStatus(v.state) === 'active') acceptCompletion(v);
        else if (completionStatus(v.state) === 'pending' && Date.now() - t0 < 500) setTimeout(tryAccept, 20);
      };
      setTimeout(tryAccept, 20);
      return true;
    }
    return acceptCompletion(v);
  }

  function histMove(dir: -1 | 1) {
    if (completionStatus(view.state)) return false;
    const h = app.history;
    if (!h.length) return true;
    if (histPos === -1) {
      if (dir === 1) return true;
      draft = view.state.doc.toString();
      histPos = h.length - 1;
    } else {
      histPos += dir;
      if (histPos >= h.length) {
        histPos = -1;
        setText(draft);
        return true;
      }
      histPos = Math.max(0, histPos);
    }
    setText(h[histPos]);
    return true;
  }

  onMount(() => {
    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: '',
        extensions: [
          cmHistory(),
          // одна строка: переводы строк превращаются в пробелы
          EditorState.transactionFilter.of((tr) => {
            if (!tr.docChanged || !tr.newDoc.toString().includes('\n')) return tr;
            const text = tr.newDoc.toString();
            if (tr.isUserEvent('input.paste') && text.split('\n').filter((l) => l.trim()).length > 1) {
              // вставка нескольких строк — выполнить как do-файл
              queueMicrotask(() => {
                setText('');
                app.runProgram(text);
              });
              return [];
            }
            return [tr, { changes: { from: 0, to: tr.newDoc.length, insert: text.replace(/\r?\n/g, ' ') }, sequential: true }];
          }),
          Prec.highest(
            keymap.of([
              { key: 'Tab', run: (v) => acceptOrWait(v) || startCompletion(v) },
              { key: 'Enter', run: (v) => (completionStatus(v.state) ? acceptOrWait(v) : submit()) },
              { key: 'ArrowUp', run: () => histMove(-1) },
              { key: 'ArrowDown', run: () => histMove(1) },
              { key: 'Escape', run: (v) => closeCompletion(v) },
            ]),
          ),
          keymap.of([...completionKeymap, ...defaultKeymap, ...historyKeymap]),
          stataLanguage,
          stataHighlight,
          stataCompletion(() => app.vars),
          placeholder('Введите команду Stata, например: reg Price Gini   (Tab — дополнить, ↑/↓ — история)'),
          EditorView.updateListener.of((u) => {
            if (!u.docChanged) return;
            const text = u.state.doc.toString();
            hint = syntaxHint(text);
            const last = text[u.state.selection.main.head - 1];
            if (u.transactions.some((t) => t.isUserEvent('input.type')) && (last === ' ' || last === ',' || last === '(')) {
              queueMicrotask(() => startCompletion(view));
            }
          }),
          EditorView.contentAttributes.of({ 'aria-label': 'Командная строка Stata', 'data-testid': 'cmdline' }),
        ],
      }),
    });
    view.focus();
    return () => view.destroy();
  });

  $effect(() => {
    const r = app.insertRequest;
    if (!r || !view) return;
    if (r.replace) setText(r.text);
    else {
      const pos = view.state.selection.main.head;
      const before = view.state.doc.sliceString(0, pos);
      const sep = before && !/\s$/.test(before) ? ' ' : '';
      view.dispatch({ changes: { from: pos, insert: sep + r.text + ' ' }, selection: { anchor: pos + sep.length + r.text.length + 1 } });
    }
    if (r.run) submit();
    view.focus();
  });
</script>

<div class="cmdbar">
  <div class="prompt-row">
    <span class="prompt">.</span>
    <div class="cm" bind:this={host}></div>
    <button class="run" onclick={() => submit()} disabled={app.busy} title="Выполнить (Enter)">Выполнить</button>
  </div>
  <div class="hint" aria-live="polite">{hint ?? 'Начните вводить команду — появятся подсказки. help — список команд.'}</div>
</div>

<style>
  .cmdbar {
    border-top: 1px solid var(--border);
    background: var(--panel);
    padding: 8px 12px 6px;
  }
  .prompt-row {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--input-bg);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    padding: 2px 4px 2px 10px;
  }
  .prompt-row:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .prompt {
    font-family: var(--mono);
    font-weight: 700;
    color: var(--muted);
  }
  .cm {
    flex: 1;
    min-width: 0;
  }
  .cm :global(.cm-editor) {
    background: transparent;
    font-family: var(--mono);
    font-size: 14px;
  }
  .cm :global(.cm-editor.cm-focused) {
    outline: none;
  }
  .cm :global(.cm-content) {
    padding: 7px 0;
  }
  .cm :global(.cm-line) {
    padding: 0;
  }
  .cm :global(.cm-placeholder) {
    color: var(--muted);
  }
  .run {
    flex: none;
  }
  .hint {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--muted);
    padding: 4px 2px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
