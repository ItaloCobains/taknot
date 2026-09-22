export const TRANSLUCENCY_KEY = 'taknot.translucency';
export const DEFAULT_TRANSLUCENCY = 55;
export const VIM_MODE_KEY = 'taknot.vimMode';
export const TAGS_COLLAPSED_KEY = 'taknot.tagsCollapsed';

export const TAG_SWATCHES = [
  '#e06c75',
  '#e5c07b',
  '#98c379',
  '#61afef',
  '#c678dd',
  '#56b6c2',
  '#d19a66',
  '#8b93a7',
];

export function readStoredTranslucency() {
  const raw = Number(localStorage.getItem(TRANSLUCENCY_KEY));
  if (Number.isFinite(raw)) return Math.min(100, Math.max(0, raw));
  return DEFAULT_TRANSLUCENCY;
}

export function readStoredTagsCollapsed() {
  try {
    return localStorage.getItem(TAGS_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function readStoredVimMode() {
  return localStorage.getItem(VIM_MODE_KEY) === '1';
}

/** Apply glass/pane CSS variables from a 0–100 translucency percent. */
export function applyTranslucency(pct) {
  // 0% ≈ sólido legível, 100% ≈ glass extremo (quase só o blur nativo)
  const t = Math.min(100, Math.max(0, pct));
  const alpha = 0.88 - (t / 100) * 0.86; // 100% → 0.02
  const root = document.documentElement;
  root.style.setProperty('--pane-alpha', String(alpha));
  root.style.setProperty(
    '--pane-strong-alpha',
    String(Math.min(0.92, alpha + 0.03)),
  );
  root.style.setProperty(
    '--surface-alpha',
    String(Math.max(0.04, alpha * 0.7)),
  );
}
