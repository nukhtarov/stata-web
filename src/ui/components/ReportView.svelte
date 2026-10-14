<script lang="ts">
  import { app } from '../state.svelte';
  import ExplainBlock from './ExplainBlock.svelte';
  import GraphView from './GraphView.svelte';

  const conclusion = app.conclusion();
  const date = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  const LABEL = { ok: '✓ выполнена', bad: '✗ нарушена', warn: '⚠ под вопросом', unknown: '— не проверена' } as const;
</script>

<div class="report print-only">
  <h1>Отчёт по регрессионному анализу</h1>
  <p class="meta">{app.dataName || 'данные'} · {date}</p>

  <h2>Итог по предпосылкам</h2>
  <table>
    <tbody>
      {#each app.assumptions as a (a.id)}
        <tr><td>{a.id.replace('P', 'П')}</td><td>{a.title}</td><td>{LABEL[a.status]}</td></tr>
      {/each}
    </tbody>
  </table>

  <h2>Общий вывод</h2>
  {#each conclusion.split('\n\n') as p, i (i)}<p>{p}</p>{/each}

  <h2>Результаты</h2>
  {#each app.cards as card (card.id)}
    <article class="rcard">
      <pre class="echo">{card.echo}</pre>
      {#each card.blocks as b, i (i)}
        {#if b.type === 'text'}<pre>{b.text}</pre>
        {:else if b.type === 'error'}<pre class="err">{b.text}<br />r({b.code});</pre>
        {:else}<GraphView graph={b.graph} name={b.name} />{/if}
      {/each}
      {#if card.explain}<ExplainBlock ex={card.explain} />{/if}
    </article>
  {/each}
</div>

<style>
  .report {
    font-family: var(--sans);
    color: #000;
    background: #fff;
  }
  h1 {
    font-size: 20pt;
    margin: 0;
  }
  h2 {
    font-size: 14pt;
    margin: 18pt 0 6pt;
  }
  .meta {
    color: #555;
  }
  table {
    border-collapse: collapse;
  }
  td {
    border: 1px solid #999;
    padding: 3pt 8pt;
  }
  pre {
    font-family: var(--mono);
    font-size: 8pt;
    white-space: pre;
    margin: 0;
  }
  .echo {
    font-weight: 700;
    margin-top: 12pt;
  }
  .err {
    color: #b00;
  }
  .rcard {
    break-inside: avoid-page;
  }
</style>
