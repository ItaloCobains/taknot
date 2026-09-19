/** Slash-menu markdown snippets. `insert` replaces the `/query`; `cursor` is offset into insert. */
export const SLASH_COMMANDS = [
  {
    id: 'h1',
    label: 'Heading 1',
    hint: '#',
    keywords: ['h1', 'title', 'heading'],
    insert: '# ',
    cursor: 2,
  },
  {
    id: 'h2',
    label: 'Heading 2',
    hint: '##',
    keywords: ['h2', 'heading'],
    insert: '## ',
    cursor: 3,
  },
  {
    id: 'h3',
    label: 'Heading 3',
    hint: '###',
    keywords: ['h3', 'heading'],
    insert: '### ',
    cursor: 4,
  },
  {
    id: 'h4',
    label: 'Heading 4',
    hint: '####',
    keywords: ['h4', 'heading'],
    insert: '#### ',
    cursor: 5,
  },
  {
    id: 'bold',
    label: 'Bold',
    hint: '**text**',
    keywords: ['bold', 'strong'],
    insert: '****',
    cursor: 2,
  },
  {
    id: 'italic',
    label: 'Italic',
    hint: '*text*',
    keywords: ['italic', 'em'],
    insert: '**',
    cursor: 1,
  },
  {
    id: 'strike',
    label: 'Strikethrough',
    hint: '~~text~~',
    keywords: ['strike', 'strikethrough', 'del'],
    insert: '~~~~',
    cursor: 2,
  },
  {
    id: 'code',
    label: 'Inline code',
    hint: '`code`',
    keywords: ['code', 'inline'],
    insert: '``',
    cursor: 1,
  },
  {
    id: 'codeblock',
    label: 'Code block',
    hint: '```',
    keywords: ['codeblock', 'fence', 'pre'],
    insert: '```\n\n```',
    cursor: 4,
  },
  {
    id: 'ul',
    label: 'Bullet list',
    hint: '-',
    keywords: ['list', 'ul', 'bullet', 'unordered'],
    insert: '- ',
    cursor: 2,
  },
  {
    id: 'ol',
    label: 'Numbered list',
    hint: '1.',
    keywords: ['list', 'ol', 'numbered', 'ordered'],
    insert: '1. ',
    cursor: 3,
  },
  {
    id: 'task',
    label: 'Task',
    hint: '- [ ]',
    keywords: ['task', 'todo', 'checkbox', 'check'],
    insert: '- [ ] ',
    cursor: 6,
  },
  {
    id: 'taskdone',
    label: 'Task done',
    hint: '- [x]',
    keywords: ['task', 'done', 'checked'],
    insert: '- [x] ',
    cursor: 6,
  },
  {
    id: 'quote',
    label: 'Quote',
    hint: '>',
    keywords: ['quote', 'blockquote'],
    insert: '> ',
    cursor: 2,
  },
  {
    id: 'hr',
    label: 'Divider',
    hint: '---',
    keywords: ['hr', 'divider', 'line', 'rule'],
    insert: '\n---\n\n',
    cursor: 7,
  },
  {
    id: 'link',
    label: 'Link',
    hint: '[text](url)',
    keywords: ['link', 'url', 'href'],
    insert: '[]()',
    cursor: 3,
  },
  {
    id: 'image',
    label: 'Image',
    hint: '![](url)',
    keywords: ['image', 'img', 'picture'],
    insert: '![]()',
    cursor: 4,
  },
  {
    id: 'latex',
    label: 'LaTeX block',
    hint: '$$',
    keywords: ['latex', 'math', 'katex', 'formula', 'equation', 'tex'],
    insert: '$$\n\n$$',
    cursor: 3,
  },
  {
    id: 'latex-inline',
    label: 'LaTeX inline',
    hint: '$...$',
    keywords: ['latex', 'math', 'inline', 'tex'],
    insert: '$$',
    cursor: 1,
  },
  {
    id: 'table',
    label: 'Table',
    hint: '| | |',
    keywords: ['table', 'grid'],
    insert: '| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n|  |  |  |\n',
    cursor: 2,
  },
];

export function filterSlashCommands(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(
    (c) =>
      c.id.includes(q) ||
      c.label.toLowerCase().includes(q) ||
      c.keywords.some((k) => k.includes(q) || q.includes(k)),
  );
}

/** Find active `/query` before caret. Returns null if not in a slash command. */
export function detectSlash(body, caret) {
  const before = body.slice(0, caret);
  const match = before.match(/(^|\n)\/([^\n]*)$/);
  if (!match) return null;
  const start = before.length - match[0].length + match[1].length;
  return { start, end: caret, query: match[2] };
}
