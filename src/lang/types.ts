// Общие типы результата выполнения команды.
import type { OLSResult } from '../stats/ols';

export interface Series {
  type: 'scatter' | 'line';
  x: number[];
  y: number[];
  label: string;
  color: string;
  /** линия: толщина / пунктир */
  dash?: boolean;
}

export interface GraphSpec {
  title?: string;
  xtitle: string;
  ytitle: string;
  series: Series[];
  yline?: number[];
  note?: string;
  legend: boolean;
}

export type Block =
  | { type: 'text'; text: string }
  | { type: 'error'; text: string; code: number; hint?: string }
  | { type: 'graph'; graph: GraphSpec; name: string };

export type Verdict = 'good' | 'bad' | 'info';
export type AssumptionId = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

export interface AssumptionUpdate {
  id: AssumptionId;
  status: 'ok' | 'bad' | 'warn';
  source: string;
  note: string;
}

export interface Explanation {
  verdict: Verdict;
  title: string;
  /** абзацы простым языком */
  text: string[];
  /** готовая фраза для отчёта */
  report?: string;
  warning?: string;
  assumptions?: AssumptionUpdate[];
}

/** Данные результата для модуля explain */
export type ResultData =
  | { kind: 'regress'; m: OLSResult }
  | { kind: 'linktest'; m: OLSResult }
  | { kind: 'ovtest'; F: number; df1: number; df2: number; p: number; depvar: string }
  | { kind: 'vif'; rows: { name: string; vif: number }[]; mean: number }
  | { kind: 'swilk'; rows: { name: string; N: number; W: number; V: number; z: number; p: number }[]; isResid: boolean }
  | { kind: 'hettest'; chi2: number; df: number; p: number; depvar: string }
  | {
      kind: 'imtest';
      het: { chi2: number; df: number; p: number };
      skew: { chi2: number; df: number; p: number };
      kurt: { chi2: number; df: number; p: number };
      total: { chi2: number; df: number; p: number };
      N: number;
      saturated: boolean;
      white: boolean;
    }
  | { kind: 'summarize'; rows: { name: string; N: number; mean: number; sd: number; min: number; max: number }[]; residVar?: string; residMaxAbs?: number }
  | {
      kind: 'correlate';
      names: string[];
      R: number[][];
      N: number;
      /** pwcorr: p-значения, уровень star(), попарное удаление пропусков */
      P?: number[][];
      star?: number;
      pairwise?: boolean;
    }
  | { kind: 'sktest'; rows: { name: string; N: number; pSkew: number; pKurt: number; chi2: number; p: number }[]; isResid: boolean }
  | { kind: 'graph'; graph: 'scatter' | 'twoway' | 'kdensity' | 'acprplot' | 'rvfplot' | 'qnorm'; x?: string; y?: string; normal?: boolean; lowess?: boolean; slope?: number; bw?: number }
  | { kind: 'describe'; N: number; k: number }
  | { kind: 'import'; nvars: number; nobs: number; commaNumeric: string[] }
  | { kind: 'predict'; name: string; what: 'xb' | 'resid' }
  | { kind: 'other' };

export interface CommandResult {
  /** эхо команды как в Stata: ". reg Price Gini" */
  echo: string;
  blocks: Block[];
  data?: ResultData;
  explain?: Explanation;
  ok: boolean;
}
