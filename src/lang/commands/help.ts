import type { CommandDef } from '../command';
import { words } from '../parser';

/** Справка; список команд подставляется из реестра */
export function makeHelp(registry: () => CommandDef[], find: (w: string) => CommandDef | undefined): CommandDef {
  return {
    name: 'help',
    min: 1,
    args: 'command',
    syntax: 'help [command]',
    summary: 'справка по команде',
    help: { what: 'Показывает справку по команде на русском языке.', look: 'Синтаксис, что делает команда и куда смотреть в выводе.', example: 'help regress' },
    run(ctx, p) {
      const w = words(p).join(' ');
      if (!w) {
        const L = ['Доступные команды:', ''];
        for (const c of registry()) L.push(`  ${c.name.padEnd(13)} ${c.summary}`);
        L.push('', 'Подробнее: help имя_команды');
        ctx.print(L.join('\n'));
        return;
      }
      const c = find(w) ?? find(w.split(' ')[0]);
      if (!c) {
        ctx.print(`help for ${w} not found`);
        return;
      }
      const L = [
        `[R] ${c.name} — ${c.summary}`,
        '',
        'Синтаксис',
        `    ${c.syntax}`,
        '',
        'Что делает',
        ...wrap(c.help.what, 76).map((s) => '    ' + s),
        '',
        'Куда смотреть',
        ...wrap(c.help.look, 76).map((s) => '    ' + s),
      ];
      if (c.options?.length) {
        L.push('', 'Опции');
        for (const o of c.options) L.push(`    ${(o.name + (o.arg ? '()' : '')).padEnd(12)} ${o.help}`);
      }
      if (c.help.example) L.push('', 'Пример', `    . ${c.help.example}`);
      ctx.print(L.join('\n'));
    },
  };
}

function wrap(s: string, w: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const word of s.split(/\s+/)) {
    if ((cur + ' ' + word).trim().length > w) {
      out.push(cur);
      cur = word;
    } else cur = (cur + ' ' + word).trim();
  }
  if (cur) out.push(cur);
  return out;
}
