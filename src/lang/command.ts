// Контракт команды и контекст выполнения.
import type { Dataset } from '../data/dataset';
import type { OLSResult } from '../stats/ols';
import type { OptionDef, Parsed } from './parser';
import type { GraphSpec, ResultData } from './types';

export interface Estimates {
  m: OLSResult;
  /** номера наблюдений, вошедших в выборку (e(sample)) */
  rows: number[];
  /** регрессоры в исходном порядке, включая исключённые */
  xnames: string[];
  cmdline: string;
}

export interface FileRequest {
  name: string;
  data: ArrayBuffer;
}

export interface Ctx {
  ds: Dataset;
  est: Estimates | null;
  setEst(e: Estimates | null): void;
  /** переменные-остатки, созданные predict …, resid */
  residVars: Set<string>;
  print(text: string): void;
  graph(spec: GraphSpec, name: string): void;
  setData(d: ResultData): void;
  /** запросить у пользователя файл (браузер не видит пути) */
  requestFile(pathHint: string): Promise<FileRequest | null>;
  /** выполнить вложенную команду (capture) */
  exec(line: string): Promise<void>;
}

export type ArgKind = 'varlist' | 'var' | 'newvar' | 'none' | 'assign' | 'command' | 'path' | 'twoway' | 'sub';

export interface CommandDef {
  name: string;
  /** минимальная длина сокращения (как подчёркнуто в справке Stata) */
  min: number;
  /** что идёт после имени — для автодополнения */
  args: ArgKind;
  syntax: string;
  /** короткая подсказка: «линейная регрессия (МНК)» */
  summary: string;
  options?: OptionDef[];
  /** подробная справка на русском для `help` */
  help: { what: string; look: string; example?: string };
  /** разобрать if/in */
  ifin?: boolean;
  run(ctx: Ctx, p: Parsed): void | Promise<void>;
}
