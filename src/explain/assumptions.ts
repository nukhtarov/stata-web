// Итог по предпосылкам П1–П5 и общий вывод.
import type { AssumptionId, AssumptionUpdate, CommandResult } from '../lang/types';

export const ASSUMPTIONS: { id: AssumptionId; title: string; how: string }[] = [
  { id: 'P1', title: 'Правильная спецификация модели', how: 'linktest, ovtest, acprplot' },
  { id: 'P2', title: 'Нет сильной мультиколлинеарности', how: 'vif' },
  { id: 'P3', title: 'Среднее ошибок равно нулю', how: 'predict e, resid → sum e' },
  { id: 'P4', title: 'Гомоскедастичность (одинаковый разброс ошибок)', how: 'estat hettest, rvfplot' },
  { id: 'P5', title: 'Нормальность ошибок', how: 'swilk e, kdensity e, normal' },
];

export interface AssumptionState {
  id: AssumptionId;
  title: string;
  how: string;
  status: 'ok' | 'bad' | 'warn' | 'unknown';
  checks: AssumptionUpdate[];
}

/** Собрать статусы из карточек (последний результат каждого источника; новая регрессия сбрасывает) */
export function collectAssumptions(cards: CommandResult[]): AssumptionState[] {
  let start = 0;
  cards.forEach((c, i) => {
    if (c.data?.kind === 'regress') start = i;
  });
  const bySrc = new Map<string, AssumptionUpdate>();
  for (const c of cards.slice(start)) for (const a of c.explain?.assumptions ?? []) bySrc.set(a.id + ':' + a.source, a);
  return ASSUMPTIONS.map((a) => {
    const checks = [...bySrc.values()].filter((u) => u.id === a.id);
    // предупреждение «тест перегружен» не перекрывает другие проверки
    const decisive = checks.filter((c) => c.status !== 'warn');
    let status: AssumptionState['status'] = 'unknown';
    if (decisive.some((c) => c.status === 'bad')) status = 'bad';
    else if (decisive.length) status = 'ok';
    else if (checks.length) status = 'warn';
    return { ...a, status, checks };
  });
}

/** Шаблонный общий вывод из всех результатов */
export function buildConclusion(cards: CommandResult[]): string {
  const reg = [...cards].reverse().find((c) => c.data?.kind === 'regress');
  const parts: string[] = [];
  if (reg?.explain?.report) parts.push(reg.explain.report);
  else parts.push('Регрессия ещё не построена — выполните reg.');
  const states = collectAssumptions(cards);
  const checked = states.filter((s) => s.status !== 'unknown');
  for (const c of cards.slice(cards.indexOf(reg!) + 1)) {
    if (c.explain?.assumptions?.length && c.explain.report) parts.push(c.explain.report);
  }
  if (checked.length) {
    const ok = states.filter((s) => s.status === 'ok').map((s) => s.id.replace('P', 'П'));
    const bad = states.filter((s) => s.status === 'bad').map((s) => s.id.replace('P', 'П'));
    const none = states.filter((s) => s.status === 'unknown').map((s) => s.id.replace('P', 'П'));
    let fin = 'Итог: ';
    if (ok.length) fin += `выполняются предпосылки ${ok.join(', ')}`;
    if (bad.length) fin += `${ok.length ? '; ' : ''}нарушены ${bad.join(', ')}`;
    if (none.length) fin += `; не проверены ${none.join(', ')}`;
    fin += '.';
    if (bad.includes('П2')) fin += ' Мультиколлинеарность завышает стандартные ошибки — часть факторов может быть ложно незначимой.';
    if (bad.includes('П4')) fin += ' Из-за гетероскедастичности стандартные ошибки следует пересчитать в робастной форме.';
    if (bad.includes('П1')) fin += ' Спецификацию модели стоит улучшить (добавить переменные или нелинейные формы).';
    parts.push(fin);
  }
  return parts.join('\n\n');
}
