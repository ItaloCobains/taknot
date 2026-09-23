import type { Dispatch, MouseEvent, SetStateAction } from 'react';
import type { NoteFilterState, TaknotNote, TaknotTag } from '../vite-env';

type TagMenu = {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
} | null;

type TagEdit = { id: string; name: string; color: string } | null;

type Args = {
  tagMenu: TagMenu;
  tagEdit: TagEdit;
  tags: TaknotTag[];
  filter: NoteFilterState;
  setNbMenu: Dispatch<SetStateAction<any>>;
  setIconPicker: Dispatch<SetStateAction<any>>;
  setMovePicker: Dispatch<SetStateAction<any>>;
  setTagMenu: Dispatch<SetStateAction<TagMenu>>;
  setTagEdit: Dispatch<SetStateAction<TagEdit>>;
  setFilter: Dispatch<SetStateAction<NoteFilterState>>;
  setNote: Dispatch<SetStateAction<TaknotNote | null>>;
  refreshMeta: () => Promise<void>;
  refreshNotes: () => Promise<unknown>;
};

/** Tag context-menu + edit/delete/filter handlers. */
export function useTagActions({
  tagMenu,
  tagEdit,
  tags,
  filter,
  setNbMenu,
  setIconPicker,
  setMovePicker,
  setTagMenu,
  setTagEdit,
  setFilter,
  setNote,
  refreshMeta,
  refreshNotes,
}: Args) {
  function openTagMenu(e: MouseEvent, tag: TaknotTag) {
    e.preventDefault();
    e.stopPropagation();
    setNbMenu(null);
    setIconPicker(null);
    setMovePicker(null);
    setTagMenu({
      id: tag.id,
      name: tag.name,
      color: tag.color || '#8b93a7',
      x: e.clientX,
      y: e.clientY,
    });
  }

  function openTagSettings() {
    if (!tagMenu) return;
    setTagEdit({
      id: tagMenu.id,
      name: tagMenu.name,
      color: (tagMenu.color || '#8b93a7').toLowerCase(),
    });
    setTagMenu(null);
  }

  async function copyTagId() {
    if (!tagMenu) return;
    const id = tagMenu.id;
    setTagMenu(null);
    try {
      await window.taknot.writeClipboard(id);
    } catch (err) {
      console.error(err);
    }
  }

  function filterByTag() {
    if (!tagMenu) return;
    setFilter({ type: 'tag', id: tagMenu.name });
    setTagMenu(null);
  }

  async function handleDeleteTag() {
    if (!tagMenu) return;
    const { id, name } = tagMenu;
    setTagMenu(null);
    try {
      await window.taknot.deleteTag(id);
      if (filter.type === 'tag' && filter.id === name) {
        setFilter({ type: 'all' });
      }
      await refreshMeta();
      await refreshNotes();
    } catch (err) {
      console.error(err);
    }
  }

  async function commitTagEdit() {
    if (!tagEdit) return;
    const name = tagEdit.name.trim().toLowerCase();
    if (!name) {
      setTagEdit(null);
      return;
    }
    const oldName = tags.find((t) => t.id === tagEdit.id)?.name;
    try {
      const saved = await window.taknot.saveTag({
        id: tagEdit.id,
        name,
        color: tagEdit.color,
      });
      if (filter.type === 'tag' && filter.id === oldName) {
        setFilter({ type: 'tag', id: saved.name });
      }
      if (oldName && oldName !== saved.name) {
        setNote((prev) =>
          prev
            ? {
                ...prev,
                tags: (prev.tags || []).map((t) =>
                  t === oldName ? saved.name : t,
                ),
              }
            : prev,
        );
      }
      await refreshMeta();
      await refreshNotes();
    } catch (err) {
      console.error(err);
    }
    setTagEdit(null);
  }

  return {
    openTagMenu,
    openTagSettings,
    copyTagId,
    filterByTag,
    handleDeleteTag,
    commitTagEdit,
  };
}
