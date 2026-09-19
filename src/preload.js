const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('taknot', {
  listNotebooks: () => ipcRenderer.invoke('vault:listNotebooks'),
  listTags: () => ipcRenderer.invoke('vault:listTags'),
  listNotes: (filter) => ipcRenderer.invoke('vault:listNotes', filter),
  getNote: (id) => ipcRenderer.invoke('vault:getNote', id),
  saveNote: (note) => ipcRenderer.invoke('vault:saveNote', note),
  createNote: (opts) => ipcRenderer.invoke('vault:createNote', opts),
  createNotebook: (name) => ipcRenderer.invoke('vault:createNotebook', name),
  renameNotebook: (id, name) =>
    ipcRenderer.invoke('vault:renameNotebook', id, name),
  deleteNotebook: (id) => ipcRenderer.invoke('vault:deleteNotebook', id),
  getNotebookExport: (id) => ipcRenderer.invoke('vault:getNotebookExport', id),
  duplicateNote: (id) => ipcRenderer.invoke('vault:duplicateNote', id),
  deleteNote: (id) => ipcRenderer.invoke('vault:deleteNote', id),
  toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
});
