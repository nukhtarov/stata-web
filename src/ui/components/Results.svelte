<script lang="ts">
  import { tick } from 'svelte';
  import { app } from '../state.svelte';
  import ResultCard from './ResultCard.svelte';

  let scroller: HTMLDivElement;

  $effect(() => {
    const n = app.cards.length;
    if (!n) return;
    tick().then(() => {
      const last = scroller?.querySelector<HTMLElement>('[data-testid="card"]:last-child');
      if (last) scroller.scrollTo({ top: last.offsetTop - 12, behavior: 'smooth' });
    });
  });
</script>

<div class="results" bind:this={scroller} data-testid="results">
  {#if !app.cards.length}
    <div class="empty">
      <h2>Тренажёр Stata для регрессионного анализа</h2>
      <ol>
        <li>Откройте Excel-файл: кнопка <b>«Открыть Excel»</b> вверху или перетащите файл на страницу. Нет своего файла — нажмите <b>«Пример данных»</b>.</li>
        <li>Вводите команды Stata в строку внизу (<code>des</code>, <code>sum</code>, <code>reg Price Gini …</code>) — подсказки появятся сами.</li>
        <li>Или откройте вкладку <b>Do-file Editor</b> и нажмите «Выполнить всё» — там уже есть учебный сценарий.</li>
      </ol>
      <p>Под каждым выводом — пояснение простыми словами: хорошо это или плохо и что написать в работе.</p>
      <p class="rule">Главное правило: p&nbsp;&lt;&nbsp;0,05 → H0 отвергаем. Для модели и факторов хорошо маленькое p, для проверок предпосылок — большое.</p>
    </div>
  {/if}
  {#each app.cards as card (card.id)}
    <ResultCard {card} />
  {/each}
</div>

<style>
  .results {
    height: 100%;
    overflow-y: auto;
    padding: 12px 16px 24px;
    position: relative;
  }
  .empty {
    max-width: 640px;
    margin: 32px auto;
    line-height: 1.6;
    color: var(--fg);
  }
  .empty h2 {
    font-size: 20px;
    margin: 0 0 12px;
  }
  .empty code {
    font-family: var(--mono);
    background: var(--hover);
    padding: 1px 5px;
    border-radius: 4px;
  }
  .rule {
    color: var(--muted);
    font-size: 14px;
  }
</style>
