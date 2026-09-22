import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('taknot', {
  listNotebooks: () => ipcRenderer.invoke('vault:listNotebooks'),
  listTags: () => ipcRenderer.invoke('vault:listTags'),
  saveTag: (tag: unknown) => ipcRenderer.invoke('vault:saveTag', tag),
  deleteTag: (id: string) => ipcRenderer.invoke('vault:deleteTag', id),
  listNotes: (filter?: unknown) => ipcRenderer.invoke('vault:listNotes', filter),
  getWikiGraph: () => ipcRenderer.invoke('vault:getWikiGraph'),
  getNote: (id: string) => ipcRenderer.invoke('vault:getNote', id),
  saveNote: (note: unknown) => ipcRenderer.invoke('vault:saveNote', note),
  createNote: (opts: unknown) => ipcRenderer.invoke('vault:createNote', opts),
  createNotebook: (name: string, parentId?: string | null) =>
    ipcRenderer.invoke('vault:createNotebook', name, parentId),
  renameNotebook: (id: string, name: string) =>
    ipcRenderer.invoke('vault:renameNotebook', id, name),
  setNotebookIcon: (id: string, icon: string) =>
    ipcRenderer.invoke('vault:setNotebookIcon', id, icon),
  moveNotebook: (id: string, parentId: string | null) =>
    ipcRenderer.invoke('vault:moveNotebook', id, parentId),
  deleteNotebook: (id: string) => ipcRenderer.invoke('vault:deleteNotebook', id),
  duplicateNote: (id: string) => ipcRenderer.invoke('vault:duplicateNote', id),
  deleteNote: (id: string) => ipcRenderer.invoke('vault:deleteNote', id),
  writeClipboard: (text: string) => ipcRenderer.invoke('clipboard:writeText', text),
  exportNotePdf: (payload: unknown) => ipcRenderer.invoke('note:exportPdf', payload),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  listCustomTemplates: () => ipcRenderer.invoke('vault:listCustomTemplates'),
  saveTemplate: (tpl: unknown) => ipcRenderer.invoke('vault:saveTemplate', tpl),
  deleteTemplate: (id: string) => ipcRenderer.invoke('vault:deleteTemplate', id),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getMcpInfo: () => ipcRenderer.invoke('mcp:getInfo'),
  checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
  checkSpelling: (words: string[]) => ipcRenderer.invoke('spell:checkWords', words),
  suggestSpelling: (word: string) => ipcRenderer.invoke('spell:suggest', word),
  onVaultChanged: (cb: () => void) => {
    const handler = () => {
      try {
        cb();
      } catch (err) {
        console.error(err);
      }
    };
    ipcRenderer.on('vault:changed', handler);
    return () => ipcRenderer.removeListener('vault:changed', handler);
  },
});
