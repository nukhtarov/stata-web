<script lang="ts">
  import { onMount } from 'svelte';
  import { EditorState, Prec } from '@codemirror/state';
  import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
  import { defaultKeymap, history as cmHistory, historyKeymap, indentWithTab } from '@codemirror/commands';
  import { completionKeymap } from '@codemirror/autocomplete';
  import { stataLanguage, stataHighlight, stataCompletion } from '../cm/stata';
  import { SAMPLE_DO } from '../../lang/sampleDo';
  import { app } from '../state.svelte';

  let host: HTMLDivElement;
  let view: EditorView;
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  function selectedText(): string {
    const sel = view.state.selection.main;
    if (sel.empty) return '';
    // выполняем целые строки, затронутые выделением
    const a = view.state.doc.lineAt(sel.from);
    const b = view.state.doc.lineAt(sel.to);
    return view.state.doc.sliceString(a.from, b.to);
  }

  function runSelectionOrAll() {
    const sel = selectedText();
    app.runProgram(sel || view.state.doc.toString());
    return true;
  }

  function runAll() {
    app.runProgram(view.state.doc.toString());
  }

  function runSelected() {
    const sel = selectedText();
    if (sel) app.runProgram(sel);
    else {
      // без выделения — текущая строка
      const line = view.state.doc.lineAt(view.state.selection.main.head);
      app.runProgram(line.text);
    }
  }

  function reset() {
    if (!confirm('Заменить текст редактора учебным do-файлом?')) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: SAMPLE_DO } });
  }

  onMount(() => {
    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: app.doText,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          drawSelection(),
          cmHistory(),
          Prec.highest(keymap.of([{ key: 'Mod-d', run: runSelectionOrAll, preventDefault: true }])),
          keymap.of([...completionKeymap, indentWithTab, ...defaultKeymap, ...historyKeymap]),
          stataLanguage,
          stataHighlight,
          stataCompletion(() => app.vars),
          EditorView.lineWrapping,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) app.setDo(u.state.doc.toString());
          }),
          EditorView.contentAttributes.of({ 'aria-label': 'Do-file Editor', 'data-testid': 'do-editor' }),
        ],
      }),
    });
    return () => view.destroy();
  });
</script>

<div class="do">
  <div class="toolbar">
    <button class="primary" onclick={runAll} disabled={app.busy} data-testid="run-all">▶ Выполнить всё</button>
    <button onclick={runSelected} disabled={app.busy}>Выполнить выделенное</button>
    <span class="kbd-hint"><kbd>{isMac ? '⌘' : 'Ctrl'}</kbd>+<kbd>D</kbd> — выделенное, без выделения — весь файл</span>
    <span class="spacer"></span>
    <button class="ghost" onclick={reset} title="Вернуть учебный do-файл">Учебный пример</button>
  </div>
  <div class="editor" bind:this={host}></div>
</div>

<style>
  .do {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .toolbar {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
  }
  .kbd-hint {
    color: var(--muted);
    font-size: 12px;
  }
  .spacer {
    flex: 1;
  }
  .editor {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  .editor :global(.cm-editor) {
    height: 100%;
    font-family: var(--mono);
    font-size: 14px;
    background: var(--input-bg);
  }
  .editor :global(.cm-gutters) {
    background: var(--panel);
    color: var(--muted);
    border-right: 1px solid var(--border);
  }
  .editor :global(.cm-activeLine) {
    background: var(--hover);
  }
  .editor :global(.cm-activeLineGutter) {
    background: var(--hover);
  }
  .editor :global(.cm-editor.cm-focused) {
    outline: none;
  }
</style>
