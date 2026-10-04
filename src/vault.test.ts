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
