<script lang="ts">
  import type { Explanation } from '../../lang/types';

  let { ex }: { ex: Explanation } = $props();
  let copied = $state(false);
  let open = $state(true);

  const pill = $derived(
    ex.verdict === 'good' ? { icon: '✓', text: 'хорошо' } : ex.verdict === 'bad' ? { icon: '✗', text: 'плохо' } : { icon: 'ℹ', text: 'информация' },
  );

  async function copy() {
    if (!ex.report) return;
    try {
      await navigator.clipboard.writeText(ex.report);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = ex.report;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }
</script>

<section class="explain {ex.verdict}" data-testid="explain">
  <button class="head" onclick={() => (open = !open)} aria-expanded={open}>
    <span class="pill {ex.verdict}">{pill.icon} {pill.text}</span>
    <span class="title">{ex.title}</span>
    <span class="chev no-print">{open ? '▾' : '▸'}</span>
  </button>
  {#if open}
    <div class="body">
      {#if ex.warning}
        <p class="warning">⚠ {ex.warning}</p>
      {/if}
      {#each ex.text as p, i (i)}
        <p class:rule={p.startsWith('Главное правило')} class:bullet={p.startsWith('•')}>{p}</p>
      {/each}
      {#if ex.report}
        <div class="report">
          <div class="report-head">
            <span>Что записать в работу</span>
            <button class="small no-print" onclick={copy}>{copied ? '✓ Скопировано' : 'Скопировать'}</button>
          </div>
          <p>{ex.report}</p>
        </div>
      {/if}
    </div>
  {/if}
</section>

<style>
  .explain {
    margin-top: 10px;
    border: 1px solid var(--border);
    border-left: 4px solid var(--info);
    border-radius: 8px;
    background: var(--explain-bg);
    font-family: var(--sans);
  }
  .explain.good {
    border-left-color: var(--good);
  }
  .explain.bad {
    border-left-color: var(--bad);
  }
  .head {
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 12px;
    cursor: pointer;
  }
  .head:focus-visible {
    outline: 2px solid var(--accent);
    border-radius: 8px;
  }
  .title {
    font-weight: 600;
    flex: 1;
  }
  .chev {
    color: var(--muted);
  }
  .pill {
    font-size: 12px;
    font-weight: 700;
    padding: 2px 10px;
    border-radius: 999px;
    white-space: nowrap;
    color: #fff;
    background: var(--info);
  }
  .pill.good {
    background: var(--good);
  }
  .pill.bad {
    background: var(--bad);
  }
  .body {
    padding: 0 14px 10px;
    font-size: 14px;
    line-height: 1.5;
  }
  .body p {
    margin: 6px 0;
  }
  .bullet {
    padding-left: 12px;
  }
  .rule {
    color: var(--muted);
    font-size: 13px;
  }
  .warning {
    background: var(--warn-bg);
    border: 1px solid var(--warn);
    border-radius: 6px;
    padding: 6px 10px;
  }
  .report {
    margin-top: 10px;
    background: var(--panel);
    border: 1px dashed var(--border-strong);
    border-radius: 6px;
    padding: 8px 10px;
  }
  .report-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
    font-size: 13px;
    color: var(--muted);
  }
</style>
