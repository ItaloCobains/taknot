const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('taknot', {
  listNotebooks: () => ipcRenderer.invoke('vault:listNotebooks'),
  listTags: () => ipcRenderer.invoke('vault:listTags'),
  saveTag: (tag) => ipcRenderer.invoke('vault:saveTag', tag),
  deleteTag: (id) => ipcRenderer.invoke('vault:deleteTag', id),
  listNotes: (filter) => ipcRenderer.invoke('vault:listNotes', filter),
  getNote: (id) => ipcRenderer.invoke('vault:getNote', id),
  saveNote: (note) => ipcRenderer.invoke('vault:saveNote', note),
  createNote: (opts) => ipcRenderer.invoke('vault:createNote', opts),
  createNotebook: (name, parentId) =>
    ipcRenderer.invoke('vault:createNotebook', name, parentId),
  renameNotebook: (id, name) =>
    ipcRenderer.invoke('vault:renameNotebook', id, name),
  setNotebookIcon: (id, icon) =>
    ipcRenderer.invoke('vault:setNotebookIcon', id, icon),
  moveNotebook: (id, parentId) =>
    ipcRenderer.invoke('vault:moveNotebook', id, parentId),
  deleteNotebook: (id) => ipcRenderer.invoke('vault:deleteNotebook', id),
  duplicateNote: (id) => ipcRenderer.invoke('vault:duplicateNote', id),
  deleteNote: (id) => ipcRenderer.invoke('vault:deleteNote', id),
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:writeText', text),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
});
