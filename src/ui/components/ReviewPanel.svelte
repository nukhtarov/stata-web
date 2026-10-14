<script lang="ts">
  import { app } from '../state.svelte';

  let timer: ReturnType<typeof setTimeout> | undefined;

  // клик — вставить, двойной клик — выполнить
  function click(cmd: string) {
    clearTimeout(timer);
    timer = setTimeout(() => app.insert(cmd, true), 220);
  }
  function dbl(cmd: string) {
    clearTimeout(timer);
    app.insert(cmd, true, true);
  }
</script>

<section class="panel" aria-label="Review">
  <header><h3>Review</h3></header>
  <div class="list" data-testid="review">
    {#if !app.history.length}
      <p class="empty">История команд пуста.</p>
    {/if}
    {#each [...app.history].reverse() as h (h)}
      <button class="row" onclick={() => click(h)} ondblclick={() => dbl(h)} title="Клик — вставить, двойной клик — выполнить">{h}</button>
    {/each}
  </div>
</section>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1;
    border-top: 1px solid var(--border);
  }
  header {
    padding: 10px 12px 6px;
  }
  h3 {
    margin: 0;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
  }
  .list {
    overflow-y: auto;
    flex: 1;
    padding: 0 6px 8px;
  }
  .row {
    all: unset;
    box-sizing: border-box;
    display: block;
    width: 100%;
    padding: 3px 8px;
    border-radius: 5px;
    cursor: pointer;
    font-family: var(--mono);
    font-size: 12.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .row:hover,
  .row:focus-visible {
    background: var(--hover);
  }
  .empty {
    color: var(--muted);
    font-size: 13px;
    padding: 4px 8px;
    margin: 0;
  }
</style>
