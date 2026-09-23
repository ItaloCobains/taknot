/// <reference types="vite/client" />

export {};

export type TaknotNoteFilter = {
  query?: string;
  notebookId?: string;
  status?: string;
  tag?: string;
};

export type TaknotTag = {
  id: string;
  name: string;
  color?: string;
};

export type TaknotNotebook = {
  id: string;
  name: string;
  icon?: string;
  parentId?: string | null;
  children?: TaknotNotebook[];
};

export type ContextMenuPos = {
  x: number;
  y: number;
};

export type TagMenuState = ContextMenuPos & {
  tag: TaknotTag;
};

export type NotebookMenuState = ContextMenuPos & {
  notebook: TaknotNotebook;
};

export type NoteFilterState =
  | { type: 'all' }
  | { type: 'notebook'; id: string }
  | { type: 'tag'; id: string; name?: string }
  | { type: 'status'; id: string }
  | { type: 'templates' }
  | { type: string; id?: string; name?: string };

export type TaknotNote = {
  id: string;
  title?: string;
  body: string;
  notebookId?: string;
  tags?: string[];
  status?: string;
  pinned?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type TaknotTemplate = {
  id: string;
  name: string;
  category: string;
  body: string;
  builtin?: boolean;
};

export type TaknotMcpInfo = {
  url?: string;
  path?: string;
  [key: string]: unknown;
};

export type TaknotApi = {
  listNotebooks: () => Promise<TaknotNotebook[]>;
  listTags: () => Promise<TaknotTag[]>;
  saveTag: (tag: Partial<TaknotTag> & { name: string }) => Promise<TaknotTag>;
  deleteTag: (id: string) => Promise<void>;
  listNotes: (filter?: TaknotNoteFilter) => Promise<TaknotNote[]>;
  getWikiGraph: () => Promise<{
    nodes: Array<{ id: string; title?: string; status?: string }>;
    edges: Array<{ source: string; target: string }>;
  }>;
  getNote: (id: string) => Promise<TaknotNote>;
  saveNote: (note: Record<string, unknown>) => Promise<TaknotNote>;
  createNote: (opts: Record<string, unknown>) => Promise<TaknotNote>;
  createNotebook: (name: string, parentId?: string | null) => Promise<TaknotNotebook>;
  renameNotebook: (id: string, name: string) => Promise<void>;
  setNotebookIcon: (id: string, icon: string) => Promise<void>;
  moveNotebook: (id: string, parentId: string | null) => Promise<void>;
  deleteNotebook: (id: string) => Promise<void>;
  duplicateNote: (id: string) => Promise<TaknotNote>;
  deleteNote: (id: string) => Promise<void>;
  writeClipboard: (text: string) => Promise<void>;
  exportNotePdf: (payload: unknown) => Promise<{ ok?: boolean; canceled?: boolean; path?: string; error?: string }>;
  openExternal: (url: string) => Promise<void>;
  toggleMaximize: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  listCustomTemplates: () => Promise<TaknotTemplate[]>;
  saveTemplate: (tpl: Partial<TaknotTemplate>) => Promise<TaknotTemplate>;
  deleteTemplate: (id: string) => Promise<void>;
  getVersion: () => Promise<string>;
  getMcpInfo: () => Promise<TaknotMcpInfo>;
  checkForUpdates: () => Promise<unknown>;
  checkSpelling: (words: string[]) => Promise<string[]>;
  suggestSpelling: (word: string) => Promise<string[]>;
  onVaultChanged: (cb: () => void) => () => void;
};

declare global {
  interface Window {
    taknot: TaknotApi;
  }

  /** Injected by @electron-forge/plugin-vite at build time. */
  const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
  const MAIN_WINDOW_VITE_NAME: string;
}
