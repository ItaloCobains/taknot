import { useCallback, useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import {
  Book,
  CircleCheck,
  CircleMinus,
  CirclePlay,
  CircleX,
  Hash,
  ListTodo,
  NotebookPen,
  PenLine,
  Plus,
  Search,
  Settings,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { TEMPLATES, groupTemplates } from './templates.js';
import EditorPane from './EditorPane.jsx';

const ICON = { size: 15, strokeWidth: 1.75 };
const EMPTY_ICON = { size: 56, strokeWidth: 1.25 };
const TRANSLUCENCY_KEY = 'taknot.translucency';
const DEFAULT_TRANSLUCENCY = 55;

function readStoredTranslucency() {
  const raw = Number(localStorage.getItem(TRANSLUCENCY_KEY));
  if (Number.isFinite(raw)) return Math.min(100, Math.max(0, raw));
  return DEFAULT_TRANSLUCENCY;
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

const STATUSES = [
  { id: 'active', label: 'Active', className: 'active', Icon: CirclePlay },
  { id: 'on_hold', label: 'On Hold', className: 'on-hold', Icon: CircleMinus },
  { id: 'completed', label: 'Completed', className: 'completed', Icon: CircleCheck },
  { id: 'dropped', label: 'Dropped', className: 'dropped', Icon: CircleX },
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [translucency, setTranslucency] = useState(readStoredTranslucency);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [focusMode, setFocusMode] = useState(false);
  const [addingNotebook, setAddingNotebook] = useState(false);
  const [notebookDraft, setNotebookDraft] = useState('');
  const [nbMenu, setNbMenu] = useState(null); // { id, name, x, y }
  const [renamingNotebookId, setRenamingNotebookId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [notebookDetail, setNotebookDetail] = useState(null);

  useEffect(() => {
    applyTranslucency(translucency);
    localStorage.setItem(TRANSLUCENCY_KEY, String(translucency));
  }, [translucency]);

  const listFilter = useMemo(() => {
    const f = { query: query.trim() || undefined };
    if (filter.type === 'notebook') f.notebookId = filter.id;
    if (filter.type === 'status') f.status = filter.id;
    if (filter.type === 'tag') f.tag = filter.id;
    return f;
  }, [filter, query]);

  const filteredTemplates = useMemo(() => {
    const q = templateQuery.trim().toLowerCase();
    if (!q) return TEMPLATES;
    return TEMPLATES.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q),
    );
  }, [templateQuery]);

  const templateGroups = useMemo(
    () => groupTemplates(filteredTemplates),
    [filteredTemplates],
  );

  const selectedTemplate =
    TEMPLATES.find((t) => t.id === selectedTemplateId) || TEMPLATES[0];

  const templatePreviewHtml = useMemo(
    () =>
      marked.parse(
        selectedTemplate.body || '_Blank note_',
        { async: false },
      ),
    [selectedTemplate],
  );

  const refreshMeta = useCallback(async () => {
    const [nbs, tgs] = await Promise.all([
      window.taknot.listNotebooks(),
      window.taknot.listTags(),
    ]);
    setNotebooks(nbs);
    setTags(tgs);
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
        if (!cancelled) setNote(n);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!note?.id) return undefined;
    const payload = {
      id: note.id,
      title: titleFromBody(note.body),
      body: note.body,
      notebookId: note.notebookId,
      tags: note.tags,
      status: note.status,
    };
    const handle = setTimeout(async () => {
      setSaving(true);
      try {
        await window.taknot.saveNote(payload);
        setNote((prev) =>
          prev && prev.id === payload.id
            ? { ...prev, title: payload.title, updatedAt: new Date().toISOString() }
            : prev,
        );
        await refreshNotes();
        await refreshMeta();
      } catch (err) {
        console.error(err);
      } finally {
        setSaving(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [
    note?.id,
    note?.body,
    note?.notebookId,
    note?.status,
    note?.tags,
    refreshNotes,
    refreshMeta,
  ]);

  const notebookName = (id) =>
    notebooks.find((n) => n.id === id)?.name || 'Notebook';

  function selectNote(id, { pushHistory = true } = {}) {
    setSelectedId(id);
    if (!id || !pushHistory) return;
    const trimmed = history.slice(0, historyIndex + 1);
    if (trimmed[trimmed.length - 1] === id) return;
    const next = [...trimmed, id].slice(-50);
    setHistory(next);
    setHistoryIndex(next.length - 1);
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
      TEMPLATES.find((item) => item.id === selectedTemplateId) ||
      TEMPLATES[0];
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

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        openCreate();
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
    if (!nbMenu) return undefined;
    function close() {
      setNbMenu(null);
    }
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [nbMenu]);

  async function handleCreateNotebook() {
    const name = notebookDraft.trim();
    if (!name) return;
    try {
      const nb = await window.taknot.createNotebook(name);
      setNotebookDraft('');
      setAddingNotebook(false);
      await refreshMeta();
      setFilter({ type: 'notebook', id: nb.id });
    } catch (err) {
      console.error(err);
    }
  }

  function openNotebookMenu(e, nb) {
    e.preventDefault();
    e.stopPropagation();
    setNbMenu({
      id: nb.id,
      name: nb.name,
      x: e.clientX,
      y: e.clientY,
    });
  }

  async function copyNotebookId() {
    if (!nbMenu) return;
    await navigator.clipboard.writeText(nbMenu.id);
    setNbMenu(null);
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

  async function handleDeleteNotebook() {
    if (!nbMenu) return;
    if (nbMenu.id === 'nb_inbox') {
      setNbMenu(null);
      return;
    }
    if (!window.confirm(`Delete notebook “${nbMenu.name}”? Notes move to Inbox.`)) {
      setNbMenu(null);
      return;
    }
    try {
      await window.taknot.deleteNotebook(nbMenu.id);
      if (filter.type === 'notebook' && filter.id === nbMenu.id) {
        setFilter({ type: 'all' });
      }
      await refreshMeta();
      await refreshNotes();
    } catch (err) {
      console.error(err);
    }
    setNbMenu(null);
  }

  async function exportNotebook(asHtml) {
    if (!nbMenu) return;
    try {
      const data = await window.taknot.getNotebookExport(nbMenu.id);
      let content;
      let mime;
      let ext;
      if (asHtml) {
        const body = data.notes
          .map(
            (n) =>
              `<h1>${escapeHtml(n.title)}</h1>\n${marked.parse(n.body || '', { async: false })}`,
          )
          .join('\n<hr/>\n');
        content = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(data.notebook.name)}</title></head><body>${body}</body></html>`;
        mime = 'text/html';
        ext = 'html';
      } else {
        content = data.notes
          .map((n) => `# ${n.title}\n\n${n.body || ''}`)
          .join('\n\n---\n\n');
        mime = 'text/markdown';
        ext = 'md';
      }
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.notebook.name}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
    setNbMenu(null);
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  const isActive = (type, id) =>
    filter.type === type && (id === undefined || filter.id === id);

  const shortcut = isMac() ? '⌘-N' : 'Ctrl-N';

  return (
    <div
      className={`app ${settingsOpen ? 'settings-open' : ''} ${focusMode ? 'focus-mode' : ''}`}
    >
      {nbMenu && (
        <div
          className="context-menu"
          style={{ top: nbMenu.y, left: nbMenu.x }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button type="button" onClick={showNotebookDetail}>
            Show Detail…
          </button>
          <button type="button" onClick={copyNotebookId}>
            Copy Notebook ID
          </button>
          <div className="menu-sep" />
          <button type="button" disabled>
            New Sub Notebook…
          </button>
          <button type="button" onClick={startRenameNotebook}>
            Rename Notebook…
          </button>
          <button type="button" disabled>
            Change Notebook Icon…
          </button>
          <button type="button" disabled>
            Move Notebook…
          </button>
          <button
            type="button"
            className="danger"
            disabled={nbMenu.id === 'nb_inbox'}
            onClick={handleDeleteNotebook}
          >
            Delete Notebook…
          </button>
          <div className="menu-sep" />
          <button type="button" onClick={() => exportNotebook(true)}>
            Export as HTML…
          </button>
          <button type="button" onClick={() => exportNotebook(false)}>
            Export as Markdown…
          </button>
        </div>
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
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateNotebook();
              }}
            >
              <input
                autoFocus
                value={notebookDraft}
                placeholder="Notebook name"
                onChange={(e) => setNotebookDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setAddingNotebook(false);
                    setNotebookDraft('');
                  }
                }}
              />
            </form>
          )}
          {notebooks.map((nb) =>
            renamingNotebookId === nb.id ? (
              <form
                key={nb.id}
                className="inline-create"
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
                onClick={() => setFilter({ type: 'notebook', id: nb.id })}
                onContextMenu={(e) => openNotebookMenu(e, nb)}
              >
                <Book {...ICON} />
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
              key={tag}
              type="button"
              className={`nav-item ${isActive('tag', tag) ? 'active' : ''}`}
              onClick={() => setFilter({ type: 'tag', id: tag })}
            >
              <Hash {...ICON} />
              {tag}
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <button type="button" className="nav-item" disabled>
            <Trash2 {...ICON} />
            Trash
          </button>
        </div>
      </aside>

      <section className="note-list">
        <header className="pane-header list-header">
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
                className={`note-item ${selectedId === n.id ? 'selected' : ''}`}
                onClick={() => selectNote(n.id)}
              >
                <div className="note-item-title">{n.title}</div>
                <div className="note-item-meta">
                  <span className="note-item-time">
                    {relativeTime(n.updatedAt)}
                  </span>
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
                    <span className="tags-label">Tags:</span>{' '}
                    {n.tags.map((t) => `#${t}`).join(' ')}
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
                          className={`template-item ${
                            selectedTemplateId === t.id ? 'selected' : ''
                          }`}
                          onClick={() => setSelectedTemplateId(t.id)}
                          onDoubleClick={() => createFromTemplate(t)}
                        >
                          {t.name}
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
                </div>
              </div>
              <div className="template-preview">
                <div
                  className="template-preview-card markdown"
                  dangerouslySetInnerHTML={{ __html: templatePreviewHtml }}
                />
              </div>
            </div>
          </>
        ) : (
          <EditorPane
            note={note}
            notebookName={notebookName(note.notebookId)}
            saving={saving}
            focusMode={focusMode}
            canGoBack={historyIndex > 0}
            canGoForward={historyIndex >= 0 && historyIndex < history.length - 1}
            onBack={goBack}
            onForward={goForward}
            onToggleFocus={() => setFocusMode((v) => !v)}
            onChange={setNote}
            onDelete={handleDelete}
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
