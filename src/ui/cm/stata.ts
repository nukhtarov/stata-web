// CodeMirror 6: язык Stata (подсветка) и автодополнение из src/lang/completions.ts.
import { StreamLanguage, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { tags as t } from '@lezer/highlight';
import { COMMANDS, findCommand } from '../../lang/commands';
import { complete, type VarInfo } from '../../lang/completions';

const ALL_WORDS = new Set(COMMANDS.flatMap((c) => c.name.split(' ')));

interface St {
  atStart: boolean;
  inBlock: boolean;
}

export const stataLanguage = StreamLanguage.define<St>({
  name: 'stata',
  startState: () => ({ atStart: true, inBlock: false }),
  token(stream, st) {
    if (stream.sol()) st.atStart = true;
    if (st.inBlock) {
      if (stream.skipTo('*/')) {
        stream.pos += 2;
        st.inBlock = false;
      } else stream.skipToEnd();
      return 'comment';
    }
    if (stream.eatSpace()) return null;
    if (st.atStart && stream.match(/^\*.*/)) return 'comment';
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match('/*')) {
      st.inBlock = true;
      return 'comment';
    }
    if (stream.match(/^"[^"]*"?/)) {
      st.atStart = false;
      return 'string';
    }
    if (stream.match(/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i)) {
      st.atStart = false;
      return 'number';
    }
    if (st.atStart && stream.match(/^\.(?=\s)/)) return 'meta';
    const w = stream.match(/^[A-Za-z_][A-Za-z0-9_]*/) as RegExpMatchArray | null;
    if (w) {
      const word = w[0];
      const wasStart = st.atStart;
      st.atStart = false;
      if (wasStart && (findCommand(word) || ALL_WORDS.has(word))) {
        // capture и graph — префиксы: следующая команда тоже подсвечивается
        if (/^cap/.test(word) || word === 'graph' || word === 'gr') st.atStart = true;
        return 'keyword';
      }
      if (['scatter', 'lfit', 'line', 'excel', 'hettest', 'imtest', 'if', 'in', 'using'].includes(word)) return 'keyword';
      return 'variableName';
    }
    stream.next();
    st.atStart = false;
    return 'operator';
  },
  languageData: { commentTokens: { line: '//' } },
});

export const stataHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.keyword, color: 'var(--syn-keyword)', fontWeight: '600' },
    { tag: t.comment, color: 'var(--syn-comment)', fontStyle: 'italic' },
    { tag: t.string, color: 'var(--syn-string)' },
    { tag: t.number, color: 'var(--syn-number)' },
    { tag: t.meta, color: 'var(--syn-comment)' },
    { tag: t.variableName, color: 'var(--fg)' },
    { tag: t.operator, color: 'var(--syn-op)' },
  ]),
);

export function stataCompletion(getVars: () => VarInfo[]) {
  return autocompletion({
    activateOnTyping: true,
    icons: false,
    // по умолчанию Tab/Enter игнорируются 75 мс после обновления списка — при быстром наборе это теряет нажатия
    interactionDelay: 0,
    override: [
      (ctx: CompletionContext): CompletionResult | null => {
        const line = ctx.state.doc.lineAt(ctx.pos);
        const r = complete(line.text, ctx.pos - line.from, getVars());
        if (!r) return null;
        const word = line.text.slice(r.from, ctx.pos - line.from);
        if (!ctx.explicit && word === '' && !/[,(\s]$/.test(line.text.slice(0, ctx.pos - line.from))) return null;
        if (!r.options.length) return null;
        return {
          from: line.from + r.from,
          options: r.options.map((o, i) => ({ label: o.label, apply: o.apply, detail: o.detail, type: o.type, boost: -i / 1000 })),
          validFor: /^[A-Za-z_0-9]*$/,
        };
      },
    ],
  });
}
