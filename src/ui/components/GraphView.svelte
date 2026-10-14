<script lang="ts">
  import type { GraphSpec } from '../../lang/types';
  import { graphToSvg, svgToPng } from '../graph/svg';

  let { graph, name }: { graph: GraphSpec; name: string } = $props();
  const svg = $derived(graphToSvg(graph));

  async function download() {
    const blob = await svgToPng(svg);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
</script>

<figure class="graph" data-testid="graph">
  <div class="svg">{@html svg}</div>
  <figcaption class="no-print">
    <span>Graph — {name}</span>
    <button class="ghost small" onclick={download}>⬇ Скачать PNG</button>
  </figcaption>
</figure>

<style>
  .graph {
    margin: 8px 0 4px;
    max-width: 600px;
  }
  .svg :global(svg) {
    width: 100%;
    height: auto;
    display: block;
    border: 1px solid var(--border);
    border-radius: 4px;
  }
  figcaption {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: var(--muted);
    padding-top: 4px;
  }
</style>
