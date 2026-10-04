import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';

let dir: string;
let client: Client;

function parse(result: { content?: { text?: string }[] }) {
  const text = result.content?.map((part) => part.text).join('\n') || '';
  return JSON.parse(text);
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'taknot-mcp-'));
  process.env.TAKNOT_VAULT = dir;
  const vault = await import('./vault');
  const { startMcpHttp } = await import('./mcpHttp');
  await vault.ensureVault();
  const started = await startMcpHttp({ vault, version: 'test', port: 28141 });
  if (!started.running || !started.url) {
    throw new Error(started.error || 'MCP did not start');
  }
  client = new Client({ name: 'taknot-test', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(started.url)));
});

afterEach(async () => {
  await client.close();
  const { stopMcpHttp } = await import('./mcpHttp');
  await stopMcpHttp();
  delete process.env.TAKNOT_VAULT;
  await rm(dir, { recursive: true, force: true });
});

test('create_note keeps the tags passed by the agent', async () => {
  const created = parse(
    await client.callTool({
      name: 'create_note',
      arguments: { title: 'MCP', body: '# MCP\n', tags: ['mcp'] },
    }),
  );
  expect(created.tags).toEqual(['mcp']);
});

test('get_note returns the body that was saved', async () => {
  const created = parse(
    await client.callTool({
      name: 'create_note',
      arguments: { title: 'MCP', body: '# MCP\n\nhello' },
    }),
  );
  const got = parse(await client.callTool({ name: 'get_note', arguments: { id: created.id } }));
  expect(got.body).toBe('# MCP\n\nhello');
});

test('update_note moves a note into another notebook', async () => {
  const created = parse(
    await client.callTool({
      name: 'create_note',
      arguments: { title: 'MCP', body: '# MCP\n' },
    }),
  );
  const sub = parse(
    await client.callTool({
      name: 'create_notebook',
      arguments: { name: 'Sub', parentId: 'nb_inbox' },
    }),
  );
  const moved = parse(
    await client.callTool({
      name: 'update_note',
      arguments: { id: created.id, notebookId: sub.id },
    }),
  );
  expect(moved.notebookId).toBe(sub.id);
});

test('duplicate_note appends (copy) to the title', async () => {
  const created = parse(
    await client.callTool({
      name: 'create_note',
      arguments: { title: 'MCP', body: '# MCP\n' },
    }),
  );
  const copy = parse(
    await client.callTool({ name: 'duplicate_note', arguments: { id: created.id } }),
  );
  expect(copy.title).toBe('MCP (copy)');
});

test('delete_note makes a later get fail', async () => {
  const created = parse(
    await client.callTool({
      name: 'create_note',
      arguments: { title: 'MCP', body: '# MCP\n' },
    }),
  );
  await client.callTool({ name: 'delete_note', arguments: { id: created.id } });
  const got = parse(await client.callTool({ name: 'get_note', arguments: { id: created.id } }));
  expect(got.error).toContain('Note not found');
});

test('delete_notebook refuses the Inbox', async () => {
  const result = parse(
    await client.callTool({ name: 'delete_notebook', arguments: { id: 'nb_inbox' } }),
  );
  expect(result.error).toBe('Cannot delete Inbox');
});

test('move_notebook refuses the Inbox', async () => {
  const result = parse(
    await client.callTool({
      name: 'move_notebook',
      arguments: { id: 'nb_inbox', parentId: null },
    }),
  );
  expect(result.error).toBe('Cannot move Inbox');
});

test('list_notebooks includes the Inbox', async () => {
  const notebooks = parse(await client.callTool({ name: 'list_notebooks', arguments: {} }));
  expect(notebooks.some((nb: { id: string }) => nb.id === 'nb_inbox')).toBe(true);
});
