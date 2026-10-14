<script lang="ts">
  import { app } from '../state.svelte';

  let { onclose }: { onclose: () => void } = $props();
  let conclusion = $state('');
  let copied = $state(false);

  const ICON = { ok: '✓', bad: '✗', warn: '⚠', unknown: '—' } as const;
  const LABEL = { ok: 'выполнена', bad: 'нарушена', warn: 'под вопросом', unknown: 'не проверена' } as const;

  async function copy() {
    try {
      await navigator.clipboard.writeText(conclusion);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      /* нет доступа к буферу */
    }
  }
</script>

<aside class="drawer" aria-label="Итог по предпосылкам" data-testid="assumptions">
  <header>
    <h3>Итог по предпосылкам</h3>
    <button class="ghost small" onclick={onclose} aria-label="Закрыть">✕</button>
  </header>
  <table>
    <tbody>
      {#each app.assumptions as a (a.id)}
        <tr class={a.status}>
          <td class="id">{a.id.replace('P', 'П')}</td>
          <td>
            <div class="t">{a.title}</div>
            {#if a.checks.length}
              {#each a.checks as c (c.source)}
                <div class="note">{c.source}: {c.note}</div>
              {/each}
            {:else}
              <div class="note">Проверка: {a.how}</div>
            {/if}
          </td>
          <td class="st"><span class="badge {a.status}">{ICON[a.status]} {LABEL[a.status]}</span></td>
        </tr>
      {/each}
    </tbody>
  </table>
  <div class="actions">
    <button class="primary" onclick={() => (conclusion = app.conclusion())}>Собрать общий вывод</button>
  </div>
  {#if conclusion}
    <div class="conclusion">
      <div class="ch">
        <span>Общий вывод</span>
        <button class="small" onclick={copy}>{copied ? '✓ Скопировано' : 'Скопировать'}</button>
      </div>
      {#each conclusion.split('\n\n') as p, i (i)}
        <p>{p}</p>
      {/each}
    </div>
  {/if}
</aside>

<style>
  .drawer {
    height: 100%;
    overflow-y: auto;
    padding: 0 14px 16px;
    background: var(--panel);
    border-left: 1px solid var(--border);
    font-size: 14px;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    background: var(--panel);
    padding: 12px 0 8px;
  }
  h3 {
    margin: 0;
    font-size: 15px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  td {
    padding: 8px 4px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  .id {
    font-weight: 700;
    width: 28px;
  }
  .t {
    font-weight: 500;
  }
  .note {
    color: var(--muted);
    font-size: 12px;
    font-family: var(--mono);
  }
  .st {
    text-align: right;
    white-space: nowrap;
  }
  .badge {
    font-size: 12px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--hover);
    color: var(--muted);
  }
  .badge.ok {
    background: var(--good);
    color: #fff;
  }
  .badge.bad {
    background: var(--bad);
    color: #fff;
  }
  .badge.warn {
    background: var(--warn);
    color: #fff;
  }
  .actions {
    margin: 12px 0;
  }
  .conclusion {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 12px;
    line-height: 1.5;
  }
  .ch {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
  }
</style>
