/**
 * Notebook create/rename/move/icon/delete + context-menu openers.
 * App keeps the UI state; this returns the handlers.
 */
export function useNotebookActions({
  notebookDraft,
  addingUnderId,
  nbMenu,
  iconPicker,
  movePicker,
  renamingNotebookId,
  renameDraft,
  filter,
  setNotebookDraft,
  setAddingNotebook,
  setAddingUnderId,
  setFilter,
  setNbMenu,
  setTagMenu,
  setIconPicker,
  setMovePicker,
  setNotebookDetail,
  setRenamingNotebookId,
  setRenameDraft,
  setNotebooks,
  refreshMeta,
  refreshNotes,
}) {
  async function handleCreateNotebook() {
    const name = notebookDraft.trim();
    if (!name) return;
    try {
      const nb = await window.taknot.createNotebook(name, addingUnderId);
      setNotebookDraft('');
      setAddingNotebook(false);
      setAddingUnderId(null);
      await refreshMeta();
      setFilter({ type: 'notebook', id: nb.id });
    } catch (err) {
      console.error(err);
    }
  }

  function openNotebookMenu(e, nb) {
    e.preventDefault();
    e.stopPropagation();
    setTagMenu(null);
    setIconPicker(null);
    setMovePicker(null);
    setNbMenu({
      id: nb.id,
      name: nb.name,
      icon: nb.icon || 'Book',
      x: e.clientX,
      y: e.clientY,
    });
  }

  async function copyNotebookId() {
    if (!nbMenu) return;
    const id = nbMenu.id;
    setNbMenu(null);
    try {
      await window.taknot.writeClipboard(id);
    } catch (err) {
      console.error(err);
    }
  }

  async function showNotebookDetail() {
    if (!nbMenu) return;
    const notes = await window.taknot.listNotes({ notebookId: nbMenu.id });
    setNotebookDetail({
      id: nbMenu.id,
      name: nbMenu.name,
      noteCount: notes.length,
    });
    setNbMenu(null);
  }

  function startRenameNotebook() {
    if (!nbMenu) return;
    setRenamingNotebookId(nbMenu.id);
    setRenameDraft(nbMenu.name);
    setNbMenu(null);
  }

  function startNewSubNotebook() {
    if (!nbMenu) return;
    setAddingUnderId(nbMenu.id);
    setAddingNotebook(true);
    setNotebookDraft('');
    setNbMenu(null);
  }

  function openIconPicker() {
    if (!nbMenu) return;
    setIconPicker({
      id: nbMenu.id,
      icon: nbMenu.icon || 'Book',
      x: nbMenu.x,
      y: nbMenu.y,
    });
    setNbMenu(null);
  }

  function openMoveNotebook() {
    if (!nbMenu || nbMenu.id === 'nb_inbox') {
      setNbMenu(null);
      return;
    }
    setMovePicker({ id: nbMenu.id, x: nbMenu.x, y: nbMenu.y });
    setNbMenu(null);
  }

  async function pickNotebookIcon(icon) {
    if (!iconPicker) return;
    const { id } = iconPicker;
    setIconPicker(null);
    try {
      await window.taknot.setNotebookIcon(id, icon);
      await refreshMeta();
    } catch (err) {
      console.error(err);
    }
  }

  async function pickMoveParent(parentId) {
    if (!movePicker) return;
    const { id } = movePicker;
    setMovePicker(null);
    try {
      await window.taknot.moveNotebook(id, parentId);
      await refreshMeta();
    } catch (err) {
      console.error(err);
    }
  }

  async function commitRenameNotebook() {
    if (!renamingNotebookId) return;
    const name = renameDraft.trim();
    if (!name) {
      setRenamingNotebookId(null);
      return;
    }
    try {
      await window.taknot.renameNotebook(renamingNotebookId, name);
      await refreshMeta();
    } catch (err) {
      console.error(err);
    }
    setRenamingNotebookId(null);
  }

  async function handleDeleteNotebook(id) {
    if (!id || id === 'nb_inbox') {
      setNbMenu(null);
      return;
    }
    setNbMenu(null);
    try {
      await window.taknot.deleteNotebook(id);
      if (filter.type === 'notebook' && filter.id === id) {
        setFilter({ type: 'all' });
      }
      setNotebooks((prev) => prev.filter((n) => n.id !== id));
      await refreshMeta();
      await refreshNotes();
    } catch (err) {
      console.error('deleteNotebook failed', id, err);
    }
  }

  return {
    handleCreateNotebook,
    openNotebookMenu,
    copyNotebookId,
    showNotebookDetail,
    startRenameNotebook,
    startNewSubNotebook,
    openIconPicker,
    openMoveNotebook,
    pickNotebookIcon,
    pickMoveParent,
    commitRenameNotebook,
    handleDeleteNotebook,
  };
}
