import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const require = createRequire(import.meta.url);
const vault = require('../vault.js');

function ok(data) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

function fail(err) {
  const message = err?.message || String(err);
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
    isError: true,
  };
}

const server = new McpServer({
  name: 'taknot',
  version: '0.0.9',
});

// ── Notes ──────────────────────────────────────────────

server.tool(
  'list_notes',
  'List notes. Optional filters: notebookId, tag, status, query (title search).',
  {
    notebookId: z.string().optional(),
    tag: z.string().optional(),
    status: z.string().optional(),
    query: z.string().optional(),
  },
  async (args) => {
    try {
      await vault.ensureVault();
      return ok(await vault.listNotes(args));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'get_note',
  'Get one note by id (includes markdown body).',
  { id: z.string() },
  async ({ id }) => {
    try {
      await vault.ensureVault();
      const note = await vault.getNote(id);
      if (!note) return fail(new Error('Note not found'));
      return ok(note);
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'create_note',
  'Create a note. Defaults notebook to Inbox.',
  {
    title: z.string().optional(),
    body: z.string().optional(),
    notebookId: z.string().optional(),
    tags: z.array(z.string()).optional(),
    status: z.string().optional(),
  },
  async (args) => {
    try {
      await vault.ensureVault();
      const note = await vault.createNote({
        notebookId: args.notebookId,
        title: args.title,
        body: args.body,
      });
      if (args.tags || args.status || args.body != null || args.title != null) {
        return ok(
          await vault.saveNote({
            id: note.id,
            title: args.title ?? note.title,
            body: args.body ?? note.body,
            notebookId: args.notebookId ?? note.notebookId,
            tags: args.tags ?? note.tags,
            status: args.status ?? note.status,
          }),
        );
      }
      return ok(note);
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'update_note',
  'Update note fields (title, body, tags, notebookId, status, pinned).',
  {
    id: z.string(),
    title: z.string().optional(),
    body: z.string().optional(),
    tags: z.array(z.string()).optional(),
    notebookId: z.string().optional(),
    status: z.string().optional(),
    pinned: z.boolean().optional(),
  },
  async (args) => {
    try {
      await vault.ensureVault();
      return ok(await vault.saveNote(args));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'delete_note',
  'Delete a note by id.',
  { id: z.string() },
  async ({ id }) => {
    try {
      await vault.ensureVault();
      await vault.deleteNote(id);
      return ok({ deleted: id });
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'duplicate_note',
  'Duplicate a note by id.',
  { id: z.string() },
  async ({ id }) => {
    try {
      await vault.ensureVault();
      return ok(await vault.duplicateNote(id));
    } catch (e) {
      return fail(e);
    }
  },
);

// ── Tags ───────────────────────────────────────────────

server.tool('list_tags', 'List all tags.', {}, async () => {
  try {
    await vault.ensureVault();
    return ok(await vault.listTags());
  } catch (e) {
    return fail(e);
  }
});

server.tool(
  'save_tag',
  'Create or update a tag. Pass id to update; omit id to create.',
  {
    id: z.string().optional(),
    name: z.string(),
    color: z.string().optional(),
  },
  async (args) => {
    try {
      await vault.ensureVault();
      return ok(await vault.saveTag(args));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'delete_tag',
  'Delete a tag by id (removes it from notes).',
  { id: z.string() },
  async ({ id }) => {
    try {
      await vault.ensureVault();
      await vault.deleteTag(id);
      return ok({ deleted: id });
    } catch (e) {
      return fail(e);
    }
  },
);

// ── Notebooks ──────────────────────────────────────────

server.tool('list_notebooks', 'List notebooks (tree via parentId).', {}, async () => {
  try {
    await vault.ensureVault();
    return ok(await vault.listNotebooks());
  } catch (e) {
    return fail(e);
  }
});

server.tool(
  'create_notebook',
  'Create a notebook. parentId makes it a sub-notebook.',
  {
    name: z.string(),
    parentId: z.string().nullable().optional(),
  },
  async ({ name, parentId }) => {
    try {
      await vault.ensureVault();
      return ok(await vault.createNotebook(name, parentId ?? null));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'rename_notebook',
  'Rename a notebook.',
  { id: z.string(), name: z.string() },
  async ({ id, name }) => {
    try {
      await vault.ensureVault();
      return ok(await vault.renameNotebook(id, name));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'set_notebook_icon',
  'Set notebook icon name (Lucide id used by the app).',
  { id: z.string(), icon: z.string() },
  async ({ id, icon }) => {
    try {
      await vault.ensureVault();
      return ok(await vault.setNotebookIcon(id, icon));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'move_notebook',
  'Move notebook under a new parent (null = root).',
  {
    id: z.string(),
    parentId: z.string().nullable(),
  },
  async ({ id, parentId }) => {
    try {
      await vault.ensureVault();
      return ok(await vault.moveNotebook(id, parentId));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'delete_notebook',
  'Delete notebook. Notes move to Inbox. Cannot delete Inbox.',
  { id: z.string() },
  async ({ id }) => {
    try {
      if (id === 'nb_inbox') return fail(new Error('Cannot delete Inbox'));
      await vault.ensureVault();
      await vault.deleteNotebook(id);
      return ok({ deleted: id });
    } catch (e) {
      return fail(e);
    }
  },
);

// ── boot ───────────────────────────────────────────────

await vault.ensureVault();
console.error(`[taknot-mcp] vault: ${vault.vaultRoot()}`);

const transport = new StdioServerTransport();
await server.connect(transport);
