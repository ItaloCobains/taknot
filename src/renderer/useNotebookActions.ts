import type { Dispatch, MouseEvent, SetStateAction } from 'react';
import type { NoteFilterState, TaknotNotebook } from '../vite-env';

type NbMenu = {
  id: string;
  name: string;
  icon: string;
  x: number;
  y: number;
} | null;

type Picker = { x: number; y: number; id?: string } | null;

type Args = {
  notebookDraft: string;
  addingUnderId: string | null;
  nbMenu: NbMenu;
  iconPicker: Picker;
  movePicker: Picker;
  renamingNotebookId: string | null;
  renameDraft: string;
  filter: NoteFilterState;
  setNotebookDraft: Dispatch<SetStateAction<string>>;
  setAddingNotebook: Dispatch<SetStateAction<boolean>>;
  setAddingUnderId: Dispatch<SetStateAction<string | null>>;
  setFilter: Dispatch<SetStateAction<NoteFilterState>>;
  setNbMenu: Dispatch<SetStateAction<NbMenu>>;
  setTagMenu: Dispatch<SetStateAction<any>>;
  setIconPicker: Dispatch<SetStateAction<any>>;
  setMovePicker: Dispatch<SetStateAction<any>>;
  setNotebookDetail: Dispatch<SetStateAction<any>>;
  setRenamingNotebookId: Dispatch<SetStateAction<string | null>>;
  setRenameDraft: Dispatch<SetStateAction<string>>;
  setNotebooks: Dispatch<SetStateAction<TaknotNotebook[]>>;
  refreshMeta: () => Promise<void>;
  refreshNotes: () => Promise<unknown>;
};

/** Notebook create/rename/move/icon/delete + context-menu openers. */
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
}: Args) {

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

  function openNotebookMenu(e: MouseEvent, nb: TaknotNotebook) {
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

  async function pickNotebookIcon(icon: string) {
    if (!iconPicker) return;
    const { id } = iconPicker;
    setIconPicker(null);
    try {
      await window.taknot.setNotebookIcon(id!, icon);
      await refreshMeta();
    } catch (err) {
      console.error(err);
    }
  }

  async function pickMoveParent(parentId: string | null) {
    if (!movePicker) return;
    const { id } = movePicker;
    setMovePicker(null);
    try {
      await window.taknot.moveNotebook(id!, parentId);
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

  async function handleDeleteNotebook(id: string) {
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
