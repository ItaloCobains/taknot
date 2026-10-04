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
