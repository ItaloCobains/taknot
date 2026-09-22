import { useCallback, useEffect, useRef } from 'react';
import { titleFromBody, noteSnapshot } from './lib/format';

/**
 * Vault load/save/autosave + external change sync for the active note.
 * App owns note/notes state; this hook wires window.taknot persistence.
 */
export function useNoteVault({
  selectedId,
  note,
  noteRef,
  savingRef,
  saveBaselineRef,
  setNote,
  setNotes,
  setSelectedId,
  setSaving,
  refreshMeta,
  refreshNotes,
}) {
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  // External vault writes (MCP / another process) → refresh UI.
  useEffect(() => {
    if (typeof window.taknot?.onVaultChanged !== 'function') return undefined;
    return window.taknot.onVaultChanged(() => {
      // Ignore our own autosave writes — reloading would reset the editor cursor.
      if (savingRef.current) {
        refreshMeta().catch(console.error);
        refreshNotes().catch(console.error);
        return;
      }
      refreshMeta().catch(console.error);
      refreshNotes()
        .then(async (list) => {
          const id = selectedIdRef.current;
          if (!id) return;
          if (!list.some((n) => n.id === id)) {
            setSelectedId(null);
            setNote(null);
            return;
          }
          const current = noteRef.current;
          // Don't clobber in-progress edits.
          if (current && noteSnapshot(current) !== saveBaselineRef.current) return;
          const n = await window.taknot.getNote(id);
          // Same body → only refresh meta fields (avoid CodeMirror doc replace).
          if (current && current.body === n.body) {
            setNote((prev) =>
              prev && prev.id === n.id
                ? {
                    ...prev,
                    title: n.title,
                    updatedAt: n.updatedAt,
                    pinned: Boolean(n.pinned),
                    status: n.status,
                    tags: n.tags,
                    notebookId: n.notebookId,
                  }
                : prev,
            );
            saveBaselineRef.current = noteSnapshot({ ...current, ...n, body: current.body });
            return;
          }
          setNote(n);
          saveBaselineRef.current = noteSnapshot(n);
        })
        .catch(console.error);
    });
  }, [
    refreshMeta,
    refreshNotes,
    savingRef,
    noteRef,
    saveBaselineRef,
    setSelectedId,
    setNote,
  ]);

  useEffect(() => {
    if (!selectedId) {
      setNote(null);
      return;
    }
    let cancelled = false;
    window.taknot
      .getNote(selectedId)
      .then((n) => {
        if (!cancelled) {
          setNote(n);
          saveBaselineRef.current = noteSnapshot(n);
        }
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [selectedId, setNote, saveBaselineRef]);

  const persistNote = useCallback(async (n, { force = false } = {}) => {
    if (!n?.id) return null;
    const payload = {
      id: n.id,
      title: titleFromBody(n.body),
      body: n.body,
      notebookId: n.notebookId,
      tags: n.tags || [],
      status: n.status,
      pinned: Boolean(n.pinned),
    };
    const snap = JSON.stringify(payload);
    if (!force && snap === saveBaselineRef.current) return n;
    savingRef.current = true;
    setSaving(true);
    try {
      const saved = await window.taknot.saveNote(payload);
      const merged = { ...n, ...saved, pinned: Boolean(saved.pinned) };
      saveBaselineRef.current = noteSnapshot(merged);
      setNote((prev) =>
        prev && prev.id === saved.id
          ? {
              ...prev,
              title: saved.title,
              updatedAt: saved.updatedAt,
              pinned: Boolean(saved.pinned),
            }
          : prev,
      );
      setNotes((prev) => {
        const rest = prev.filter((x) => x.id !== saved.id);
        const row = {
          ...(prev.find((x) => x.id === saved.id) || {}),
          ...saved,
          pinned: Boolean(saved.pinned),
        };
        return [row, ...rest].sort((a, b) => {
          const ap = a.pinned ? 1 : 0;
          const bp = b.pinned ? 1 : 0;
          if (ap !== bp) return bp - ap;
          return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
        });
      });
      return saved;
    } catch (err) {
      console.error(err);
      return null;
    } finally {
      setSaving(false);
      // Let fs.watch settle before accepting external vault reloads.
      setTimeout(() => {
        savingRef.current = false;
      }, 250);
    }
  }, [savingRef, saveBaselineRef, setSaving, setNote, setNotes]);

  // Debounced autosave. Cleanup must ONLY clear the timer — persisting on
  // every dependency change was saving on each keystroke and racing vault:changed,
  // which reloaded the note and reset the CodeMirror cursor.
  useEffect(() => {
    if (!note?.id) return undefined;
    const snap = noteSnapshot(note);
    if (snap === saveBaselineRef.current) return undefined;

    const handle = setTimeout(() => {
      const latest = noteRef.current;
      if (latest?.id) void persistNote(latest);
    }, 600);
    return () => clearTimeout(handle);
  }, [
    note?.id,
    note?.body,
    note?.notebookId,
    note?.status,
    note?.tags,
    note?.pinned,
    persistNote,
    noteRef,
    saveBaselineRef,
  ]);

  // Flush pending edits when switching notes or unmounting.
  useEffect(() => {
    return () => {
      const latest = noteRef.current;
      if (
        latest?.id &&
        noteSnapshot(latest) !== saveBaselineRef.current
      ) {
        void persistNote(latest);
      }
    };
  }, [selectedId, persistNote, noteRef, saveBaselineRef]);

  return { persistNote };
}
