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


const GITHUB_ALERTS = {
  NOTE: { label: 'Note', cls: 'note' },
  TIP: { label: 'Tip', cls: 'tip' },
  IMPORTANT: { label: 'Important', cls: 'important' },
  WARNING: { label: 'Warning', cls: 'warning' },
  CAUTION: { label: 'Caution', cls: 'caution' },
};

const ALERT_ICONS = {
  NOTE: '<svg class="markdown-alert-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-3.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2ZM7 7.75A.75.75 0 0 1 7.75 7h.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75v-3.5Z"/></svg>',
  TIP: '<svg class="markdown-alert-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.193.228.378.446.536.696.15.237.263.493.263.797v.75h2v-.75c0-.604.222-.997.493-1.39.273-.394.585-.752.84-1.053C10.37 6.027 10.5 5.55 10.5 5.25c0-1.41-.91-2.75-2.5-2.75Zm-1 10.25a1 1 0 1 1 2 0v.25a1 1 0 1 1-2 0v-.25Z"/></svg>',
  IMPORTANT: '<svg class="markdown-alert-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>',
  WARNING: '<svg class="markdown-alert-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>',
  CAUTION: '<svg class="markdown-alert-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.141.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>',
};

/** Turn GitHub-style `> [!NOTE]` blockquotes into colored alert callouts. */
export function enableGitHubAlerts(html) {
  return String(html || '').replace(
    /<blockquote>\s*<p>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*([^\n<]*)([\s\S]*?)<\/blockquote>/gi,
    (_full, typeRaw, sameLineRest, after) => {
      const type = String(typeRaw).toUpperCase();
      const meta = GITHUB_ALERTS[type];
      if (!meta) return _full;

      const customTitle = String(sameLineRest || '').trim();
      let rem = String(after || '').replace(/^\n+/, '');
      const bodyParts = [];

      if (rem.startsWith('</p>')) {
        rem = rem.slice(4).trim();
        if (rem) bodyParts.push(rem);
      } else {
        const close = rem.indexOf('</p>');
        if (close >= 0) {
          const firstBody = rem.slice(0, close).trim();
          if (firstBody) {
            bodyParts.push(`<p>${firstBody.replace(/\n/g, '<br>')}</p>`);
          }
          rem = rem.slice(close + 4).trim();
          if (rem) bodyParts.push(rem);
        } else if (rem.trim()) {
          bodyParts.push(rem.trim());
        }
      }

      const title = customTitle || meta.label;
      const icon = ALERT_ICONS[type] || '';
      return (
        `<div class="markdown-alert markdown-alert-${meta.cls}" data-alert="${type}">` +
        `<p class="markdown-alert-title">${icon}<span>${escapeHtml(title)}</span></p>` +
        `${bodyParts.join('\n')}` +
        `</div>`
      );
    },
  );
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
  html = enableGitHubAlerts(html);
  if (tasks) html = enablePreviewTasks(html);
  if (wiki) html = enableWikiLinks(html);
  return html;
}
