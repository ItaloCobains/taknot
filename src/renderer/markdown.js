import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';

marked.use(
  markedKatex({
    throwOnError: false,
    nonStandard: true,
  }),
);

/** Fix common link/image markdown mistakes before rendering. */
export function normalizeMarkdown(source) {
  let text = source || '';
  // ![https://...](url) or ![https://...]() → ![](https://...)
  text = text.replace(
    /!\[((?:https?:\/\/)[^\]]+)\]\((?:url)?\)/gi,
    '![]($1)',
  );
  // [https://...](url) or [https://...]() → [https://...](https://...)
  text = text.replace(
    /\[((?:https?:\/\/)[^\]]+)\]\((?:url)?\)/gi,
    '[$1]($1)',
  );
  // [](https://...) → [https://...](https://...)
  text = text.replace(/\[\]\(((?:https?:\/\/)[^)\s]+)\)/gi, '[$1]($1)');
  return text;
}

/** Make preview checkboxes interactive and indexed. */
export function enablePreviewTasks(html) {
  let i = 0;
  return String(html || '').replace(
    /<input([^>]*?)type="checkbox"([^>]*)>/gi,
    (_m, pre, post) => {
      const checked = /checked/i.test(pre + post);
      const idx = i++;
      return `<input type="checkbox" data-task="${idx}"${checked ? ' checked' : ''}>`;
    },
  );
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Turn [[Note Title]] into clickable wiki links in preview HTML. */
export function enableWikiLinks(html) {
  return String(html || '').replace(/\[\[([^\]\n]+?)\]\]/g, (_m, raw) => {
    const title = String(raw).trim();
    if (!title) return _m;
    const enc = encodeURIComponent(title);
    return `<a class="wiki-link" href="taknot://wiki/${enc}" data-wiki-title="${escapeHtml(title)}">${escapeHtml(title)}</a>`;
  });
}

/** Toggle the Nth markdown task `- [ ]` / `- [x]`. */
export function toggleTaskAt(body, index) {
  let i = 0;
  return String(body || '').replace(
    /^(\s*[-*+]\s+)\[([ xX])\]/gm,
    (full, prefix, box) => {
      if (i++ !== index) return full;
      const next = box.toLowerCase() === 'x' ? ' ' : 'x';
      return `${prefix}[${next}]`;
    },
  );
}

/**
 * Render note markdown → HTML (KaTeX math, tasks, wiki-links).
 * Supports `$inline$`, `$$display$$`, and non-standard `$x$` without spaces.
 */
export function renderMarkdown(source, { wiki = true, tasks = true } = {}) {
  let html = marked.parse(normalizeMarkdown(source || ''), { async: false });
  if (tasks) html = enablePreviewTasks(html);
  if (wiki) html = enableWikiLinks(html);
  return html;
}
