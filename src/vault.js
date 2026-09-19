const fs = require('node:fs/promises');
const path = require('node:path');
const { app } = require('electron');
const { randomUUID } = require('node:crypto');

function vaultRoot() {
  return path.join(app.getPath('userData'), 'vault');
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

async function readMeta() {
  const raw = await fs.readFile(metaPath(), 'utf8');
  return JSON.parse(raw);
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
      notebooks: [{ id: 'nb_inbox', name: 'Inbox', parentId: null }],
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
  const tags = new Set();
  for (const note of meta.notes) {
    for (const tag of note.tags || []) tags.add(tag);
  }
  return [...tags].sort();
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
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

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
  const updatedAt = now();

  const noteMeta = {
    id,
    title: input.title ?? existing?.title ?? 'Untitled',
    notebookId: input.notebookId ?? existing?.notebookId ?? 'nb_inbox',
    tags: input.tags ?? existing?.tags ?? [],
    status: input.status ?? existing?.status ?? 'active',
    createdAt,
    updatedAt,
  };

  if (existing) {
    Object.assign(existing, noteMeta);
  } else {
    meta.notes.push(noteMeta);
  }

  const body = input.body ?? (existing ? await fs.readFile(notePath(id), 'utf8').catch(() => '') : '');
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
    body: content,
  });
}

function titleFromBody(body) {
  const line = (body || '').split('\n').find((l) => l.trim());
  if (!line) return '';
  return line.replace(/^#+\s*/, '').trim();
}

async function createNotebook(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Notebook name required');
  const meta = await readMeta();
  const notebook = {
    id: `nb_${randomUUID()}`,
    name: trimmed,
    parentId: null,
  };
  meta.notebooks.push(notebook);
  await writeMeta(meta);
  return notebook;
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

async function deleteNotebook(id) {
  if (id === 'nb_inbox') throw new Error('Cannot delete Inbox');
  const meta = await readMeta();
  if (!meta.notebooks.some((n) => n.id === id)) {
    throw new Error('Notebook not found');
  }
  meta.notebooks = meta.notebooks.filter((n) => n.id !== id);
  for (const note of meta.notes) {
    if (note.notebookId === id) note.notebookId = 'nb_inbox';
  }
  await writeMeta(meta);
}

async function getNotebookExport(id) {
  const meta = await readMeta();
  const nb = meta.notebooks.find((n) => n.id === id);
  if (!nb) throw new Error('Notebook not found');
  const notes = [];
  for (const info of meta.notes.filter((n) => n.notebookId === id)) {
    const body = await fs.readFile(notePath(info.id), 'utf8').catch(() => '');
    notes.push({ ...info, body });
  }
  return { notebook: nb, notes };
}

async function deleteNote(id) {
  const meta = await readMeta();
  meta.notes = meta.notes.filter((n) => n.id !== id);
  await writeMeta(meta);
  await fs.unlink(notePath(id)).catch(() => {});
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
  deleteNotebook,
  getNotebookExport,
  duplicateNote,
  deleteNote,
  vaultRoot,
};
