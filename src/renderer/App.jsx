import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import {
  ListTodo,
  NotebookPen,
  PanelLeft,
  Pin,
  PenLine,
  Plus,
  Search,
  Settings,
  Tag,
  X,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { BUILTIN_TEMPLATES, groupTemplates } from './templates.js';
import EditorPane from './EditorPane.jsx';
import TagBadge, { tagColorMap } from './TagBadge.jsx';
import StatusBadge from './StatusBadge.jsx';
import { STATUSES } from './statuses.js';
import { NOTEBOOK_ICON_NAMES, NotebookIcon } from './notebookIcons.jsx';

const ICON = { size: 15, strokeWidth: 1.75 };
const EMPTY_ICON = { size: 56, strokeWidth: 1.25 };
const TRANSLUCENCY_KEY = 'taknot.translucency';
const DEFAULT_TRANSLUCENCY = 55;
const VIM_MODE_KEY = 'taknot.vimMode';

/** Depth-first tree order for sidebar nesting. */
function flattenNotebooks(notebooks) {
  const byParent = new Map();
  for (const nb of notebooks) {
    const p = nb.parentId || null;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(nb);
  }
  const out = [];
  function walk(parentId, depth) {
    for (const nb of byParent.get(parentId) || []) {
      out.push({ ...nb, depth });
      walk(nb.id, depth + 1);
    }
  }
  walk(null, 0);
  for (const nb of notebooks) {
    if (!out.some((x) => x.id === nb.id)) out.push({ ...nb, depth: 0 });
  }
  return out;
}

function descendantIds(notebooks, rootId) {
  const kids = new Map();
  for (const nb of notebooks) {
    const p = nb.parentId || null;
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p).push(nb.id);
  }
  const out = new Set();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop();
    for (const child of kids.get(id) || []) {
      if (!out.has(child)) {
        out.add(child);
        stack.push(child);
      }
    }
  }
  return out;
}

function readStoredTranslucency() {
  const raw = Number(localStorage.getItem(TRANSLUCENCY_KEY));
  if (Number.isFinite(raw)) return Math.min(100, Math.max(0, raw));
  return DEFAULT_TRANSLUCENCY;
}

function readStoredVimMode() {
  return localStorage.getItem(VIM_MODE_KEY) === '1';
}

function applyTranslucency(pct) {
  // 0% ≈ sólido legível, 100% ≈ glass extremo (quase só o blur nativo)
  const t = Math.min(100, Math.max(0, pct));
  const alpha = 0.88 - (t / 100) * 0.86; // 100% → 0.02
  const root = document.documentElement;
  root.style.setProperty('--pane-alpha', String(alpha));
  root.style.setProperty(
    '--pane-strong-alpha',
    String(Math.min(0.92, alpha + 0.03)),
  );
  root.style.setProperty(
    '--surface-alpha',
    String(Math.max(0.04, alpha * 0.7)),
  );
}

const TAG_SWATCHES = [
  '#e06c75',
  '#e5c07b',
  '#98c379',
  '#61afef',
  '#c678dd',
  '#56b6c2',
  '#d19a66',
  '#8b93a7',
];

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function titleFromBody(body) {
  const line = (body || '').split('\n').find((l) => l.trim());
  if (!line) return 'Untitled';
  return line.replace(/^#+\s*/, '').trim() || 'Untitled';
}

function isMac() {
  return navigator.platform.toUpperCase().includes('MAC');
}

export default function App() {
  const [notebooks, setNotebooks] = useState([]);
  const [tags, setTags] = useState([]);
  const [notes, setNotes] = useState([]);
  const [filter, setFilter] = useState({ type: 'all' });
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [note, setNote] = useState(null);
  const [saving, setSaving] = useState(false);
  const [templateQuery, setTemplateQuery] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('blank');
  const [customTemplates, setCustomTemplates] = useState([])
  const [templateEditor, setTemplateEditor] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [translucency, setTranslucency] = useState(readStoredTranslucency);
  const [vimMode, setVimMode] = useState(readStoredVimMode);
  const [appVersion, setAppVersion] = useState("");
  const [updateChecking, setUpdateChecking] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [focusMode, setFocusMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

  const notebookTree = useMemo(() => flattenNotebooks(notebooks), [notebooks]);

  const childIdsByParent = useMemo(() => {
    const map = new Map();

    for (const nb of notebooks) {
      const p = nb.parentId || null;

      if (!map.has(p)) map.set(p, [])

      map.get(p).push(nb.id)
    }

    return map
  }, [notebooks])

  function hasChildren(id) {
    return (childIdsByParent.get(id) || []).length > 0
  }

  function isHiddenByCollapse(nb) {
    let parentId = nb.parentId || null

    while (parentId) {
      if (collapsedNotebook.has(parentId)) return true
      parentId = notebooks.find(n => n.id === parentId)?.parentId || null
    }

    return false
  }

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
    window.taknot?.getVersion?.().then(setAppVersion).catch(() => {});
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
      marked.parse(
        selectedTemplate.body || '_Blank note_',
        { async: false },
      ),
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
    }
  }, []);

  useEffect(() => {
    if (!note?.id) return undefined;
    const snap = noteSnapshot(note);
    if (snap === saveBaselineRef.current) return undefined;

    const handle = setTimeout(() => {
      persistNote(note);
    }, 400);
    return () => {
      clearTimeout(handle);
      const latest = noteRef.current;
      if (
        latest?.id === note.id &&
        noteSnapshot(latest) !== saveBaselineRef.current
      ) {
        void persistNote(latest);
      }
    };
  }, [
    note?.id,
    note?.body,
    note?.notebookId,
    note?.status,
    note?.tags,
    note?.pinned,
    persistNote,
  ]);

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

  const notebookName = (id) =>
    notebooks.find((n) => n.id === id)?.name || 'Notebook';

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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        openCreate();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setSidebarOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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

  const isActive = (type, id) =>
    filter.type === type && (id === undefined || filter.id === id);

  const shortcut = isMac() ? '⌘-N' : 'Ctrl-N';
  const colorsByTag = useMemo(() => tagColorMap(tags), [tags]);

  return (
    <div
      className={`app ${settingsOpen ? 'settings-open' : ''} ${tagEdit || notebookDetail ? 'modal-open' : ''
        } ${nbMenu || tagMenu || iconPicker || movePicker ? 'menu-open' : ''
        } ${focusMode ? 'focus-mode' : ''} ${sidebarOpen ? '' : 'sidebar-collapsed'}`}
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

      {tagEdit && (
        <>
          <button
            type="button"
            className="settings-backdrop"
            aria-label="Close"
            onClick={() => setTagEdit(null)}
          />
          <div
            className="settings-panel"
            role="dialog"
            aria-label="Tag settings"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="settings-panel-header">
              <span>Tag Settings</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setTagEdit(null)}
              >
                <X {...ICON} />
              </button>
            </div>
            <div className="settings-field">
              <label htmlFor="tag-name">Name</label>
              <input
                id="tag-name"
                className="settings-text"
                value={tagEdit.name}
                onChange={(e) =>
                  setTagEdit((t) => ({ ...t, name: e.target.value }))
                }
              />
            </div>
            <div className="settings-field" style={{ marginTop: 14 }}>
              <label>Color</label>
              <div className="tag-swatches">
                {TAG_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`tag-swatch ${(tagEdit.color || '').toLowerCase() === c ? 'active' : ''
                      }`}
                    style={{ background: c }}
                    aria-label={c}
                    title={c}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setTagEdit((t) => ({ ...t, color: c }));
                    }}
                  />
                ))}
              </div>
            </div>
            <button
              type="button"
              className="settings-save-btn"
              onClick={commitTagEdit}
            >
              Save
            </button>
          </div>
        </>
      )}

      {notebookDetail && (
        <>
          <button
            type="button"
            className="settings-backdrop"
            aria-label="Close"
            onClick={() => setNotebookDetail(null)}
          />
          <div className="settings-panel notebook-detail" role="dialog">
            <div className="settings-panel-header">
              <span>Notebook detail</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setNotebookDetail(null)}
              >
                <X {...ICON} />
              </button>
            </div>
            <p>
              <strong>{notebookDetail.name}</strong>
            </p>
            <p className="settings-hint">ID: {notebookDetail.id}</p>
            <p className="settings-hint">Notes: {notebookDetail.noteCount}</p>
          </div>
        </>
      )}

      {settingsOpen && (
        <>
          <div
            className="settings-backdrop"
            role="presentation"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSettingsOpen(false);
            }}
          />
          <div
            className="settings-panel"
            role="dialog"
            aria-label="Settings"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="settings-panel-header">
              <span>Settings</span>
              <button
                type="button"
                className="icon-btn"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSettingsOpen(false);
                }}
              >
                <X {...ICON} />
              </button>
            </div>
            <div className="settings-field">
              <label htmlFor="pane-translucency">
                Translucency
                <strong>{translucency}%</strong>
              </label>
              <input
                id="pane-translucency"
                type="range"
                min={0}
                max={100}
                value={translucency}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => setTranslucency(Number(e.target.value))}
              />
              <p className="settings-hint">
                100% = liquid glass extremo (como no início). 0% = bem sólido e
                legível.
              </p>
            </div>
            <div className="settings-field" style={{ marginTop: 18 }}>
              <label className="settings-toggle" htmlFor="vim-mode">
                <span>
                  Vim mode
                  <span className="settings-hint" style={{ display: 'block', margin: 0 }}>
                    Atalhos Vim no editor de markdown (hjkl, modes, etc.).
                  </span>
                </span>
                <input
                  id="vim-mode"
                  type="checkbox"
                  checked={vimMode}
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) => setVimMode(e.target.checked)}
                />
              </label>
            </div>
            <div className="settings-field" style={{ marginTop: 18 }}>
              <label>
                Atualizações
                <strong>{appVersion ? `v${appVersion}` : '…'}</strong>
              </label>
              <button
                type="button"
                className="settings-update-btn"
                disabled={updateChecking}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={async () => {
                  setUpdateChecking(true);
                  try {
                    await window.taknot.checkForUpdates();
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setUpdateChecking(false);
                  }
                }}
              >
                {updateChecking ? 'Verificando…' : 'Verificar atualizações'}
              </button>
              <p className="settings-hint">
                Quando houver versão nova no GitHub, o app avisa e você pode
                atualizar sem baixar manualmente.
              </p>
            </div>
          </div>
        </>
      )}

      <aside className="sidebar">
        <div className="sidebar-top">
          <button
            type="button"
            className={`icon-btn ${settingsOpen ? 'active' : ''}`}
            title="Settings"
            onClick={() => setSettingsOpen((v) => !v)}
          >
            <Settings {...ICON} />
          </button>
          <button
            type="button"
            className="icon-btn"
            title={`Toggle sidebar (${isMac() ? '⌘' : 'Ctrl'}-/)`}
            onClick={() => setSidebarOpen((v) => !v)}
          >
            <PanelLeft {...ICON} />
          </button>
        </div>

        <div className="sidebar-section">
          <button
            type="button"
            className={`nav-item ${isActive('all') ? 'active' : ''}`}
            onClick={() => setFilter({ type: 'all' })}
          >
            <NotebookPen {...ICON} />
            All Notes
          </button>
        </div>

        <div className="sidebar-section">
          <div className="section-head">
            <h2>Notebooks</h2>
            <button
              type="button"
              className="section-icon-btn"
              title="New notebook"
              onClick={() => {
                setAddingUnderId(null);
                setAddingNotebook(true);
                setNotebookDraft('');
              }}
            >
              <Plus {...ICON} />
            </button>
          </div>
          {addingNotebook && (
            <form
              className="inline-create"
              style={
                addingUnderId
                  ? {
                    paddingLeft:
                      12 +
                      ((notebookTree.find((n) => n.id === addingUnderId)
                        ?.depth ?? 0) +
                        1) *
                      12,
                  }
                  : undefined
              }
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateNotebook();
              }}
            >
              <input
                autoFocus
                value={notebookDraft}
                placeholder={
                  addingUnderId
                    ? `Sub of ${notebookName(addingUnderId)}`
                    : 'Notebook name'
                }
                onChange={(e) => setNotebookDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setAddingNotebook(false);
                    setAddingUnderId(null);
                    setNotebookDraft('');
                  }
                }}
              />
            </form>
          )}
          {notebookTree.filter((nb) => !isHiddenByCollapse(nb)).map(nb => renamingNotebookId === nb.id ? (
            <form
              key={nb.id}
              className="inline-create"
              style={{ paddingLeft: 12 + nb.depth * 12 }}
              onSubmit={(e) => {
                e.preventDefault();
                commitRenameNotebook();
              }}
            >
              <input
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onBlur={commitRenameNotebook}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setRenamingNotebookId(null);
                }}
              />
            </form>
          ) : (
            <button
              key={nb.id}
              type="button"
              className={`nav-item ${isActive('notebook', nb.id) ? 'active' : ''}`}
              style={{ paddingLeft: 12 + nb.depth * 12 }}
              onClick={() => setFilter({ type: 'notebook', id: nb.id })}
              onContextMenu={(e) => openNotebookMenu(e, nb)}
            >
              {hasChildren(nb.id) ? (
                <span
                  className='nv-chevron'
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleNotebookCollapse(nb.id)
                  }}
                >
                  {collapsedNotebook.has(nb.id) ? (
                    <ChevronRight size={14} strokeWidth={2} />
                  ) : (

                    <ChevronDown size={14} strokeWidth={2} />
                  )}
                </span>
              ) : (
                <span className='nb-chevron-spacer' />
              )}
              <NotebookIcon name={nb.icon} {...ICON} />
              {nb.name}
            </button>
          ),
          )}
        </div>

        <div className="sidebar-section">
          <h2>Status</h2>
          {STATUSES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`nav-item ${isActive('status', s.id) ? 'active' : ''}`}
              onClick={() => setFilter({ type: 'status', id: s.id })}
            >
              <s.Icon {...ICON} className={`status-icon ${s.className}`} />
              {s.label}
            </button>
          ))}
        </div>

        <div className="sidebar-section">
          <div className="section-head">
            <h2>Tags</h2>
            <Tag {...ICON} className="section-icon" />
          </div>
          {tags.length === 0 && <p className="muted">—</p>}
          {tags.map((tag) => (
            <button
              key={tag.id || tag.name || tag}
              type="button"
              className={`nav-item ${isActive('tag', tag.name || tag) ? 'active' : ''}`}
              onClick={() => setFilter({ type: 'tag', id: tag.name || tag })}
              onContextMenu={(e) =>
                tag.id ? openTagMenu(e, tag) : undefined
              }
            >
              <span
                className="tag-dot"
                style={
                  tag.color
                    ? { background: tag.color, borderColor: tag.color }
                    : undefined
                }
              />
              {tag.name || tag}
            </button>
          ))}
        </div>
      </aside>

      <section className="note-list">
        <header className="pane-header list-header">
          <button
            type="button"
            className="icon-btn sidebar-reopen"
            title={`Toggle sidebar (${isMac() ? '⌘' : 'Ctrl'}-/)`}
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
            notebookName={notebookName(note.notebookId)}
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
