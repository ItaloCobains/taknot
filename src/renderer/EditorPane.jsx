import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  Clock3,
  Columns2,
  Copy,
  Eye,
  FileDown,
  Folder,
  Hash,
  ListTodo,
  Maximize2,
  Minimize2,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  Save,
  Trash2,
} from 'lucide-react';
import MdCodeEditor from './MdCodeEditor.jsx';
import TagBadge from './TagBadge.jsx';
import StatusBadge from './StatusBadge.jsx';
import { STATUSES } from './statuses.js';
import { renderMarkdown, toggleTaskAt } from './markdown.js';

const ICON = { size: 15, strokeWidth: 1.75 };

function formatStamp(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function EditorPane({
  note,
  notebookName,
  tagColors = {},
  saving,
  focusMode,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onToggleFocus,
  vimMode = false,
  noteTitles = [],
  onChange,
  onDelete,
  onDuplicated,
  onOpenNoteByTitle,
  onTogglePin,
}) {
  const [viewMode, setViewMode] = useState('split'); // edit | split | preview
  const [tagDraft, setTagDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const editorHostRef = useRef(null);
  const editorApiRef = useRef(null);
  const previewRef = useRef(null);
  const syncingRef = useRef(false);

  function onEditorScrollRatio(ratio) {
    if (viewMode !== 'split' || syncingRef.current) return;
    const to = previewRef.current;
    if (!to) return;
    const toMax = to.scrollHeight - to.clientHeight;
    if (toMax <= 0) return;
    syncingRef.current = true;
    to.scrollTop = ratio * toMax;
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }

  function onPreviewScroll() {
    if (viewMode !== 'split' || syncingRef.current) return;
    const from = previewRef.current;
    if (!from || !editorApiRef.current?.setScrollRatio) return;
    const fromMax = from.scrollHeight - from.clientHeight;
    if (fromMax <= 0) return;
    syncingRef.current = true;
    editorApiRef.current.setScrollRatio(from.scrollTop / fromMax);
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }

  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const previewHtml = useMemo(
    () => renderMarkdown(note?.body || ''),
    [note?.body],
  );

  const tasks = useMemo(() => {
    const text = note?.body || '';
    const total = (text.match(/^\s*[-*+]\s+\[[ xX]\]/gm) || []).length;
    if (!total) return null;
    const done = (text.match(/^\s*[-*+]\s+\[[xX]\]/gm) || []).length;
    return { total, done };
  }, [note?.body]);

  function patch(partial) {
    onChange({ ...note, ...partial });
  }

  function addTag() {
    const tag = tagDraft.trim().toLowerCase();
    if (!tag) return;
    if (note.tags.includes(tag)) {
      setTagDraft('');
      return;
    }
    patch({ tags: [...note.tags, tag] });
    setTagDraft('');
  }

  function removeTag(tag) {
    patch({ tags: note.tags.filter((t) => t !== tag) });
  }

  async function duplicate() {
    setMenuOpen(false);
    const created = await window.taknot.duplicateNote(note.id);
    onDuplicated?.(created);
  }

  async function copyId() {
    setMenuOpen(false);
    try {
      await window.taknot.writeClipboard(note.id);
    } catch (err) {
      console.error(err);
    }
  }

  function exportMarkdown() {
    setMenuOpen(false);
    const blob = new Blob([note.body || ''], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title || 'note'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!note) return null;

  return (
    <>
      <header className="pane-header editor-toolbar">
        <div className="toolbar-left">
          <button
            type="button"
            className="icon-btn"
            title={focusMode ? 'Show sidebars' : 'Focus editor'}
            onClick={onToggleFocus}
          >
            {focusMode ? <Minimize2 {...ICON} /> : <Maximize2 {...ICON} />}
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Back"
            disabled={!canGoBack}
            onClick={onBack}
          >
            <ArrowLeft {...ICON} />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Forward"
            disabled={!canGoForward}
            onClick={onForward}
          >
            <ArrowRight {...ICON} />
          </button>
        </div>

        <div className="view-toggle" role="group" aria-label="View mode">
          <button
            type="button"
            className={`icon-btn ${viewMode === 'edit' ? 'active' : ''}`}
            title="Edit"
            onClick={() => setViewMode('edit')}
          >
            <Pencil {...ICON} />
          </button>
          <button
            type="button"
            className={`icon-btn ${viewMode === 'split' ? 'active' : ''}`}
            title="Split"
            onClick={() => setViewMode('split')}
          >
            <Columns2 {...ICON} />
          </button>
          <button
            type="button"
            className={`icon-btn ${viewMode === 'preview' ? 'active' : ''}`}
            title="Preview"
            onClick={() => setViewMode('preview')}
          >
            <Eye {...ICON} />
          </button>
        </div>

        <div className="toolbar-right" ref={menuRef}>
          <button
            type="button"
            className={`icon-btn ${note.pinned ? 'active' : ''}`}
            title={note.pinned ? 'Unpin note' : 'Pin note'}
            onClick={() => onTogglePin?.()}
          >
            {note.pinned ? <PinOff {...ICON} /> : <Pin {...ICON} />}
          </button>
          <span className={`save-state ${saving ? 'is-saving' : ''}`}>
            <Save size={13} strokeWidth={1.75} />
            {saving ? 'Saving…' : 'Saved'}
          </span>
          <button
            type="button"
            className={`icon-btn ${menuOpen ? 'active' : ''}`}
            title="More"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreVertical {...ICON} />
          </button>
          {menuOpen && (
            <div className="editor-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onTogglePin?.();
                }}
              >
                {note.pinned ? (
                  <PinOff size={14} strokeWidth={1.75} />
                ) : (
                  <Pin size={14} strokeWidth={1.75} />
                )}
                {note.pinned ? 'Unpin' : 'Pin'}
              </button>
              <button type="button" role="menuitem" onClick={duplicate}>
                <Copy size={14} strokeWidth={1.75} /> Duplicate
              </button>
              <button type="button" role="menuitem" onClick={copyId}>
                <Hash size={14} strokeWidth={1.75} /> Copy Note ID
              </button>
              <button type="button" role="menuitem" onClick={exportMarkdown}>
                <FileDown size={14} strokeWidth={1.75} /> Export Markdown
              </button>
              <div className="menu-sep" />
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
              >
                <Trash2 size={14} strokeWidth={1.75} /> Delete
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="editor-meta">
        <h1 className="note-title">{note.title}</h1>
        <div className="note-meta-row">
          <button type="button" className="meta-chip breadcrumb-chip" title={notebookName}>
            <Folder size={14} strokeWidth={1.75} />
            <span className="breadcrumb-text">
              {notebookName}
              <span className="muted"> : </span>
              {note.title}
            </span>
            <ChevronDown size={14} strokeWidth={1.75} />
          </button>

          <label className="meta-chip status-chip">
            <StatusBadge status={note.status} />
            <select
              value={note.status}
              onChange={(e) => patch({ status: e.target.value })}
              aria-label="Status"
            >
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} strokeWidth={1.75} className="status-chevron" />
          </label>

          <div className="tag-row">
            {note.tags.map((tag) => (
              <TagBadge
                key={tag}
                name={tag}
                color={tagColors[tag]}
                onRemove={() => removeTag(tag)}
              />
            ))}
            <input
              className="tag-input"
              placeholder="Add Tags"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
            />
          </div>
        </div>
      </div>

      <div className={`editor-split mode-${viewMode}`}>
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className="md-editor" ref={editorHostRef}>
            <MdCodeEditor
              noteId={note.id}
              value={note.body}
              onChange={(body) => patch({ body })}
              onScrollRatio={onEditorScrollRatio}
              apiRef={editorApiRef}
              vimMode={vimMode}
              noteTitles={noteTitles}
            />
          </div>
        )}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className="preview" ref={previewRef} onScroll={onPreviewScroll}>
            <div className="meta-cards">
              {tasks && (
                <div className="meta-card progress-card">
                  <ListTodo size={14} strokeWidth={1.75} />
                  <div>
                    <div className="meta-label">Progress</div>
                    <div className="meta-progress">
                      <span className="task-bar" aria-hidden>
                        <span
                          style={{
                            width: `${Math.round((tasks.done / tasks.total) * 100)}%`,
                          }}
                        />
                      </span>
                      <span className="meta-value">
                        {tasks.done} of {tasks.total} tasks
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div className="meta-card">
                <Clock3 size={14} strokeWidth={1.75} />
                <div>
                  <div className="meta-label">Created at</div>
                  <div className="meta-value">{formatStamp(note.createdAt)}</div>
                </div>
              </div>
              <div className="meta-card">
                <BookOpen size={14} strokeWidth={1.75} />
                <div>
                  <div className="meta-label">Updated at</div>
                  <div className="meta-value">{formatStamp(note.updatedAt)}</div>
                </div>
              </div>
            </div>
            {note.tags.length > 0 && (
              <div className="preview-tags">
                {note.tags.map((tag) => (
                  <TagBadge key={tag} name={tag} color={tagColors[tag]} />
                ))}
              </div>
            )}
            <div
              className="markdown"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
              onClick={(e) => {
                const box = e.target.closest?.('input[type="checkbox"][data-task]');
                if (box) {
                  e.preventDefault();
                  const idx = Number(box.getAttribute('data-task'));
                  if (Number.isFinite(idx)) {
                    patch({ body: toggleTaskAt(note.body, idx) });
                  }
                  return;
                }
                const wiki = e.target.closest?.('a.wiki-link,[data-wiki-title]');
                if (wiki) {
                  e.preventDefault();
                  const title =
                    wiki.getAttribute('data-wiki-title') ||
                    decodeURIComponent(
                      (wiki.getAttribute('href') || '').replace(
                        /^taknot:\/\/wiki\//i,
                        '',
                      ),
                    );
                  onOpenNoteByTitle?.(title);
                  return;
                }
                const a = e.target.closest?.('a');
                if (!a?.href) return;
                e.preventDefault();
                window.taknot.openExternal(a.href).catch(console.error);
              }}
              onChange={(e) => {
                // Keep controlled via body; swallow native toggle flash
                const box = e.target.closest?.('input[type="checkbox"][data-task]');
                if (box) e.preventDefault();
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}
