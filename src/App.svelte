<script lang="ts">
  import { tick } from 'svelte';
  import { app } from './ui/state.svelte';
  import { pickFile, readFile, isExcel } from './ui/files';
  import CommandLine from './ui/components/CommandLine.svelte';
  import DoEditor from './ui/components/DoEditor.svelte';
  import Results from './ui/components/Results.svelte';
  import VariablesPanel from './ui/components/VariablesPanel.svelte';
  import ReviewPanel from './ui/components/ReviewPanel.svelte';
  import AssumptionsPanel from './ui/components/AssumptionsPanel.svelte';
  import ReportView from './ui/components/ReportView.svelte';

  let dragging = $state(false);
  let printing = $state(false);
  let sidebarOpen = $state(false);

  const systemDark = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
  let sysDark = $state(systemDark?.matches ?? false);
  systemDark?.addEventListener('change', (e) => (sysDark = e.matches));
  const dark = $derived(app.theme === 'dark' || (app.theme === 'system' && sysDark));

  $effect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  });

  const badCount = $derived(app.assumptions.filter((a) => a.status === 'bad').length);
  const okCount = $derived(app.assumptions.filter((a) => a.status === 'ok').length);

  async function openExcel() {
    const f = await pickFile();
    if (f) await app.openFile(f);
  }

  async function openDemo() {
    // относительный путь: работает и на Pi, и на GitHub Pages в подкаталоге
    const res = await fetch('./demo/housing_demo.xlsx');
    if (!res.ok) return alert('Не удалось загрузить пример данных.');
    await app.openFile({ name: 'housing_demo.xlsx', data: await res.arrayBuffer() });
  }

  function onDragOver(e: DragEvent) {
    if (e.dataTransfer?.types.includes('Files')) {
      e.preventDefault();
      dragging = true;
    }
  }
  async function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    if (!isExcel(f.name)) {
      alert('Нужен файл Excel (.xlsx или .xls).');
      return;
    }
    await app.openFile(await readFile(f));
  }

  async function exportReport() {
    printing = true;
    await tick();
    const done = () => {
      printing = false;
      removeEventListener('afterprint', done);
    };
    addEventListener('afterprint', done);
    window.print();
  }

  function toggleTheme() {
    app.setTheme(dark ? 'light' : 'dark');
  }
</script>

<svelte:window ondragover={onDragOver} ondragleave={(e) => { if (!e.relatedTarget) dragging = false; }} ondrop={onDrop} />

<div class="app" class:printing>
  <header class="topbar no-print">
    <button class="ghost icon menu" onclick={() => (sidebarOpen = !sidebarOpen)} aria-label="Панели">☰</button>
    <div class="brand">
      <span class="logo">S</span>
      <span class="name">Stata-тренажёр</span>
      {#if app.dataName}<span class="file" title={app.dataName}>{app.dataName}</span>{/if}
    </div>
    <div class="actions">
      <button class="primary" onclick={openExcel} data-testid="open-excel">Открыть Excel</button>
      <button onclick={openDemo} title="Синтетический учебный датасет: 48 городов, 17 переменных" data-testid="open-demo">Пример данных</button>
      <label class="switch" title="Показывать пояснения под выводом">
        <input type="checkbox" checked={app.showExplain} onchange={() => app.toggleExplain()} data-testid="explain-toggle" />
        <span>Пояснения</span>
      </label>
      <button onclick={() => (app.showAssumptions = !app.showAssumptions)} class:active={app.showAssumptions} data-testid="assumptions-btn">
        П1–П5
        {#if okCount || badCount}<span class="mini ok">{okCount}</span><span class="mini bad">{badCount}</span>{/if}
      </button>
      <button onclick={exportReport} disabled={!app.cards.length}>Экспорт отчёта</button>
      <button class="ghost" onclick={() => app.clearResults()} disabled={!app.cards.length} title="Очистить ленту результатов">Очистить</button>
      <button class="ghost icon" onclick={toggleTheme} aria-label="Сменить тему" title="Светлая / тёмная тема" data-testid="theme-toggle">{dark ? '☀' : '☾'}</button>
    </div>
  </header>

  <div class="main no-print" class:with-drawer={app.showAssumptions}>
    <aside class="sidebar" class:open={sidebarOpen}>
      <VariablesPanel />
      <ReviewPanel />
    </aside>
    <section class="center">
      <div class="tabs" role="tablist">
        <button role="tab" aria-selected={app.tab === 'results'} class:sel={app.tab === 'results'} onclick={() => (app.tab = 'results')}>Results</button>
        <button role="tab" aria-selected={app.tab === 'do'} class:sel={app.tab === 'do'} onclick={() => (app.tab = 'do')} data-testid="tab-do">Do-file Editor</button>
        {#if app.busy}<span class="busy">выполняется…</span>{/if}
      </div>
      <div class="pane" hidden={app.tab !== 'results'}><Results /></div>
      <div class="pane" hidden={app.tab !== 'do'}><DoEditor /></div>
      <CommandLine />
    </section>
    {#if app.showAssumptions}
      <AssumptionsPanel onclose={() => (app.showAssumptions = false)} />
    {/if}
  </div>

  {#if printing}
    <ReportView />
  {/if}

  {#if dragging}
    <div class="dropzone no-print">Отпустите файл, чтобы загрузить данные</div>
  {/if}
</div>
