<script lang="ts">
  import type { Card } from '../state.svelte';
  import { app } from '../state.svelte';
  import ExplainBlock from './ExplainBlock.svelte';
  import GraphView from './GraphView.svelte';

  let { card }: { card: Card } = $props();
</script>

<article class="card" class:failed={!card.ok} data-testid="card">
  <pre class="echo">{card.echo}</pre>
  {#each card.blocks as b, i (i)}
    {#if b.type === 'text'}
      <pre class="out">{b.text}</pre>
    {:else if b.type === 'error'}
      <pre class="err">{b.text}<br />r({b.code});</pre>
      {#if b.hint}
        <p class="err-hint">💡 {b.hint}</p>
      {/if}
    {:else if b.type === 'graph'}
      <GraphView graph={b.graph} name={b.name} />
    {/if}
  {/each}
  {#if card.explain && app.showExplain}
    <ExplainBlock ex={card.explain} />
  {/if}
</article>

<style>
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 14px 12px;
    margin: 0 0 12px;
    break-inside: avoid;
  }
  .card.failed {
    border-color: var(--bad-soft);
  }
  pre {
    font-family: var(--mono);
    font-size: 13px;
    line-height: 1.35;
    margin: 0;
    white-space: pre;
    overflow-x: auto;
  }
  .echo {
    font-weight: 700;
    color: var(--fg);
    margin-bottom: 6px;
    white-space: pre-wrap;
  }
  .out {
    color: var(--out);
  }
  .out + .out {
    margin-top: 6px;
  }
  .err {
    color: var(--bad);
    margin-top: 2px;
  }
  .err-hint {
    font-family: var(--sans);
    font-size: 14px;
    margin: 6px 0 0;
    padding: 6px 10px;
    border-radius: 6px;
    background: var(--warn-bg);
  }
</style>
