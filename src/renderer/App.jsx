import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ListTodo,
  NotebookPen,
  PanelLeft,
  Pin,
  PenLine,
  Search,
  X,
} from 'lucide-react';
import { BUILTIN_TEMPLATES, groupTemplates } from './templates.js';
import EditorPane from './EditorPane.jsx';
import QuickSearch from './QuickSearch.jsx';
import GraphView from './GraphView.jsx';
import { useHotkeysState } from './HotkeySettings.jsx';
import { eventMatchesHotkey, formatHotkey } from './hotkeys.js';
import TagBadge, { tagColorMap } from './TagBadge.jsx';
import StatusBadge from './StatusBadge.jsx';
import { NOTEBOOK_ICON_NAMES, NotebookIcon } from './notebookIcons.jsx';
import { renderMarkdown } from './markdown.js';
import { flattenNotebooks, descendantIds } from './lib/notebooks.js';
import {
  TRANSLUCENCY_KEY,
  VIM_MODE_KEY,
  TAGS_COLLAPSED_KEY,
  readStoredTranslucency,
  readStoredTagsCollapsed,
  readStoredVimMode,
  applyTranslucency,
} from './lib/prefs.js';
import { relativeTime, titleFromBody } from './lib/format.js';
import SettingsPanel from './SettingsPanel.jsx';
import TagSettingsModal from './TagSettingsModal.jsx';
import NotebookDetailModal from './NotebookDetailModal.jsx';
import Sidebar from './Sidebar.jsx';

const ICON = { size: 15, strokeWidth: 1.75 };
const EMPTY_ICON = { size: 56, strokeWidth: 1.25 };

export default function App() {
  const [notebooks, setNotebooks] = useState([]);
  const [tags, setTags] = useState([]);
  const [notes, setNotes] = useState([]);
  const [filter, setFilter] = useState({ type: 'all' });
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [note, setNote] = useState(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [templateQuery, setTemplateQuery] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('blank');
  const [customTemplates, setCustomTemplates] = useState([])
  const [templateEditor, setTemplateEditor] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [translucency, setTranslucency] = useState(readStoredTranslucency);
  const [vimMode, setVimMode] = useState(readStoredVimMode);
  const [hotkeys, setHotkeys] = useHotkeysState();
  const hotkeysRef = useRef(hotkeys);
  hotkeysRef.current = hotkeys;
  const [tagsCollapsed, setTagsCollapsed] = useState(readStoredTagsCollapsed);
  const [tagFilterQuery, setTagFilterQuery] = useState('');
  const [appVersion, setAppVersion] = useState("");
  const [mcpInfo, setMcpInfo] = useState(null);
  const [mcpCopied, setMcpCopied] = useState(false);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [focusMode, setFocusMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [addingNotebook, setAddingNotebook] = useState(false);
  const [addingUnderId, setAddingUnderId] = useState(null);
  const [notebookDraft, setNotebookDraft] = useState('');
  const [nbMenu, setNbMenu] = useState(null); // { id, name, icon, x, y }
  const [iconPicker, setIconPicker] = useState(null); // { id, icon, x, y }
  const [movePicker, setMovePicker] = useState(null); // { id, x, y }
  const [tagMenu, setTagMenu] = useState(null); // { id, name, color, x, y }
  const [tagEdit, setTagEdit] = useState(null); // { id, name, color }
  const [collapsedNotebook, setCollapsedNotebook] = useState(() => new Set())
  const [renamingNotebookId, setRenamingNotebookId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [notebookDetail, setNotebookDetail] = useState(null);
  const saveBaselineRef = useRef(null);
  const noteRef = useRef(null);
  noteRef.current = note;
  const listSearchRef = useRef(null);
  const historyRef = useRef(history);
  const historyIndexRef = useRef(historyIndex);
  historyRef.current = history;
  historyIndexRef.current = historyIndex;

  const notebookTree = useMemo(() => flattenNotebooks(notebooks), [notebooks]);

  function toggleNotebookCollapse(id) {
    setCollapsedNotebook((prev) => {
      const next = new Set(prev);

      if (next.has(id)) next.delete(id)
      else next.add(id)

      return next
    })
  }

  function noteSnapshot(n) {
    return JSON.stringify({
      id: n.id,
      title: titleFromBody(n.body),
      body: n.body,
      notebookId: n.notebookId,
      tags: n.tags || [],
      status: n.status,
      pinned: Boolean(n.pinned),
    });
  }

  useEffect(() => {
    applyTranslucency(translucency);
    localStorage.setItem(TRANSLUCENCY_KEY, String(translucency));
  }, [translucency]);

  useEffect(() => {
    localStorage.setItem(VIM_MODE_KEY, vimMode ? '1' : '0');
  }, [vimMode]);

  useEffect(() => {
    localStorage.setItem(TAGS_COLLAPSED_KEY, tagsCollapsed ? '1' : '0');
  }, [tagsCollapsed]);

  useEffect(() => {
    window.taknot?.getVersion?.().then(setAppVersion).catch(() => {});
    window.taknot?.getMcpInfo?.().then(setMcpInfo).catch(() => {});
  }, []);

  const listFilter = useMemo(() => {
    const f = { query: query.trim() || undefined };
    if (filter.type === 'notebook') f.notebookId = filter.id;
    if (filter.type === 'status') f.status = filter.id;
    if (filter.type === 'tag') f.tag = filter.id;
    return f;
  }, [filter, query]);

  const allTemplates = useMemo(
    () => [...BUILTIN_TEMPLATES, ...customTemplates],
    [customTemplates]
  )

  const filteredTemplates = useMemo(() => {
    const q = templateQuery.trim().toLowerCase();
    if (!q) return allTemplates;
    return allTemplates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q),
    );
  }, [templateQuery, allTemplates]);

  const templateGroups = useMemo(
    () => groupTemplates(filteredTemplates),
    [filteredTemplates],
  );

  const selectedTemplate =
    allTemplates.find((t) => t.id === selectedTemplateId) || allTemplates[0];

  const templatePreviewHtml = useMemo(
    () =>
      renderMarkdown(selectedTemplate.body || '_Blank note_', {
        wiki: false,
        tasks: false,
      }),
    [selectedTemplate],
  );

  const refreshMeta = useCallback(async () => {
    const [nbs, tgs, tpls] = await Promise.all([
      window.taknot.listNotebooks(),
      window.taknot.listTags(),
      window.taknot.listCustomTemplates(),
    ]);
    setNotebooks(nbs);
    setTags(tgs);
    setCustomTemplates(tpls)
  }, []);

  const refreshNotes = useCallback(async () => {
    const list = await window.taknot.listNotes(listFilter);
    setNotes(list);
    return list;
  }, [listFilter]);

  useEffect(() => {
    refreshMeta().catch(console.error);
  }, [refreshMeta]);

  useEffect(() => {
    refreshNotes().catch(console.error);
  }, [refreshNotes]);

  useEffect(() => {
    if (!settingsOpen) return;
    window.taknot?.getMcpInfo?.().then(setMcpInfo).catch(() => {});
  }, [settingsOpen]);

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
  }, [refreshMeta, refreshNotes]);

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
  }, [selectedId]);

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
  }, []);

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
  }, [selectedId, persistNote]);

  async function togglePin() {
    if (!note?.id) return;
    const next = { ...note, pinned: !Boolean(note.pinned) };
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
    const saved = await persistNote(next, { force: true });
    if (!saved) {
      console.error('togglePin: save failed');
      setNote(note);
      noteRef.current = note;
      await refreshNotes();
    }
  }


  function selectNote(id, { pushHistory = true } = {}) {
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

  async function openNoteByTitle(title) {
    const q = String(title || '').trim().toLowerCase();
    if (!q) return;
    const hit =
      notes.find((n) => (n.title || '').trim().toLowerCase() === q) || null;
    if (hit) {
      selectNote(hit.id);
      return;
    }
    const list = await refreshNotes();
    const again = (list || []).find(
      (n) => (n.title || '').trim().toLowerCase() === q,
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

  function handleNewClick() {
    if (!note) {
      createFromTemplate();
      return;
    }
    openCreate();
  }

  async function createFromTemplate(template) {
    const t =
      template ||
      allTemplates.find((item) => item.id === selectedTemplateId) ||
      allTemplates[0];
    const notebookId =
      filter.type === 'notebook' ? filter.id : 'nb_inbox';
    try {
      const created = await window.taknot.createNote({
        notebookId,
        title: t.name === 'Blank note' ? 'Untitled' : t.name,
        body: t.body || '# Untitled\n\n',
      });
      await refreshNotes();
      await refreshMeta();
      selectNote(created.id);
    } catch (err) {
      console.error('Failed to create note', err);
    }
  }

  function openNewTemplate() {
    setTemplateEditor({
      name: '',
      category: 'Custom',
      body: '# \n\n',
    });
  }

  function openEditTemplate(t) {
    if (!t || t.builtin) return;
    setTemplateEditor({
      id: t.id,
      name: t.name,
      category: t.category,
      body: t.body || '',
    });
  }

  async function saveTemplateEditor() {
    if (!templateEditor) return
    const name = templateEditor.name.trim()
    if (!name) return
    try {
      const saved = await window.taknot.saveTemplate({
        id: templateEditor.id,
        name,
        category: templateEditor.category.trim() || 'Custom',
        body: templateEditor.body,
      })
      await refreshMeta()
      setSelectedTemplateId(saved.id)
      setTemplateEditor(null)
    } catch (err) {
      console.error(err)
    }
  }

  async function removeTemplate(id) {
    try {
      await window.taknot.deleteTemplate(id)
      await refreshMeta()
      if (selectedTemplateId === id)
        setSelectedTemplateId('blank')

      setTemplateEditor(null)
    } catch (err) {
      console.error(err)
    }
  }

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
  ]);

  async function handleDelete() {
    if (!note) return;
    await window.taknot.deleteNote(note.id);
    setFocusMode(false);
    setSelectedId(null);
    setNote(null);
    await refreshNotes();
    await refreshMeta();
  }

  useEffect(() => {
    if (!nbMenu && !tagMenu && !iconPicker && !movePicker) return undefined;
    function close(e) {
      if (e.target?.closest?.('.context-menu')) return;
      setNbMenu(null);
      setTagMenu(null);
      setIconPicker(null);
      setMovePicker(null);
    }
    const t = setTimeout(() => {
      window.addEventListener('mousedown', close);
      window.addEventListener('scroll', close, true);
    }, 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [nbMenu, tagMenu, iconPicker, movePicker]);

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

  function openTagMenu(e, tag) {
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

  return (
    <div
      className={`app ${settingsOpen ? 'settings-open' : ''} ${tagEdit || notebookDetail || quickSearchOpen ? 'modal-open' : ''
        } ${nbMenu || tagMenu || iconPicker || movePicker ? 'menu-open' : ''
        } ${focusMode ? 'focus-mode' : ''} ${sidebarOpen ? '' : 'sidebar-collapsed'} ${graphOpen ? 'graph-open' : ''}`}
    >
      {nbMenu && (
        <div
          className="context-menu"
          style={{ top: nbMenu.y, left: nbMenu.x }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button type="button" onClick={showNotebookDetail}>
            Show Detail…
          </button>
          <button type="button" onClick={copyNotebookId}>
            Copy Notebook ID
          </button>
          <div className="menu-sep" />
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              startNewSubNotebook();
            }}
          >
            New Sub Notebook…
          </button>
          <button type="button" onClick={startRenameNotebook}>
            Rename Notebook…
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openIconPicker();
            }}
          >
            Change Notebook Icon…
          </button>
          <button
            type="button"
            disabled={nbMenu.id === 'nb_inbox'}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openMoveNotebook();
            }}
          >
            Move Notebook…
          </button>
          <button
            type="button"
            className="danger"
            disabled={nbMenu.id === 'nb_inbox'}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (nbMenu.id === 'nb_inbox') return;
              handleDeleteNotebook(nbMenu.id);
            }}
          >
            Delete Notebook…
          </button>
        </div>
      )}

      {iconPicker && (
        <div
          className="context-menu icon-picker"
          style={{ top: iconPicker.y, left: iconPicker.x }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="icon-picker-grid">
            {NOTEBOOK_ICON_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                className={iconPicker.icon === name ? 'active' : ''}
                title={name}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  pickNotebookIcon(name);
                }}
              >
                <NotebookIcon name={name} {...ICON} />
              </button>
            ))}
          </div>
        </div>
      )}

      {movePicker && (
        <div
          className="context-menu"
          style={{ top: movePicker.y, left: movePicker.x }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              pickMoveParent(null);
            }}
          >
            Top level
          </button>
          <div className="menu-sep" />
          {notebookTree
            .filter((nb) => {
              if (nb.id === movePicker.id) return false;
              if (descendantIds(notebooks, movePicker.id).has(nb.id))
                return false;
              return true;
            })
            .map((nb) => (
              <button
                key={nb.id}
                type="button"
                style={{ paddingLeft: 12 + nb.depth * 12 }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  pickMoveParent(nb.id);
                }}
              >
                <NotebookIcon name={nb.icon} {...ICON} />
                {nb.name}
              </button>
            ))}
        </div>
      )}

      {tagMenu && (
        <div
          className="context-menu"
          style={{ top: tagMenu.y, left: tagMenu.x }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button type="button" onClick={openTagSettings}>
            Tag Settings…
          </button>
          <button type="button" onClick={filterByTag}>
            Filter by Tag
          </button>
          <button type="button" onClick={copyTagId}>
            Copy Tag ID
          </button>
          <div className="menu-sep" />
          <button type="button" className="danger" onClick={handleDeleteTag}>
            Delete Tag…
          </button>
        </div>
      )}

      <TagSettingsModal
        tagEdit={tagEdit}
        onChange={setTagEdit}
        onClose={() => setTagEdit(null)}
        onSave={commitTagEdit}
      />

      <NotebookDetailModal
        notebook={notebookDetail}
        onClose={() => setNotebookDetail(null)}
      />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        translucency={translucency}
        onTranslucencyChange={setTranslucency}
        vimMode={vimMode}
        onVimModeChange={setVimMode}
        hotkeys={hotkeys}
        onHotkeysChange={setHotkeys}
        mcpInfo={mcpInfo}
        mcpCopied={mcpCopied}
        onMcpCopied={setMcpCopied}
        appVersion={appVersion}
        updateChecking={updateChecking}
        onUpdateChecking={setUpdateChecking}
      />


      <QuickSearch
        open={quickSearchOpen}
        onClose={() => setQuickSearchOpen(false)}
        onSelect={(id) => selectNote(id)}
        colorsByTag={colorsByTag}
      />

      <Sidebar
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((v) => !v)}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        hotkeys={hotkeys}
        graphOpen={graphOpen}
        onOpenGraph={() => setGraphOpen(true)}
        onCloseGraph={() => setGraphOpen(false)}
        filter={filter}
        onFilterChange={setFilter}
        notebookTree={notebookTree}
        notebooks={notebooks}
        collapsedNotebook={collapsedNotebook}
        onToggleNotebookCollapse={toggleNotebookCollapse}
        addingNotebook={addingNotebook}
        addingUnderId={addingUnderId}
        notebookDraft={notebookDraft}
        onNotebookDraftChange={setNotebookDraft}
        onStartAddNotebook={() => {
          setAddingUnderId(null);
          setAddingNotebook(true);
          setNotebookDraft('');
        }}
        onCancelAddNotebook={() => {
          setAddingNotebook(false);
          setAddingUnderId(null);
          setNotebookDraft('');
        }}
        onCreateNotebook={handleCreateNotebook}
        renamingNotebookId={renamingNotebookId}
        renameDraft={renameDraft}
        onRenameDraftChange={setRenameDraft}
        onCommitRename={commitRenameNotebook}
        onCancelRename={() => setRenamingNotebookId(null)}
        onOpenNotebookMenu={openNotebookMenu}
        tags={tags}
        tagsCollapsed={tagsCollapsed}
        onToggleTagsCollapsed={() => setTagsCollapsed((v) => !v)}
        tagFilterQuery={tagFilterQuery}
        onTagFilterQueryChange={setTagFilterQuery}
        onOpenTagMenu={openTagMenu}
      />

      {graphOpen && (
        <GraphView
          selectedId={selectedId}
          onClose={() => setGraphOpen(false)}
          onOpenNote={(id) => {
            setGraphOpen(false);
            selectNote(id);
          }}
        />
      )}

      <section className="note-list">
        <header className="pane-header list-header">
          <button
            type="button"
            className="icon-btn sidebar-reopen"
            title={`Toggle sidebar (${formatHotkey(hotkeys.toggleSidebar)})`}
            onClick={() => setSidebarOpen((v) => !v)}
            onMouseDown={(e) => e.stopPropagation()}
            aria-hidden={sidebarOpen}
            tabIndex={sidebarOpen ? -1 : 0}
          >
            <PanelLeft {...ICON} />
          </button>
          <div className="search-wrap">
            <Search {...ICON} className="search-icon" />
            <input
              ref={listSearchRef}
              type="search"
              placeholder="Search notes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="icon-btn new-note-btn"
            onClick={handleNewClick}
            onMouseDown={(e) => e.stopPropagation()}
            title={`${shortcut} new note`}
            aria-label="Create new note"
          >
            <PenLine {...ICON} />
          </button>
        </header>
        <div className="note-list-body">
          {notes.length === 0 ? (
            <div className="empty-state">
              <NotebookPen {...EMPTY_ICON} className="empty-state-icon" />
              <div className="empty-state-title">No notes</div>
              <div className="empty-state-hint">
                Press <kbd>{shortcut}</kbd> to create new note
              </div>
            </div>
          ) : (
            notes.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`note-item status-${(n.status || 'active').replace('_', '-')} ${n.pinned ? 'pinned' : ''} ${selectedId === n.id ? 'selected' : ''}`}
                onClick={() => selectNote(n.id)}
              >
                <div className="note-item-title">
                  {n.pinned && <Pin size={12} strokeWidth={2.25} className="note-pin-icon" />}
                  {n.title}
                </div>
                <div className="note-item-meta">
                  <span className="note-item-time">
                    {relativeTime(n.updatedAt)}
                  </span>
                  {n.status && (
                    <StatusBadge status={n.status} size="sm" />
                  )}
                  {n.tasks && (
                    <span className="note-item-tasks">
                      <ListTodo size={12} strokeWidth={2} />
                      <span className="task-bar" aria-hidden>
                        <span
                          style={{
                            width: `${Math.round((n.tasks.done / n.tasks.total) * 100)}%`,
                          }}
                        />
                      </span>
                      {n.tasks.done} of {n.tasks.total}
                    </span>
                  )}
                </div>
                {n.tags?.length > 0 && (
                  <div className="note-item-tags">
                    {n.tags.map((t) => (
                      <TagBadge
                        key={t}
                        name={t}
                        color={colorsByTag[t]}
                        size="sm"
                      />
                    ))}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </section>

      <section className="editor-pane">
        {!note ? (
          <>
            <header className="pane-header template-header">
              <button
                type="button"
                className="create-note-title-btn"
                onClick={() => createFromTemplate()}
              >
                <PenLine {...ICON} />
                <span>Create a new note</span>
              </button>
            </header>
            <div className="template-pane">
              <div className="template-list">
                <div className="search-wrap template-search">
                  <Search {...ICON} className="search-icon" />
                  <input
                    type="search"
                    placeholder="Search templates…"
                    value={templateQuery}
                    onChange={(e) => setTemplateQuery(e.target.value)}
                  />
                </div>
                <div className="template-groups">
                  {templateGroups.map(([category, items]) => (
                    <div key={category} className="template-group">
                      <h3>{category}</h3>
                      {items.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className={`template-item ${selectedTemplateId === t.id ? 'selected' : ''
                            }`}
                          onClick={() => setSelectedTemplateId(t.id)}
                          onDoubleClick={() => createFromTemplate(t)}
                        >
                          {t.name}
                          {!t.builtin && (
                            <span className='template-item-actions'>
                              <button
                                type='button'
                                className='template-mini-btn'
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openEditTemplate(t)
                                }}>
                                Edit
                              </button>
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="template-actions">
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => createFromTemplate()}
                  >
                    Create note
                  </button>
                  <button
                    type='button'
                    className='btn'
                    onClick={() => openNewTemplate()}
                  >
                    New Template
                  </button>
                </div>
              </div>
              <div className="template-preview">
                {templateEditor ? (
                  <div className="template-editor">
                    <div className="settings-field">
                      <label>Name</label>
                      <input
                        className="settings-text"
                        value={templateEditor.name}
                        onChange={(e) =>
                          setTemplateEditor((s) => ({
                            ...s,
                            name: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="settings-field" style={{ marginTop: 10 }}>
                      <label>Category</label>
                      <input
                        className="settings-text"
                        value={templateEditor.category}
                        onChange={(e) =>
                          setTemplateEditor((s) => ({
                            ...s,
                            category: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="settings-field" style={{ marginTop: 10 }}>
                      <label>Body (markdown)</label>
                      <textarea
                        className="settings-text template-body-input"
                        rows={16}
                        value={templateEditor.body}
                        onChange={(e) =>
                          setTemplateEditor((s) => ({
                            ...s,
                            body: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="template-editor-actions">
                      {templateEditor.id && (
                        <button
                          type="button"
                          className="btn danger"
                          onClick={() => removeTemplate(templateEditor.id)}
                        >
                          Delete
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setTemplateEditor(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn primary"
                        onClick={saveTemplateEditor}
                      >
                        Save template
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="template-preview-card markdown"
                    dangerouslySetInnerHTML={{ __html: templatePreviewHtml }}
                  />
                )}
              </div>
            </div>
          </>
        ) : (
          <EditorPane
            note={note}
            tagColors={colorsByTag}
            saving={saving}
            focusMode={focusMode}
            vimMode={vimMode}
            noteTitles={notes.map((n) => n.title).filter(Boolean)}
            canGoBack={historyIndex > 0}
            canGoForward={historyIndex >= 0 && historyIndex < history.length - 1}
            onBack={goBack}
            onForward={goForward}
            onToggleFocus={() => setFocusMode((v) => !v)}
            onChange={setNote}
            onDelete={handleDelete}
            onOpenNoteByTitle={openNoteByTitle}
            onTogglePin={togglePin}
            onDuplicated={(created) => {
              refreshNotes();
              refreshMeta();
              selectNote(created.id);
            }}
          />
        )}
      </section>
    </div>
  );
}
