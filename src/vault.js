const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const os = require('node:os')

function defaultUserData() {
  const home = os.homedir()
  switch (process.platform) {
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', 'taknot')
    case 'win32':
      return path.join(
        process.env.APPDATA || path.join(home, 'AppData', 'Roaming'),
        'taknot'
      )
    default:
      return path.join(
        process.env.XDG_CONFIG_HOME || path.join(home, '.config'),
        'taknot'
      )
  }
}

function vaultRoot() {
  if (process.env.TAKNOT_VAULT) return process.env.TAKNOT_VAULT
  try {
    const { app } = require('electron')
    if (app?.isReady?.() || app?.getPath) {
      return path.join(app.getPath('userData'), 'vault')
    }
  } catch {
    /* MCP / plain mode */
  }

  return path.join(defaultUserData(), 'vault')
}

function metaPath() {
  return path.join(vaultRoot(), 'meta.json');
}

function notePath(id) {
  return path.join(vaultRoot(), 'notes', `${id}.md`);
}

function now() {
  return new Date().toISOString();
}

const DEFAULT_TAG_COLOR = '#8b93a7';

function ensureMetaTemplates(meta) {
  if (!Array.isArray(meta.templates)) meta.templates = []
  return meta
}

function ensureMetaTags(meta) {
  if (!Array.isArray(meta.tags)) meta.tags = [];
  const byName = new Map(meta.tags.map((t) => [t.name, t]));
  for (const note of meta.notes) {
    for (const name of note.tags || []) {
      if (!byName.has(name)) {
        const tag = {
          id: `tag_${randomUUID()}`,
          name,
          color: DEFAULT_TAG_COLOR,
        };
        meta.tags.push(tag);
        byName.set(name, tag);
      }
    }
  }
  return meta;
}

async function readMeta() {
  const raw = await fs.readFile(metaPath(), 'utf8');
  const meta = JSON.parse(raw);
  const before = meta.tags?.length ?? -1;
  ensureMetaTags(meta);
  ensureMetaTemplates(meta)
  if ((meta.tags?.length ?? 0) !== before) {
    await writeMeta(meta);
  }
  return meta;
}

async function writeMeta(meta) {
  await fs.writeFile(metaPath(), JSON.stringify(meta, null, 2), 'utf8');
}

async function ensureVault() {
  const root = vaultRoot();
  const notesDir = path.join(root, 'notes');
  await fs.mkdir(notesDir, { recursive: true });

  try {
    await fs.access(metaPath());
  } catch {
    const createdAt = now();
    const noteId = 'note_welcome';
    const meta = {
      notebooks: [{ id: 'nb_inbox', name: 'Inbox', parentId: null, icon: 'Inbox' }],
      tags: [{ id: 'tag_taknot', name: 'taknot', color: '#61afef' }],
      notes: [
        {
          id: noteId,
          title: 'Welcome',
          notebookId: 'nb_inbox',
          tags: ['taknot'],
          status: 'active',
          createdAt,
          updatedAt: createdAt,
        },
      ],
    };
    await writeMeta(meta);
    await fs.writeFile(
      notePath(noteId),
      '# Welcome\n\nPrimeira nota do **taknot**.\n\n- Notebooks\n- Tags\n- Status\n',
      'utf8',
    );
  }
}

async function listNotebooks() {
  const meta = await readMeta();
  return meta.notebooks;
}

async function listTags() {
  const meta = await readMeta();
  return [...meta.tags].sort((a, b) => a.name.localeCompare(b.name));
}

async function saveTag(input) {
  const meta = await readMeta();
  const name = String(input.name || '').trim().toLowerCase();
  if (!name) throw new Error('Tag name required');
  const color = input.color || DEFAULT_TAG_COLOR;

  let tag = input.id ? meta.tags.find((t) => t.id === input.id) : null;
  if (tag) {
    const oldName = tag.name;
    if (name !== oldName) {
      if (meta.tags.some((t) => t.name === name && t.id !== tag.id)) {
        throw new Error('Tag already exists');
      }
      for (const note of meta.notes) {
        note.tags = (note.tags || []).map((t) => (t === oldName ? name : t));
      }
      tag.name = name;
    }
    tag.color = color;
  } else {
    if (meta.tags.some((t) => t.name === name)) {
      throw new Error('Tag already exists');
    }
    tag = { id: `tag_${randomUUID()}`, name, color };
    meta.tags.push(tag);
  }

  await writeMeta(meta);
  return tag;
}

async function deleteTag(id) {
  const meta = await readMeta();
  const tag = meta.tags.find((t) => t.id === id);
  if (!tag) throw new Error('Tag not found');
  meta.tags = meta.tags.filter((t) => t.id !== id);
  for (const note of meta.notes) {
    note.tags = (note.tags || []).filter((t) => t !== tag.name);
  }
  await writeMeta(meta);
}

function countTasks(body) {
  const text = body || '';
  const total = (text.match(/^\s*[-*+]\s+\[[ xX]\]/gm) || []).length;
  const done = (text.match(/^\s*[-*+]\s+\[[xX]\]/gm) || []).length;
  return { total, done };
}

async function listNotes(filter = {}) {
  const meta = await readMeta();
  const filtered = meta.notes
    .filter((n) => {
      if (filter.notebookId && n.notebookId !== filter.notebookId) return false;
      if (filter.status && n.status !== filter.status) return false;
      if (filter.tag && !(n.tags || []).includes(filter.tag)) return false;
      if (filter.query) {
        const q = filter.query.toLowerCase();
        if (!n.title.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const ap = a.pinned ? 1 : 0;
      const bp = b.pinned ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return b.updatedAt.localeCompare(a.updatedAt);
    });

  return Promise.all(
    filtered.map(async (n) => {
      const body = await fs.readFile(notePath(n.id), 'utf8').catch(() => '');
      const tasks = countTasks(body);
      return {
        ...n,
        tasks: tasks.total > 0 ? tasks : null,
      };
    }),
  );
}

async function getNote(id) {
  const meta = await readMeta();
  const info = meta.notes.find((n) => n.id === id);
  if (!info) throw new Error(`Note not found: ${id}`);
  const body = await fs.readFile(notePath(id), 'utf8');
  return { ...info, body };
}

async function saveNote(input) {
  const meta = await readMeta();
  const id = input.id || randomUUID();
  const existing = meta.notes.find((n) => n.id === id);
  const createdAt = existing?.createdAt || now();
  const body =
    input.body ??
    (existing ? await fs.readFile(notePath(id), 'utf8').catch(() => '') : '');
  const title = input.title ?? existing?.title ?? 'Untitled';
  const notebookId = input.notebookId ?? existing?.notebookId ?? 'nb_inbox';
  const tags = (input.tags ?? existing?.tags ?? [])
    .map((t) => String(t).trim().toLowerCase())
    .filter(Boolean);
  const status = input.status ?? existing?.status ?? 'active';
  const pinned = Boolean(
    input.pinned !== undefined ? input.pinned : existing?.pinned,
  );

  if (existing) {
    const prevBody = await fs.readFile(notePath(id), 'utf8').catch(() => '');
    const sameTags =
      JSON.stringify(existing.tags || []) === JSON.stringify(tags);
    if (
      existing.title === title &&
      existing.notebookId === notebookId &&
      existing.status === status &&
      Boolean(existing.pinned) === pinned &&
      sameTags &&
      prevBody === body
    ) {
      return { ...existing, body: prevBody };
    }
  }

  const updatedAt = now();
  const noteMeta = {
    id,
    title,
    notebookId,
    tags,
    status,
    pinned,
    createdAt,
    updatedAt,
  };

  for (const name of noteMeta.tags) {
    if (!meta.tags.some((t) => t.name === name)) {
      meta.tags.push({
        id: `tag_${randomUUID()}`,
        name,
        color: DEFAULT_TAG_COLOR,
      });
    }
  }

  if (existing) {
    Object.assign(existing, noteMeta);
  } else {
    meta.notes.push(noteMeta);
  }

  await fs.writeFile(notePath(id), body, 'utf8');
  await writeMeta(meta);
  return { ...noteMeta, body };
}

async function createNote({
  notebookId = 'nb_inbox',
  title = 'Untitled',
  body,
} = {}) {
  const content =
    body !== undefined && body !== null ? body : `# ${title}\n\n`;
  return saveNote({
    title: titleFromBody(content) || title,
    notebookId,
    tags: [],
    status: 'active',
    pinned: false,
    body: content,
  });
}

function titleFromBody(body) {
  const line = (body || '').split('\n').find((l) => l.trim());
  if (!line) return '';
  return line.replace(/^#+\s*/, '').trim();
}

async function createNotebook(name, parentId = null) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Notebook name required');
  const meta = await readMeta();
  const parent = parentId || null;
  if (parent && !meta.notebooks.some((n) => n.id === parent)) {
    throw new Error('Parent notebook not found');
  }
  const notebook = {
    id: `nb_${randomUUID()}`,
    name: trimmed,
    parentId: parent,
    icon: 'Book',
  };
  meta.notebooks.push(notebook);
  await writeMeta(meta);
  return notebook;
}

async function renameNotebook(id, name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Notebook name required');
  const meta = await readMeta();
  const nb = meta.notebooks.find((n) => n.id === id);
  if (!nb) throw new Error('Notebook not found');
  nb.name = trimmed;
  await writeMeta(meta);
  return nb;
}

async function setNotebookIcon(id, icon) {
  const meta = await readMeta();
  const nb = meta.notebooks.find((n) => n.id === id);
  if (!nb) throw new Error('Notebook not found');
  nb.icon = icon || 'Book';
  await writeMeta(meta);
  return nb;
}

async function moveNotebook(id, parentId) {
  if (id === 'nb_inbox') throw new Error('Cannot move Inbox');
  const meta = await readMeta();
  const nb = meta.notebooks.find((n) => n.id === id);
  if (!nb) throw new Error('Notebook not found');
  const parent = parentId || null;
  if (parent === id) throw new Error('Cannot move into itself');
  if (parent) {
    if (!meta.notebooks.some((n) => n.id === parent)) {
      throw new Error('Parent notebook not found');
    }
    // prevent cycles: parent cannot be a descendant of id
    let cursor = parent;
    const seen = new Set();
    while (cursor) {
      if (cursor === id) throw new Error('Cannot move into a descendant');
      if (seen.has(cursor)) break;
      seen.add(cursor);
      cursor = meta.notebooks.find((n) => n.id === cursor)?.parentId || null;
    }
  }
  nb.parentId = parent;
  await writeMeta(meta);
  return nb;
}

async function deleteNotebook(id) {
  if (id === 'nb_inbox') throw new Error('Cannot delete Inbox');
  const meta = await readMeta();
  const target = meta.notebooks.find((n) => n.id === id);
  if (!target) throw new Error('Notebook not found');
  const fallbackParent = target.parentId || null;
  meta.notebooks = meta.notebooks.filter((n) => n.id !== id);
  for (const n of meta.notebooks) {
    if (n.parentId === id) n.parentId = fallbackParent;
  }
  for (const note of meta.notes) {
    if (note.notebookId === id) note.notebookId = 'nb_inbox';
  }
  await writeMeta(meta);
}

async function deleteNote(id) {
  const meta = await readMeta();
  meta.notes = meta.notes.filter((n) => n.id !== id);
  await writeMeta(meta);
  await fs.unlink(notePath(id)).catch(() => { });
}

async function duplicateNote(id) {
  const note = await getNote(id);
  return saveNote({
    title: `${note.title} (copy)`,
    notebookId: note.notebookId,
    tags: [...(note.tags || [])],
    status: note.status,
    body: note.body,
  });
}

async function listCustomTemplates() {
  const meta = await readMeta()
  ensureMetaTemplates(meta)
  return meta.templates
}

async function saveTemplate(input) {
  const meta = await readMeta()
  ensureMetaTemplates(meta)
  const name = String(input.name || '').trim()
  if (!name) throw new Error('Template name required')

  const category = String(input.category || 'Custom').trim() || 'Custom'
  const body = String(input.body || '')

  let tpl = input.id ? meta.templates.find(t => t.id === input.id) : null

  if (tpl) {
    tpl.name = name
    tpl.category = category
    tpl.body = body
  } else {
    tpl = {
      id: `tpl_${randomUUID()}`,
      name,
      category,
      body,
      builtin: false
    }
    meta.templates.push(tpl)
  }

  await writeMeta(meta)
  return tpl
}

async function deleteTemplate(id) {
  const meta = await readMeta()
  ensureMetaTemplates(meta)
  const before = meta.templates.length;
  meta.templates = meta.templates.filter(t => t.id !== id)

  if (meta.templates.length === before) throw new Error('Template not found')

  await writeMeta(meta)
}

module.exports = {
  ensureVault,
  listNotebooks,
  listTags,
  listNotes,
  getNote,
  saveNote,
  createNote,
  createNotebook,
  renameNotebook,
  setNotebookIcon,
  moveNotebook,
  deleteNotebook,
  duplicateNote,
  deleteNote,
  saveTag,
  deleteTag,
  vaultRoot,
  listCustomTemplates,
  saveTemplate,
  deleteTemplate,
};
