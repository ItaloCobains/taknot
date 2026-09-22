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

export type TaknotNote = {
  id: string;
  title?: string;
  body: string;
  notebookId?: string;
  tags?: string[];
  status?: string;
  pinned?: boolean;
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
  getWikiGraph: () => Promise<unknown>;
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
  exportNotePdf: (payload: unknown) => Promise<unknown>;
  openExternal: (url: string) => Promise<void>;
  toggleMaximize: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  listCustomTemplates: () => Promise<TaknotTemplate[]>;
  saveTemplate: (tpl: Partial<TaknotTemplate>) => Promise<TaknotTemplate>;
  deleteTemplate: (id: string) => Promise<void>;
  getVersion: () => Promise<string>;
  getMcpInfo: () => Promise<TaknotMcpInfo>;
  checkForUpdates: () => Promise<unknown>;
  checkSpelling: (words: string[]) => Promise<unknown>;
  suggestSpelling: (word: string) => Promise<string[]>;
  onVaultChanged: (cb: () => void) => () => void;
};

declare global {
  interface Window {
    taknot?: TaknotApi;
  }
}
