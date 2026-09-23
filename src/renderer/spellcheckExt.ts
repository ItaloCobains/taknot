import { StateEffect, StateField, RangeSetBuilder } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view';

const WORD_RE = /\p{L}+(?:['’]\p{L}+)?/gu;

/** @type {StateEffect<Set<string>>} */
export const setMisspelledEffect = StateEffect.define<Set<string>>();

/** Words the user added via "Add to dictionary" (session + localStorage). */
const CUSTOM_KEY = 'taknot.spell.custom';

function loadCustomWords() {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map((w) => String(w).toLowerCase()) : []);
  } catch {
    return new Set();
  }
}

let customWords = loadCustomWords();

export function addCustomWord(word: string) {
  const w = String(word || '').toLowerCase();
  if (!w) return;
  customWords.add(w);
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify([...customWords]));
  } catch {
    /* ignore */
  }
}

export const misspelledField = StateField.define({
  create: () => new Set(),
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setMisspelledEffect)) return e.value;
    }
    return value;
  },
});

const spellMark = Decoration.mark({ class: 'cm-spell-error' });

/** Ranges inside fenced code blocks (``` ... ```). */
function codeFenceRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const re = /^```[\s\S]*?^```/gm;
  let m;
  while ((m = re.exec(text))) {
    ranges.push([m.index, m.index + m[0].length]);
  }
  return ranges;
}

function inRanges(pos: number, ranges: Array<[number, number]>) {
  for (const [a, b] of ranges) {
    if (pos >= a && pos < b) return true;
  }
  return false;
}

function collectWords(text: string): string[] {
  const fences = codeFenceRanges(text);
  const words: string[] = [];
  const seen = new Set<string>();
  WORD_RE.lastIndex = 0;
  let m;
  while ((m = WORD_RE.exec(text))) {
    if (inRanges(m.index, fences)) continue;
    const w = m[0];
    if (customWords.has(w.toLowerCase())) continue;
    if (!seen.has(w)) {
      seen.add(w);
      words.push(w);
    }
  }
  return words;
}

function buildDecorations(state: any) {
  const bad = state.field(misspelledField);
  if (!bad || bad.size === 0) return Decoration.none;

  const text = state.doc.toString();
  const fences = codeFenceRanges(text);
  const builder = new RangeSetBuilder();
  WORD_RE.lastIndex = 0;
  let m;
  while ((m = WORD_RE.exec(text))) {
    if (inRanges(m.index, fences)) continue;
    const w = m[0];
    if (customWords.has(w.toLowerCase())) continue;
    if (bad.has(w) || bad.has(w.toLowerCase())) {
      builder.add(m.index, m.index + w.length, spellMark);
    }
  }
  return builder.finish();
}

// Recompute decorations whenever misspelled set changes.
export const spellDecorationField = StateField.define({
  create(state: any) {
    return buildDecorations(state);
  },
  update(deco: any, tr: any) {
    if (
      tr.docChanged ||
      tr.effects.some((e: any) => e.is(setMisspelledEffect))
    ) {
      return buildDecorations(tr.state);
    }
    return deco;
  },
  provide: (f: any) => EditorView.decorations.from(f),
});

function spellcheckWatcher() {
  return ViewPlugin.fromClass(
    class {
      timer: ReturnType<typeof setTimeout> | null = null;
      constructor(view: any) {
        this.queue(view);
      }
      update(update: any) {
        if (update.docChanged) this.queue(update.view);
      }
      destroy() {
        if (this.timer) clearTimeout(this.timer);
      }
      queue(view: any) {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          void this.run(view);
        }, 320);
      }
      async run(view: any) {
        const api = window.taknot;
        if (!api?.checkSpelling) return;
        const words = collectWords(view.state.doc.toString());
        let bad: string[] = [];
        try {
          bad = (await api.checkSpelling(words)) as string[];
        } catch (err) {
          console.warn('[taknot] spell check failed', err);
          return;
        }
        if (view.hasFocus || true) {
          const set = new Set(bad);
          // Also mark lowercase variants for matching
          for (const w of bad) set.add(w.toLowerCase());
          view.dispatch({ effects: setMisspelledEffect.of(set) });
        }
      }
    },
  );
}

/** Word under absolute document position. */
export function wordAt(state: any, pos: number) {
  const line = state.doc.lineAt(pos);
  const text = line.text;
  const local = pos - line.from;
  WORD_RE.lastIndex = 0;
  let m;
  while ((m = WORD_RE.exec(text))) {
    if (local >= m.index && local <= m.index + m[0].length) {
      return {
        word: m[0],
        from: line.from + m.index,
        to: line.from + m.index + m[0].length,
      };
    }
  }
  return null;
}

export function spellcheckExtension() {
  return [misspelledField, spellDecorationField, spellcheckWatcher()];
}