import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { noteSnapshot } from './lib/format';
import type { TaknotNote } from '../vite-env';

type EditorNote = TaknotNote & { body: string };

type Args = {
  note: EditorNote | null;
  notes: TaknotNote[];
  history: string[];
  historyIndex: number;
  noteRef: MutableRefObject<EditorNote | null>;
  saveBaselineRef: MutableRefObject<string>;
  persistNote: (n: EditorNote, opts?: { force?: boolean }) => Promise<any>;
  refreshNotes: () => Promise<unknown>;
  refreshMeta: () => Promise<unknown>;
  setNote: Dispatch<SetStateAction<EditorNote | null>>;
  setNotes: Dispatch<SetStateAction<TaknotNote[]>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setHistory: Dispatch<SetStateAction<string[]>>;
  setHistoryIndex: Dispatch<SetStateAction<number>>;
  setFocusMode: Dispatch<SetStateAction<boolean>>;
  setSelectedTemplateId: Dispatch<SetStateAction<string>>;
};

/** Note selection, history, pin, delete, and "new note" empty state. */
export function useNoteNavigation({
  note,
  notes,
  history,
  historyIndex,
  noteRef,
  saveBaselineRef,
  persistNote,
  refreshNotes,
  refreshMeta,
  setNote,
  setNotes,
  setSelectedId,
  setHistory,
  setHistoryIndex,
  setFocusMode,
  setSelectedTemplateId,
}: Args) {
  async function togglePin() {
    if (!note?.id) return;
    const next = { ...note, pinned: !Boolean(note.pinned) };
    setNote(next);
    noteRef.current = next;
    setNotes((prev: TaknotNote[]) => {
      const rest = prev.filter((x: TaknotNote) => x.id !== next.id);
      const row = { ...(prev.find((x: TaknotNote) => x.id === next.id) || {}), ...next };
      return [row, ...rest].sort((a, b) => {
        const ap = a.pinned ? 1 : 0;
        const bp = b.pinned ? 1 : 0;
        if (ap !== bp) return bp - ap;
        return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
      });
    });
    const saved = await persistNote(next, { force: true });
    if (!saved) {
      console.error('togglePin: save failed');
      setNote(note);
      noteRef.current = note;
      await refreshNotes();
    }
  }

  function selectNote(id: string | null, { pushHistory = true }: { pushHistory?: boolean } = {}) {
    const latest = noteRef.current;
    if (
      latest?.id &&
      latest.id !== id &&
      noteSnapshot(latest) !== saveBaselineRef.current
    ) {
      void persistNote(latest);
    }
    setSelectedId(id);
    if (!id || !pushHistory) return;
    const trimmed = history.slice(0, historyIndex + 1);
    if (trimmed[trimmed.length - 1] === id) return;
    const next = [...trimmed, id].slice(-50);
    setHistory(next);
    setHistoryIndex(next.length - 1);
  }

  async function openNoteByTitle(title: string) {
    const q = String(title || '').trim().toLowerCase();
    if (!q) return;
    const hit =
      notes.find((n) => (n.title || '').trim().toLowerCase() === q) || null;
    if (hit) {
      selectNote(hit.id);
      return;
    }
    const list = await refreshNotes();
    const again = ((list as TaknotNote[] | undefined) || []).find(
      (n: TaknotNote) => (n.title || '').trim().toLowerCase() === q,
    );
    if (again) selectNote(again.id);
  }

  function goBack() {
    if (historyIndex <= 0) return;
    const next = historyIndex - 1;
    setHistoryIndex(next);
    setSelectedId(history[next]);
  }

  function goForward() {
    if (historyIndex >= history.length - 1) return;
    const next = historyIndex + 1;
    setHistoryIndex(next);
    setSelectedId(history[next]);
  }

  function openCreate() {
    setFocusMode(false);
    setSelectedId(null);
    setNote(null);
    setSelectedTemplateId('blank');
  }

  async function handleDelete() {
    if (!note) return;
    await window.taknot.deleteNote(note.id);
    setFocusMode(false);
    setSelectedId(null);
    setNote(null);
    await refreshNotes();
    await refreshMeta();
  }

  return {
    togglePin,
    selectNote,
    openNoteByTitle,
    goBack,
    goForward,
    openCreate,
    handleDelete,
  };
}
