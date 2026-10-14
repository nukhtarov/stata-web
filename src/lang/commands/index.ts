// Реестр команд и поиск по сокращению.
import type { CommandDef } from '../command';
import { acprplotCmd } from './acprplot';
import { captureCmd } from './capture';
import { clearCmd } from './clear';
import { correlateCmd } from './correlate';
import { describeCmd } from './describe';
import { destringCmd } from './destring';
import { dropCmd } from './drop';
import { estatCmd } from './estat';
import { generateCmd, replaceCmd } from './generate';
import { makeHelp } from './help';
import { importCmd } from './import';
import { kdensityCmd } from './kdensity';
import { linktestCmd } from './linktest';
import { listCmd } from './list';
import { ovtestCmd } from './ovtest';
import { predictCmd } from './predict';
import { pwcorrCmd } from './pwcorr';
import { qnormCmd } from './qnorm';
import { regressCmd } from './regress';
import { renameCmd } from './rename';
import { rvfplotCmd } from './rvfplot';
import { summarizeCmd } from './summarize';
import { swilkCmd } from './swilk';
import { sktestCmd } from './sktest';
import { scatterCmd, twowayCmd } from './twoway';
import { vifCmd } from './vif';

export const COMMANDS: CommandDef[] = [];

/** Найти команду по слову с учётом минимальных сокращений; `import excel` — двухсловная */
export function findCommand(word: string): CommandDef | undefined {
  const w = word.trim();
  return COMMANDS.find((c) => {
    if (c.name.includes(' ')) {
      const [a, b] = c.name.split(' ');
      const [x, y] = w.split(/\s+/);
      return x === a && y !== undefined && y.length >= 3 && b.startsWith(y);
    }
    return w === c.name || (w.length >= c.min && c.name.startsWith(w));
  });
}

COMMANDS.push(
  importCmd,
  clearCmd,
  describeCmd,
  listCmd,
  summarizeCmd,
  correlateCmd,
  pwcorrCmd,
  regressCmd,
  predictCmd,
  linktestCmd,
  ovtestCmd,
  vifCmd,
  swilkCmd,
  sktestCmd,
  estatCmd,
  kdensityCmd,
  qnormCmd,
  twowayCmd,
  scatterCmd,
  acprplotCmd,
  rvfplotCmd,
  generateCmd,
  replaceCmd,
  dropCmd,
  renameCmd,
  captureCmd,
  destringCmd,
  makeHelp(() => COMMANDS, findCommand),
);

/** Дополнительные имена: в Stata `corr` и `pwcorr`, `graph twoway` и т. п. */
export const ALIASES: Record<string, string> = {
  'graph twoway': 'twoway',
  'gr twoway': 'twoway',
  'graph tw': 'twoway',
  'gr tw': 'twoway',
};
