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
