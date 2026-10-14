<script lang="ts">
  import { app } from '../state.svelte';

  let filter = $state('');
  const shown = $derived(app.vars.filter((v) => v.name.toLowerCase().includes(filter.toLowerCase())));
</script>

<section class="panel" aria-label="Variables">
  <header>
    <h3>Variables</h3>
    <span class="count">{app.vars.length ? `${app.vars.length} · obs ${app.nobs}` : ''}</span>
  </header>
  {#if app.vars.length > 8}
    <input class="filter" placeholder="Фильтр…" bind:value={filter} aria-label="Фильтр переменных" />
  {/if}
  <div class="list" data-testid="variables">
    {#if !app.vars.length}
      <p class="empty">Данных нет. Откройте Excel-файл.</p>
    {/if}
    {#each shown as v (v.name)}
      <button class="row" onclick={() => app.insert(v.name)} title={v.label && v.label !== v.name ? v.label : `Вставить ${v.name}`}>
        <span class="name">{v.name}</span>
        <span class="type" class:str={v.type.startsWith('str')}>{v.type}</span>
      </button>
    {/each}
  </div>
</section>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1.3;
  }
  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 10px 12px 6px;
  }
  h3 {
    margin: 0;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
  }
  .count {
    font-size: 12px;
    color: var(--muted);
  }
  .filter {
    margin: 0 10px 6px;
  }
  .list {
    overflow-y: auto;
    flex: 1;
    padding: 0 6px 8px;
  }
  .row {
    all: unset;
    box-sizing: border-box;
    display: flex;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    padding: 3px 8px;
    border-radius: 5px;
    cursor: pointer;
    font-family: var(--mono);
    font-size: 13px;
  }
  .row:hover,
  .row:focus-visible {
    background: var(--hover);
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .type {
    color: var(--muted);
    font-size: 12px;
  }
  .type.str {
    color: var(--warn);
  }
  .empty {
    color: var(--muted);
    font-size: 13px;
    padding: 4px 8px;
    margin: 0;
  }
</style>
