import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';

const dir = await mkdtemp(path.join(tmpdir(), 'taknot-vault-'));
process.env.TAKNOT_VAULT = dir;

afterEach(async () => {
  delete process.env.TAKNOT_VAULT;
  await rm(dir, { recursive: true, force: true });
});

test('deleteNotebook refuses to delete the Inbox', async () => {
  const { deleteNotebook } = await import('./vault');
  await expect(deleteNotebook('nb_inbox')).rejects.toThrow('Cannot delete Inbox');
});
