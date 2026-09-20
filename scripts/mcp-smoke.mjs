import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['/Users/italo/apps/taknot/src/mcp/server.mjs'],
  env: {
    ...process.env,
    TAKNOT_VAULT: '/Users/italo/Library/Application Support/taknot/vault',
  },
});

const client = new Client({ name: 'taknot-smoke', version: '1.0.0' });
await client.connect(transport);

function parse(result) {
  const text = result.content?.map((c) => c.text).join('\n') || '';
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text, isError: result.isError };
  }
}

const tools = await client.listTools();
const names = tools.tools.map((t) => t.name).sort();
console.log('TOOLS', names.length, names.join(','));

const notebooks = parse(await client.callTool({ name: 'list_notebooks', arguments: {} }));
console.log('NOTEBOOKS', Array.isArray(notebooks) ? notebooks.length : notebooks);

const created = parse(
  await client.callTool({
    name: 'create_note',
    arguments: {
      title: 'MCP smoke test',
      body: '# MCP smoke\n\nCreated by automated smoke test.\n',
      tags: ['taknot', 'mcp-smoke'],
    },
  }),
);
console.log('CREATE', created.id, created.title, created.tags);

const got = parse(await client.callTool({ name: 'get_note', arguments: { id: created.id } }));
console.log('GET body starts', String(got.body || '').slice(0, 40));

const updated = parse(
  await client.callTool({
    name: 'update_note',
    arguments: { id: created.id, body: '# MCP smoke\n\nUpdated OK.\n', status: 'active' },
  }),
);
console.log('UPDATE', updated.id, String(updated.body || '').includes('Updated OK'));

const tag = parse(
  await client.callTool({
    name: 'save_tag',
    arguments: { name: 'mcp-smoke', color: '#5eead4' },
  }),
);
console.log('TAG', tag.id, tag.name);

const sub = parse(
  await client.callTool({
    name: 'create_notebook',
    arguments: { name: 'MCP Smoke Sub', parentId: 'nb_inbox' },
  }),
);
console.log('SUB_NB', sub.id, sub.parentId);

const moved = parse(
  await client.callTool({
    name: 'update_note',
    arguments: { id: created.id, notebookId: sub.id },
  }),
);
console.log('MOVE_NOTE', moved.notebookId);

const delNote = parse(await client.callTool({ name: 'delete_note', arguments: { id: created.id } }));
console.log('DEL_NOTE', delNote);

const delNb = parse(await client.callTool({ name: 'delete_notebook', arguments: { id: sub.id } }));
console.log('DEL_NB', delNb);

const inboxGuard = parse(
  await client.callTool({ name: 'delete_notebook', arguments: { id: 'nb_inbox' } }),
);
console.log('INBOX_GUARD', inboxGuard);

await client.close();
console.log('SMOKE_OK');
