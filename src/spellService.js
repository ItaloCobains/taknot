const fs = require('node:fs');
const path = require('node:path');
const Typo = require('typo-js');

function foldAccents(s) {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function dictPath(...parts) {
  return path.join(__dirname, 'dicts', ...parts);
}

function loadTypo(lang, affName, dicName) {
  const aff = fs.readFileSync(dictPath(affName), 'utf8');
  const dic = fs.readFileSync(dictPath(dicName), 'utf8');
  return new Typo(lang, aff, dic);
}

const state = {
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
      console.warn('[taknot] english dictionary failed', err?.message || err);
    }
    try {
      // Affix expansion for pt-BR — several seconds on first load.
      state.pt = loadTypo('pt_BR', 'pt-BR.aff', 'pt-BR.dic');
      console.log('[taknot] pt-BR dictionary ready');
    } catch (err) {
      console.warn('[taknot] pt-BR dictionary failed', err?.message || err);
    }
  })();
  return state.ready;
}

function isSkippableToken(word) {
  if (!word || word.length < 2) return true;
  if (/^\d+$/.test(word)) return true;
  if (/[_/\\@#]/.test(word)) return true;
  if (/[A-Z].*[A-Z]/.test(word) && /[a-z]/.test(word)) return true;
  return false;
}

function dictAccepts(dict, word) {
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

function isCorrect(word) {
  if (isSkippableToken(word)) return true;
  // Mixed-language notes: accept if either dictionary knows the word.
  if (dictAccepts(state.en, word)) return true;
  if (dictAccepts(state.pt, word)) return true;
  return false;
}

function uniquePush(out, seen, s) {
  if (!s || seen.has(s)) return;
  seen.add(s);
  out.push(s);
}

function suggest(word, limit = 8) {
  const seen = new Set();
  const accent = [];
  const enList = [];
  const ptList = [];
  const folded = foldAccents(word.toLowerCase());

  const gather = (dict, bucket) => {
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

  const out = [];
  for (const s of accent) uniquePush(out, seen, s);
  for (const s of enList) uniquePush(out, seen, s);
  for (const s of ptList) uniquePush(out, seen, s);
  return out.slice(0, limit);
}

function checkWords(words) {
  const bad = [];
  const seen = new Set();
  for (const w of words) {
    if (!w || seen.has(w)) continue;
    seen.add(w);
    if (!isCorrect(w)) bad.push(w);
  }
  return bad;
}

module.exports = {
  initSpellService,
  checkWords,
  suggest,
  isCorrect,
  whenReady: () => state.ready,
};
