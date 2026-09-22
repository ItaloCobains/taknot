import { useEffect } from 'react';
import { eventMatchesHotkey } from './hotkeys.js';

/**
 * Global app hotkeys (Escape overlays + remappable bindings).
 * Callers pass refs/setters so App stays the state owner.
 */
export function useAppHotkeys({
  hotkeysRef,
  noteRef,
  saveBaselineRef,
  historyRef,
  historyIndexRef,
  listSearchRef,
  noteSnapshot,
  persistNote,
  openCreate,
  nbMenu,
  tagMenu,
  iconPicker,
  movePicker,
  tagEdit,
  notebookDetail,
  templateEditor,
  quickSearchOpen,
  settingsOpen,
  focusMode,
  graphOpen,
  vimMode,
  setNbMenu,
  setTagMenu,
  setIconPicker,
  setMovePicker,
  setTagEdit,
  setNotebookDetail,
  setTemplateEditor,
  setQuickSearchOpen,
  setSettingsOpen,
  setFocusMode,
  setGraphOpen,
  setSidebarOpen,
  setSelectedId,
  setNote,
  setNotes,
  setHistoryIndex,
}) {
  useEffect(() => {
    function onKeyDown(e) {
      // Don't steal keys while recording a binding in Settings
      if (e.target?.closest?.('.hotkey-bind.is-recording')) return;

      const hk = hotkeysRef.current;

      // Escape: close overlays top-down (menus → modals → panels)
      if (e.key === 'Escape') {
        if (nbMenu || tagMenu || iconPicker || movePicker) {
          e.preventDefault();
          setNbMenu(null);
          setTagMenu(null);
          setIconPicker(null);
          setMovePicker(null);
          return;
        }
        if (tagEdit) {
          e.preventDefault();
          setTagEdit(null);
          return;
        }
        if (notebookDetail) {
          e.preventDefault();
          setNotebookDetail(null);
          return;
        }
        if (templateEditor) {
          e.preventDefault();
          setTemplateEditor(null);
          return;
        }
        if (quickSearchOpen) {
          e.preventDefault();
          setQuickSearchOpen(false);
          return;
        }
        if (settingsOpen) {
          e.preventDefault();
          setSettingsOpen(false);
          return;
        }
        if (focusMode) {
          // In vim mode, Esc must reach CodeMirror (insert → normal), not exit focus.
          if (
            vimMode &&
            e.target?.closest?.('.cm-editor, .md-code-editor, .md-code-wrap')
          ) {
            return;
          }
          e.preventDefault();
          setFocusMode(false);
          return;
        }
        if (graphOpen) {
          e.preventDefault();
          setGraphOpen(false);
          return;
        }
        return;
      }

      const run = (id) => hk[id] && eventMatchesHotkey(e, hk[id]);

      if (run('newNote')) {
        e.preventDefault();
        openCreate();
        return;
      }
      if (run('toggleSidebar')) {
        e.preventDefault();
        setSidebarOpen((v) => !v);
        return;
      }
      if (run('quickSearch')) {
        e.preventDefault();
        setQuickSearchOpen((v) => !v);
        setFocusMode(false);
        return;
      }
      if (run('saveNote')) {
        e.preventDefault();
        const latest = noteRef.current;
        if (latest?.id) void persistNote(latest, { force: true });
        return;
      }
      if (run('togglePin')) {
        e.preventDefault();
        const cur = noteRef.current;
        if (!cur?.id) return;
        const next = { ...cur, pinned: !Boolean(cur.pinned) };
        setNote(next);
        noteRef.current = next;
        setNotes((prev) => {
          const rest = prev.filter((x) => x.id !== next.id);
          const row = { ...(prev.find((x) => x.id === next.id) || {}), ...next };
          return [row, ...rest].sort((a, b) => {
            const ap = a.pinned ? 1 : 0;
            const bp = b.pinned ? 1 : 0;
            if (ap !== bp) return bp - ap;
            return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
          });
        });
        void persistNote(next, { force: true });
        return;
      }
      if (run('toggleFocus')) {
        e.preventDefault();
        setFocusMode((v) => !v);
        return;
      }
      if (run('openSettings')) {
        e.preventDefault();
        setSettingsOpen((v) => !v);
        return;
      }
      if (run('collapseSidebar')) {
        e.preventDefault();
        setSidebarOpen(false);
        return;
      }
      if (run('expandSidebar')) {
        e.preventDefault();
        setSidebarOpen(true);
        return;
      }
      if (run('historyBack')) {
        e.preventDefault();
        const idx = historyIndexRef.current;
        if (idx <= 0) return;
        const next = idx - 1;
        setHistoryIndex(next);
        setSelectedId(historyRef.current[next]);
        setFocusMode(false);
        return;
      }
      if (run('historyForward')) {
        e.preventDefault();
        const idx = historyIndexRef.current;
        const hist = historyRef.current;
        if (idx >= hist.length - 1) return;
        const next = idx + 1;
        setHistoryIndex(next);
        setSelectedId(hist[next]);
        setFocusMode(false);
        return;
      }
      if (run('closeNote')) {
        e.preventDefault();
        const latest = noteRef.current;
        if (latest?.id && noteSnapshot(latest) !== saveBaselineRef.current) {
          void persistNote(latest, { force: true });
        }
        setFocusMode(false);
        setSelectedId(null);
        setNote(null);
        return;
      }
      if (run('focusListSearch')) {
        e.preventDefault();
        setFocusMode(false);
        const el = listSearchRef.current;
        if (el) {
          el.focus();
          el.select?.();
        }
        return;
      }
      const statusMap = {
        statusActive: 'active',
        statusOnHold: 'on_hold',
        statusCompleted: 'completed',
        statusDropped: 'dropped',
      };
      for (const [hid, statusId] of Object.entries(statusMap)) {
        if (!run(hid)) continue;
        e.preventDefault();
        const cur = noteRef.current;
        if (!cur?.id) return;
        if (cur.status === statusId) return;
        const next = { ...cur, status: statusId };
        setNote(next);
        noteRef.current = next;
        setNotes((prev) =>
          prev.map((n) => (n.id === next.id ? { ...n, status: statusId } : n)),
        );
        void persistNote(next, { force: true });
        return;
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    nbMenu,
    tagMenu,
    iconPicker,
    movePicker,
    tagEdit,
    notebookDetail,
    templateEditor,
    quickSearchOpen,
    settingsOpen,
    focusMode,
    graphOpen,
    vimMode,
    persistNote,
    openCreate,
    hotkeysRef,
    noteRef,
    saveBaselineRef,
    historyRef,
    historyIndexRef,
    listSearchRef,
    noteSnapshot,
    setNbMenu,
    setTagMenu,
    setIconPicker,
    setMovePicker,
    setTagEdit,
    setNotebookDetail,
    setTemplateEditor,
    setQuickSearchOpen,
    setSettingsOpen,
    setFocusMode,
    setGraphOpen,
    setSidebarOpen,
    setSelectedId,
    setNote,
    setNotes,
    setHistoryIndex,
  ]);
}
