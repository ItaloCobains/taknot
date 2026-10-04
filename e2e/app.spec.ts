import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const mainJs = path.join(process.cwd(), '.vite/build/main.js');

let mcpPort = 29140;

function tagBtn(page: Page, name: string) {
  return page.locator('.sidebar').getByRole('button', { name, exact: true });
}

async function clipboardText(app: ElectronApplication) {
  return app.evaluate(({ clipboard }) => clipboard.readText());
}

function noteBtn(page: Page, title: string) {
  const exact = new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  return page.locator('.note-item').filter({
    has: page.locator('.note-item-title', { hasText: exact }),
  });
}

async function openApp() {
  mcpPort += 1;
  const dir = await mkdtemp(path.join(tmpdir(), 'taknot-e2e-'));
  const userData = await mkdtemp(path.join(tmpdir(), 'taknot-e2e-user-'));
  const app = await electron.launch({
    args: [`--user-data-dir=${userData}`, mainJs],
    env: {
      ...process.env,
      TAKNOT_VAULT: dir,
      TAKNOT_MCP_PORT: String(mcpPort),
    },
  });
  const page = await app.firstWindow();
  await page.getByRole('button', { name: 'All Notes' }).waitFor();
  return { app, page, dir, userData, mcpUrl: `http://127.0.0.1:${mcpPort}/mcp` };
}

async function closeApp(app: ElectronApplication, dir: string, userData: string) {
  await app.close();
  await rm(dir, { recursive: true, force: true });
  await rm(userData, { recursive: true, force: true });
}

async function replaceBody(page: Page, lines: string[]) {
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(lines[0] ?? '');
  for (const line of lines.slice(1)) {
    await page.keyboard.press('Enter');
    if (line) await page.keyboard.insertText(line);
  }
}

async function createBlank(page: Page, lines: string[]) {
  await page.getByRole('button', { name: 'Blank note' }).click();
  await page.getByRole('button', { name: 'Create note', exact: true }).click();
  await replaceBody(page, lines);
  const title = lines[0].replace(/^#+\s*/, '');
  await expect(noteBtn(page, title)).toBeVisible();
}

async function closeSettings(page: Page) {
  await page
    .getByRole('dialog', { name: 'Settings' })
    .locator('.settings-panel-header button')
    .click();
}

test('first open seeds Inbox, the taknot tag, and Welcome', async () => {
  const { app, page, dir, userData } = await openApp();
  try {
    await expect(page.getByRole('button', { name: 'Inbox', exact: true })).toBeVisible();
    await expect(noteBtn(page, 'Welcome')).toBeVisible();
    await expect(page.getByRole('button', { name: 'taknot', exact: true })).toBeVisible();
  } finally {
    await closeApp(app, dir, userData);
  }
});

test('creating a note from the blank template saves the typed text', async () => {
  const { app, page, dir, userData } = await openApp();
  try {
    await createBlank(page, ['# From e2e']);
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    const files = await readdir(path.join(dir, 'notes'));
    const bodies = await Promise.all(
      files.map((name) => readFile(path.join(dir, 'notes', name), 'utf8')),
    );
    expect(bodies.some((body) => body.includes('# From e2e'))).toBe(true);
  } finally {
    await closeApp(app, dir, userData);
  }
});

test('an open note returns to the template picker', async () => {
  const { app, page, dir, userData } = await openApp();
  try {
    await page.getByRole('button', { name: 'Welcome' }).click();
    await page.getByRole('button', { name: 'Create new note' }).click();
    await expect(page.getByRole('button', { name: 'Blank note' })).toBeVisible();
  } finally {
    await closeApp(app, dir, userData);
  }
});

test('the note list search matches titles only', async () => {
  const { app, page, dir, userData } = await openApp();
  try {
    await page.getByPlaceholder('Search notes…').fill('welcome');
    await expect(noteBtn(page, 'Welcome')).toBeVisible();
    await page.getByPlaceholder('Search notes…').fill('primeira');
    await expect(page.getByText('No notes')).toBeVisible();
  } finally {
    await closeApp(app, dir, userData);
  }
});

test('deleting the only note shows the empty list', async () => {
  const { app, page, dir, userData } = await openApp();
  try {
    await page.getByRole('button', { name: 'Welcome' }).click();
    await page.getByTitle('More').click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(page.getByText('No notes')).toBeVisible();
  } finally {
    await closeApp(app, dir, userData);
  }
});

test('a pinned note stays above a newer one', async () => {
  const { app, page, dir, userData } = await openApp();
  try {
    await page.getByRole('button', { name: 'Welcome' }).click();
    await page.getByTitle('Pin note').click();
    await page.getByRole('button', { name: 'Create new note' }).click();
    await createBlank(page, ['# Second']);
    await expect(page.locator('.note-item-title').first()).toHaveText('Welcome');
  } finally {
    await closeApp(app, dir, userData);
  }
});

test('a new notebook shows up in the sidebar', async () => {
  const { app, page, dir, userData } = await openApp();
  try {
    await page.getByTitle('New notebook').click();
    await page.getByPlaceholder('Notebook name').fill('Projects');
    await page.getByPlaceholder('Notebook name').press('Enter');
    await expect(page.getByRole('button', { name: 'Projects', exact: true })).toBeVisible();
  } finally {
    await closeApp(app, dir, userData);
  }
});

test('notebook create, rename, move, and delete follow the tree rules', async () => {
  test.setTimeout(60_000);
  const { app, page, dir, userData } = await openApp();
  try {
    await page.getByTitle('New notebook').click();
    await page.getByPlaceholder('Notebook name').fill('Projects');
    await page.getByPlaceholder('Notebook name').press('Enter');
    await page.getByRole('button', { name: 'Projects', exact: true }).click({ button: 'right' });
    await page.getByRole('button', { name: 'New Sub Notebook…' }).click();
    await page.getByPlaceholder('Sub of Projects').fill('Area');
    await page.getByPlaceholder('Sub of Projects').press('Enter');
    await page.getByRole('button', { name: 'Area', exact: true }).click({ button: 'right' });
    await page.getByRole('button', { name: 'New Sub Notebook…' }).click();
    await page.getByPlaceholder('Sub of Area').fill('Leaf');
    await page.getByPlaceholder('Sub of Area').press('Enter');

    await page.getByRole('button', { name: 'Leaf', exact: true }).click({ button: 'right' });
    await page.getByRole('button', { name: 'Move Notebook…' }).click();
    await page.getByRole('button', { name: 'Top level' }).click();
    await expect(page.getByRole('button', { name: 'Leaf', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Area', exact: true }).click({ button: 'right' });
    await page.getByRole('button', { name: 'New Sub Notebook…' }).click();
    await page.getByPlaceholder('Sub of Area').fill('Kept');
    await page.getByPlaceholder('Sub of Area').press('Enter');

    await page.getByRole('button', { name: 'Area', exact: true }).click();
    await createBlank(page, ['# In area']);
    await page.getByRole('button', { name: 'Inbox', exact: true }).click();
    await expect(noteBtn(page, 'In area')).toHaveCount(0);

    await page.getByRole('button', { name: 'Projects', exact: true }).click({ button: 'right' });
    await page.getByRole('button', { name: 'Rename Notebook…' }).click();
    await page.locator('.inline-create input').fill('');
    await page.locator('.inline-create input').press('Enter');
    await expect(page.getByRole('button', { name: 'Projects', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Projects', exact: true }).click({ button: 'right' });
    await page.getByRole('button', { name: 'Change Notebook Icon…' }).click();
    await page.getByTitle('Star').click();

    await page.getByRole('button', { name: 'Area', exact: true }).click({ button: 'right' });
    await page.getByRole('button', { name: 'Delete Notebook…' }).click();
    await expect(page.getByRole('button', { name: 'Kept', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Inbox', exact: true }).click();
    await expect(noteBtn(page, 'In area')).toBeVisible();

    await page.getByRole('button', { name: 'Inbox', exact: true }).click({ button: 'right' });
    await expect(page.getByRole('button', { name: 'Delete Notebook…' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Move Notebook…' })).toBeDisabled();
  } finally {
    await closeApp(app, dir, userData);
  }
});

test('status On Hold leaves the Active filter empty', async () => {
  const { app, page, dir, userData } = await openApp();
  try {
    await page.getByRole('button', { name: 'Welcome' }).click();
    await page.getByLabel('Status').selectOption('on_hold');
    await expect(page.locator('.note-item.status-on-hold')).toBeVisible();
    await page.getByRole('button', { name: 'On Hold', exact: true }).click();
    await expect(noteBtn(page, 'Welcome')).toBeVisible();
    await page.getByRole('button', { name: 'Active', exact: true }).click();
    await expect(page.getByText('No notes')).toBeVisible();
  } finally {
    await closeApp(app, dir, userData);
  }
});

test('tags can be filtered, renamed, and deleted', async () => {
  test.setTimeout(60_000);
  const { app, page, dir, userData } = await openApp();
  try {
    await page.getByRole('button', { name: 'Welcome' }).click();
    const input = page.getByPlaceholder('Add Tags');
    for (const name of ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot']) {
      await input.fill(name);
      await input.press('Enter');
    }
    await expect(page.getByPlaceholder('Filtrar tags…')).toBeVisible();
    await page.getByPlaceholder('Filtrar tags…').fill('taknot');
    await expect(tagBtn(page, 'taknot')).toBeVisible();
    await expect(tagBtn(page, 'alpha')).toHaveCount(0);
    await page.getByPlaceholder('Filtrar tags…').fill('');

    await tagBtn(page, 'taknot').click({ button: 'right' });
    await page.getByRole('button', { name: 'Tag Settings…' }).click();
    await page.locator('#tag-name').fill('');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(tagBtn(page, 'taknot')).toBeVisible();

    await tagBtn(page, 'taknot').click({ button: 'right' });
    await page.getByRole('button', { name: 'Tag Settings…' }).click();
    await page.locator('#tag-name').fill('renamed');
    await page.getByRole('button', { name: '#e06c75' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(tagBtn(page, 'renamed')).toBeVisible();
    await expect(noteBtn(page, 'Welcome')).toContainText('renamed');

    await tagBtn(page, 'renamed').click({ button: 'right' });
    await page.getByRole('button', { name: 'Delete Tag…' }).evaluate((el) => {
      (el as HTMLButtonElement).click();
    });
    await expect(tagBtn(page, 'renamed')).toHaveCount(0);
  } finally {
    await closeApp(app, dir, userData);
  }
});

test('duplicate adds a copy and preview toggles a task', async () => {
  const { app, page, dir, userData } = await openApp();
  try {
    await createBlank(page, ['# Tasks', '', '- [ ] ship']);
    await page.getByTitle('More').click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await expect(noteBtn(page, 'Tasks (copy)')).toBeVisible();
    await page.getByTitle('Preview').click();
    await page.locator('.markdown input[data-task="0"]').click();
    await expect(page.getByText('1 of 1 tasks')).toBeVisible();
    await expect.poll(async () => {
      const files = await readdir(path.join(dir, 'notes'));
      const bodies = await Promise.all(
        files.map((name) => readFile(path.join(dir, 'notes', name), 'utf8')),
      );
      return bodies.some((body) => body.includes('- [x] ship'));
    }).toBe(true);
  } finally {
    await closeApp(app, dir, userData);
  }
});

test('preview wiki-link opens the other note and the graph counts the link', async () => {
  const { app, page, dir, userData } = await openApp();
  try {
    await createBlank(page, ['# Other', '', 'See [[Welcome]]']);
    await page.getByTitle('Preview').click();
    await page.locator('.markdown a.wiki-link').click();
    await expect(page.locator('h1.note-title')).toHaveText('Welcome');
    await page.getByRole('button', { name: 'Graph' }).click();
    await expect(page.getByText('2 notes · 1 links')).toBeVisible();
  } finally {
    await closeApp(app, dir, userData);
  }
});

test('slash menu, split view, and focus mode', async () => {
  const { app, page, dir, userData } = await openApp();
  try {
    await page.getByRole('button', { name: 'Welcome' }).click();
    await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText('/');
    await expect(page.locator('.slash-menu').getByText('Heading 1')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTitle('Split').click();
    await expect(page.locator('.cm-content')).toBeVisible();
    await expect(page.locator('.preview .markdown')).toBeVisible();
    await page.getByTitle('Focus editor').click();
    await expect(page.locator('.app.focus-mode')).toBeVisible();
    await page.getByTitle('Show sidebars').click();
    await expect(page.locator('.app.focus-mode')).toHaveCount(0);
  } finally {
    await closeApp(app, dir, userData);
  }
});

test('the graph says there are no notes after the last one is deleted', async () => {
  const { app, page, dir, userData } = await openApp();
  try {
    await page.getByRole('button', { name: 'Welcome' }).click();
    await page.getByTitle('More').click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Graph' }).click();
    await expect(page.getByText('No notes yet')).toBeVisible();
  } finally {
    await closeApp(app, dir, userData);
  }
});

test('quick search stays inside the sidebar filter', async () => {
  const { app, page, dir, userData } = await openApp();
  try {
    await page.keyboard.press('ControlOrMeta+k');
    const dialog = page.getByRole('dialog', { name: 'Search notes' });
    await expect(dialog.getByRole('option', { name: /Welcome/ })).toBeVisible();
    await dialog.getByPlaceholder('Search notes…').fill('no-such-title');
    await expect(dialog.getByText('No matching notes')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByTitle('New notebook').click();
    await page.getByPlaceholder('Notebook name').fill('Emptybook');
    await page.getByPlaceholder('Notebook name').press('Enter');
    await page.getByRole('button', { name: 'Emptybook', exact: true }).click();
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByRole('dialog', { name: 'Search notes' }).getByText('No matching notes')).toBeVisible();
  } finally {
    await closeApp(app, dir, userData);
  }
});

test('custom templates can be created and deleted, builtins cannot be edited', async () => {
  const { app, page, dir, userData } = await openApp();
  try {
    await page.getByPlaceholder('Search templates…').fill('bug');
    await expect(page.getByRole('button', { name: 'Bug fix' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Blank note' })).toHaveCount(0);
    await page.getByPlaceholder('Search templates…').fill('');
    await page.getByRole('button', { name: 'Reading summary' }).click();
    await expect(page.locator('.template-preview').getByText('Key Points')).toBeVisible();
    await expect(
      page.locator('.template-item', { hasText: 'Blank note' }).getByRole('button', { name: 'Edit' }),
    ).toHaveCount(0);

    await page.getByRole('button', { name: 'New Template' }).click();
    await page.locator('.template-editor input').first().fill('Trip');
    await page.locator('textarea.template-body-input').fill('# Trip\n');
    await page.getByRole('button', { name: 'Save template' }).click();
    await expect(page.getByRole('button', { name: 'Trip' })).toBeVisible();
    await page.locator('.template-item', { hasText: 'Trip' }).getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('button', { name: 'Trip' })).toHaveCount(0);
  } finally {
    await closeApp(app, dir, userData);
  }
});

test('vim mode shows the status line', async () => {
  const { app, page, dir, userData } = await openApp();
  try {
    await page.getByTitle('Settings').click();
    await page.locator('#vim-mode').check();
    await closeSettings(page);
    await page.getByRole('button', { name: 'Welcome' }).click();
    await expect(page.getByLabel('Vim statusline')).toBeVisible();
    await expect(page.getByLabel('Vim statusline')).toContainText('NORMAL');
  } finally {
    await closeApp(app, dir, userData);
  }
});

test('a conflicting hotkey is refused and reset restores the default', async () => {
  const { app, page, dir, userData } = await openApp();
  try {
    await page.getByTitle('Settings').click();
    const dialog = page.getByRole('dialog', { name: 'Settings' });
    await dialog.locator('.hotkey-row', { hasText: 'New note' }).locator('button').click();
    await page.keyboard.press('ControlOrMeta+k');
    await expect(dialog.getByText(/Conflito com/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Reset to defaults' }).click();
    await expect(dialog.getByText(/Conflito com/)).toHaveCount(0);
  } finally {
    await closeApp(app, dir, userData);
  }
});

test('settings shows the vault, copies the MCP snippet, and offers update check', async () => {
  const { app, page, dir, userData } = await openApp();
  try {
    await page.getByTitle('Settings').click();
    const dialog = page.getByRole('dialog', { name: 'Settings' });
    await expect(dialog.locator('code', { hasText: dir })).toBeVisible();
    await expect(dialog.getByText(/online/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Copiar snippet Cursor' }).click();
    await expect(dialog.getByRole('button', { name: 'Copiado' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Verificar atualizações' })).toBeEnabled();
    expect(await clipboardText(app)).toContain('/mcp');
  } finally {
    await closeApp(app, dir, userData);
  }
});

test('copy note id writes the id to the clipboard', async () => {
  const { app, page, dir, userData } = await openApp();
  try {
    await page.getByRole('button', { name: 'Welcome' }).click();
    await page.getByTitle('More').click();
    await page.getByRole('menuitem', { name: 'Copy Note ID' }).click();
    expect(await clipboardText(app)).toBe('note_welcome');
  } finally {
    await closeApp(app, dir, userData);
  }
});

test('an agent write shows up when the open note is clean', async () => {
  const { app, page, dir, userData, mcpUrl } = await openApp();
  const client = new Client({ name: 'taknot-e2e', version: '1.0.0' });
  try {
    await page.getByRole('button', { name: 'Welcome' }).click();
    await page.locator('.cm-content').waitFor();
    await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl)));
    await client.callTool({
      name: 'update_note',
      arguments: {
        id: 'note_welcome',
        title: 'Agent wrote this',
        body: '# Agent wrote this\n',
      },
    });
    await expect(page.locator('.cm-content')).toContainText('Agent wrote this');
  } finally {
    await client.close().catch(() => {});
    await closeApp(app, dir, userData);
  }
});

test('an agent write leaves a dirty editor alone', async () => {
  const { app, page, dir, userData, mcpUrl } = await openApp();
  const client = new Client({ name: 'taknot-e2e', version: '1.0.0' });
  try {
    await page.getByRole('button', { name: 'Welcome' }).click();
    await page.locator('.cm-content').waitFor();
    await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl)));
    await page.locator('.cm-content').click();
    await page.keyboard.insertText('LOCALDIRTY');
    await client.callTool({
      name: 'update_note',
      arguments: {
        id: 'note_welcome',
        title: 'Agent wrote this',
        body: '# Agent wrote this\n',
      },
    });
    await expect(page.locator('.cm-content')).toContainText('LOCALDIRTY');
    await expect(page.locator('.cm-content')).not.toContainText('Agent wrote this');
  } finally {
    await client.close().catch(() => {});
    await closeApp(app, dir, userData);
  }
});
