import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'taknot-vault-'));
  process.env.TAKNOT_VAULT = dir;
});

afterEach(async () => {
  delete process.env.TAKNOT_VAULT;
  await rm(dir, { recursive: true, force: true });
});

test('deleteNotebook refuses to delete the Inbox', async () => {
  const { deleteNotebook } = await import('./vault');
  await expect(deleteNotebook('nb_inbox')).rejects.toThrow('Cannot delete Inbox');
});

test('moveNotebook refuses to move the Inbox', async () => {
  const { moveNotebook } = await import('./vault');
  await expect(moveNotebook('nb_inbox', null)).rejects.toThrow('Cannot move Inbox');
});

test('deleteNotebook moves a note into the Inbox', async () => {
  const { ensureVault, createNotebook, createNote, deleteNotebook, getNote } =
    await import('./vault');
  await ensureVault();
  const notebook = await createNotebook('Projects');
  const note = await createNote({ notebookId: notebook.id, title: 'Spec' });
  await deleteNotebook(notebook.id);
  const saved = await getNote(note.id);
  expect(saved.notebookId).toBe('nb_inbox');
});

test('moveNotebook refuses to move a notebook into itself', async () => {
  const { ensureVault, createNotebook, moveNotebook } = await import('./vault');
  await ensureVault();
  const notebook = await createNotebook('Projects');
  await expect(moveNotebook(notebook.id, notebook.id)).rejects.toThrow(
    'Cannot move into itself',
  );
});

test('moveNotebook refuses to move a notebook into a descendant', async () => {
  const { ensureVault, createNotebook, moveNotebook } = await import('./vault');
  await ensureVault();
  const parent = await createNotebook('Projects');
  const child = await createNotebook('Specs', parent.id);
  await expect(moveNotebook(parent.id, child.id)).rejects.toThrow(
    'Cannot move into a descendant',
  );
});

test('deleteNotebook lifts a child notebook to the deleted parent', async () => {
  const { ensureVault, createNotebook, deleteNotebook, listNotebooks } =
    await import('./vault');
  await ensureVault();
  const parent = await createNotebook('Parent');
  const child = await createNotebook('Child', parent.id);
  const grandchild = await createNotebook('Grand', child.id);
  await deleteNotebook(child.id);
  const notebooks = await listNotebooks();
  const saved = notebooks.find((n) => n.id === grandchild.id);
  expect(saved?.parentId).toBe(parent.id);
});

test('saveTag rename rewrites the name on notes', async () => {
  const { ensureVault, saveTag, createNote, saveNote, getNote } = await import('./vault');
  await ensureVault();
  const tag = await saveTag({ name: 'Draft' });
  const created = await createNote({ title: 'Spec', body: '# Spec\n' });
  await saveNote({ id: created.id, tags: ['draft'] });
  await saveTag({ id: tag.id, name: 'Shipped' });
  const saved = await getNote(created.id);
  expect(saved.tags).toEqual(['shipped']);
});

test('deleteTag strips the name from notes', async () => {
  const { ensureVault, saveTag, createNote, saveNote, deleteTag, getNote } =
    await import('./vault');
  await ensureVault();
  const tag = await saveTag({ name: 'draft' });
  const created = await createNote({ title: 'Spec', body: '# Spec\n' });
  await saveNote({ id: created.id, tags: ['draft'] });
  await deleteTag(tag.id);
  const saved = await getNote(created.id);
  expect(saved.tags).toEqual([]);
});

test('saveTag refuses a duplicate name', async () => {
  const { ensureVault, saveTag } = await import('./vault');
  await ensureVault();
  await saveTag({ name: 'Draft' });
  await expect(saveTag({ name: 'draft' })).rejects.toThrow('Tag already exists');
});

test('createNote takes the title from the first body line', async () => {
  const { ensureVault, createNote } = await import('./vault');
  await ensureVault();
  const note = await createNote({ body: '# Hello world\n\nbody' });
  expect(note.title).toBe('Hello world');
});

test('createNote lands in the Inbox when no notebook is chosen', async () => {
  const { ensureVault, createNote } = await import('./vault');
  await ensureVault();
  const note = await createNote({ title: 'Loose', body: '# Loose\n' });
  expect(note.notebookId).toBe('nb_inbox');
});

test('createNote starts active with no tags', async () => {
  const { ensureVault, createNote } = await import('./vault');
  await ensureVault();
  const note = await createNote({ title: 'Loose', body: '# Loose\n' });
  expect({ status: note.status, tags: note.tags }).toEqual({
    status: 'active',
    tags: [],
  });
});

test('duplicateNote appends (copy) to the title', async () => {
  const { ensureVault, createNote, duplicateNote } = await import('./vault');
  await ensureVault();
  const note = await createNote({ title: 'Spec', body: '# Spec\n' });
  const copy = await duplicateNote(note.id);
  expect(copy.title).toBe('Spec (copy)');
});

test('deleteNote removes the note', async () => {
  const { ensureVault, createNote, deleteNote, getNote } = await import('./vault');
  await ensureVault();
  const note = await createNote({ title: 'Spec', body: '# Spec\n' });
  await deleteNote(note.id);
  await expect(getNote(note.id)).rejects.toThrow(`Note not found: ${note.id}`);
});

test('listNotes puts a pinned note first', async () => {
  const { ensureVault, createNote, saveNote, listNotes } = await import('./vault');
  await ensureVault();
  const older = await createNote({ title: 'Older', body: '# Older\n' });
  await createNote({ title: 'Newer', body: '# Newer\n' });
  await saveNote({ id: older.id, pinned: true });
  const notes = await listNotes();
  expect(notes[0].id).toBe(older.id);
});

test('listNotes query matches the title only', async () => {
  const { ensureVault, createNote, listNotes } = await import('./vault');
  await ensureVault();
  await createNote({ title: 'Spec', body: '# Spec\n\nsecretword' });
  const byTitle = await listNotes({ query: 'spec' });
  const byBody = await listNotes({ query: 'secretword' });
  expect({ titles: byTitle.map((n) => n.title), bodies: byBody.length }).toEqual({
    titles: ['Spec'],
    bodies: 0,
  });
});

test('listNotes treats a missing markdown file as an empty body', async () => {
  const { ensureVault, createNote, listNotes } = await import('./vault');
  const { unlink } = await import('node:fs/promises');
  await ensureVault();
  const note = await createNote({ title: 'Spec', body: '# Spec\n\n- [ ] todo' });
  await unlink(`${dir}/notes/${note.id}.md`);
  const notes = await listNotes();
  expect(notes.find((n) => n.id === note.id)?.tasks).toBeNull();
});

test('getNote fails when the markdown file is missing', async () => {
  const { ensureVault, createNote, getNote } = await import('./vault');
  const { unlink } = await import('node:fs/promises');
  await ensureVault();
  const note = await createNote({ title: 'Spec', body: '# Spec\n' });
  await unlink(`${dir}/notes/${note.id}.md`);
  await expect(getNote(note.id)).rejects.toThrow('ENOENT');
});

test('ensureVault seeds the Welcome note and the taknot tag', async () => {
  const { ensureVault, listNotes, listTags } = await import('./vault');
  await ensureVault();
  const notes = await listNotes();
  const tags = await listTags();
  expect({
    title: notes.find((n) => n.id === 'note_welcome')?.title,
    tag: tags.find((t) => t.name === 'taknot')?.name,
  }).toEqual({ title: 'Welcome', tag: 'taknot' });
});

test('saveTemplate updates a custom template body', async () => {
  const { ensureVault, saveTemplate } = await import('./vault');
  await ensureVault();
  const created = await saveTemplate({ name: 'Standup', body: '# Standup' });
  const updated = await saveTemplate({
    id: created.id,
    name: 'Standup',
    body: '# Daily',
  });
  expect(updated.body).toBe('# Daily');
});

test('deleteTemplate removes a custom template', async () => {
  const { ensureVault, saveTemplate, deleteTemplate, listCustomTemplates } =
    await import('./vault');
  await ensureVault();
  const created = await saveTemplate({ name: 'Standup', body: '# Standup' });
  await deleteTemplate(created.id);
  const left = await listCustomTemplates();
  expect(left.some((t) => t.id === created.id)).toBe(false);
});

test('getWikiGraph links a wiki title to the other note', async () => {
  const { ensureVault, createNote, getWikiGraph } = await import('./vault');
  await ensureVault();
  const target = await createNote({ title: 'Target', body: '# Target\n' });
  const source = await createNote({ title: 'Source', body: '# Source\n\nSee [[Target]]' });
  const graph = await getWikiGraph();
  expect(graph.edges).toEqual([{ source: source.id, target: target.id }]);
});

test('getWikiGraph drops a self link', async () => {
  const { ensureVault, createNote, getWikiGraph } = await import('./vault');
  await ensureVault();
  await createNote({ title: 'Loop', body: '# Loop\n\n[[Loop]]' });
  const graph = await getWikiGraph();
  expect(graph.edges).toEqual([]);
});

test('saveNote keeps updatedAt when nothing changed', async () => {
  const { ensureVault, createNote, saveNote } = await import('./vault');
  await ensureVault();
  const created = await createNote({ title: 'Spec', body: '# Spec\n' });
  const saved = await saveNote({
    id: created.id,
    title: created.title,
    body: created.body,
    notebookId: created.notebookId,
    status: created.status,
    pinned: created.pinned,
    tags: created.tags,
  });
  expect(saved.updatedAt).toBe(created.updatedAt);
});
