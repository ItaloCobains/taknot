const fs = require('node:fs');
const path = require('node:path');
const Typo = require('typo-js');

function foldAccents(s: string) {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function dictPath(...parts: string[]) {
  return path.join(__dirname, 'dicts', ...parts);
}

function loadTypo(lang: string, affName: string, dicName: string) {
  const aff = fs.readFileSync(dictPath(affName), 'utf8');
  const dic = fs.readFileSync(dictPath(dicName), 'utf8');
  return new Typo(lang, aff, dic);
}

const state: { en: any; pt: any; ready: Promise<void> } = {
  en: null,
  pt: null,
  ready: Promise.resolve(),
};

function initSpellService() {
  state.ready = (async () => {
    try {
      state.en = loadTypo('en_US', 'en.aff', 'en.dic');
      console.log('[taknot] english dictionary ready');
    } catch (err) {
      console.warn('[taknot] english dictionary failed', (err instanceof Error ? err.message : err));
    }
    try {
      // Affix expansion for pt-BR — several seconds on first load.
      state.pt = loadTypo('pt_BR', 'pt-BR.aff', 'pt-BR.dic');
      console.log('[taknot] pt-BR dictionary ready');
    } catch (err) {
      console.warn('[taknot] pt-BR dictionary failed', (err instanceof Error ? err.message : err));
    }
  })();
  return state.ready;
}

function isSkippableToken(word: string) {
  if (!word || word.length < 2) return true;
  if (/^\d+$/.test(word)) return true;
  if (/[_/\\@#]/.test(word)) return true;
  if (/[A-Z].*[A-Z]/.test(word) && /[a-z]/.test(word)) return true;
  return false;
}

function dictAccepts(dict: any, word: string) {
  if (!dict) return false;
  if (dict.check(word)) return true;
  const lower = word.toLowerCase();
  if (lower !== word && dict.check(lower)) return true;
  if (word.length > 1) {
    const title = word[0].toUpperCase() + word.slice(1).toLowerCase();
    if (title !== word && dict.check(title)) return true;
  }
  return false;
}

function isCorrect(word: string) {
  if (isSkippableToken(word)) return true;
  // Mixed-language notes: accept if either dictionary knows the word.
  if (dictAccepts(state.en, word)) return true;
  if (dictAccepts(state.pt, word)) return true;
  return false;
}

function uniquePush(out: string[], seen: Set<string>, s: string) {
  if (!s || seen.has(s)) return;
  seen.add(s);
  out.push(s);
}

function suggest(word: string, limit = 8): string[] {
  const seen = new Set<string>();
  const accent: string[] = [];
  const enList: string[] = [];
  const ptList: string[] = [];
  const folded = foldAccents(word.toLowerCase());

  const gather = (dict: any, bucket: string[]) => {
    if (!dict) return;
    try {
      for (const s of dict.suggest(word) || []) bucket.push(s);
      const lower = word.toLowerCase();
      if (lower !== word) {
        for (const s of dict.suggest(lower) || []) bucket.push(s);
      }
    } catch {
      /* ignore */
    }
  };

  gather(state.pt, ptList);
  gather(state.en, enList);

  for (const s of ptList) {
    if (
      foldAccents(s.toLowerCase()) === folded &&
      s.toLowerCase() !== word.toLowerCase()
    ) {
      accent.push(s);
    }
  }

  const out: string[] = [];
  for (const s of accent) uniquePush(out, seen, s);
  for (const s of enList) uniquePush(out, seen, s);
  for (const s of ptList) uniquePush(out, seen, s);
  return out.slice(0, limit);
}

function checkWords(words: string[]): string[] {
  const bad = [];
  const seen = new Set<string>();
  for (const w of words) {
    if (!w || seen.has(w)) continue;
    seen.add(w);
    if (!isCorrect(w)) bad.push(w);
  }
  return bad;
}

function whenReady() {
  return state.ready;
}

module.exports = {
  initSpellService,
  checkWords,
  suggest,
  isCorrect,
  whenReady,
};

export { initSpellService, checkWords, suggest, isCorrect, whenReady };
