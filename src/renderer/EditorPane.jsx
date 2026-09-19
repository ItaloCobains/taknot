import { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  CircleCheck,
  CircleMinus,
  CirclePlay,
  CircleX,
  Clock3,
  Columns2,
  Copy,
  Eye,
  FileDown,
  Folder,
  Hash,
  Maximize2,
  Minimize2,
  MoreVertical,
  Pencil,
  Save,
  Trash2,
} from 'lucide-react';

const ICON = { size: 15, strokeWidth: 1.75 };
const STATUSES = [
  { id: 'active', label: 'Active', Icon: CirclePlay },
  { id: 'on_hold', label: 'On Hold', Icon: CircleMinus },
  { id: 'completed', label: 'Completed', Icon: CircleCheck },
  { id: 'dropped', label: 'Dropped', Icon: CircleX },
];

function formatStamp(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function EditorPane({
  note,
  notebookName,
  saving,
  focusMode,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onToggleFocus,
  onChange,
  onDelete,
  onDuplicated,
}) {
  const [viewMode, setViewMode] = useState('split'); // edit | split | preview
  const [tagDraft, setTagDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const editorRef = useRef(null);
  const previewRef = useRef(null);
  const syncingRef = useRef(false);

  function syncScroll(from, to) {
    if (!from || !to || syncingRef.current) return;
    const fromMax = from.scrollHeight - from.clientHeight;
    const toMax = to.scrollHeight - to.clientHeight;
    if (fromMax <= 0 || toMax <= 0) return;
    syncingRef.current = true;
    to.scrollTop = (from.scrollTop / fromMax) * toMax;
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }

  function onEditorScroll() {
    if (viewMode !== 'split') return;
    syncScroll(editorRef.current, previewRef.current);
  }

  function onPreviewScroll() {
    if (viewMode !== 'split') return;
    syncScroll(previewRef.current, editorRef.current);
  }

  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const previewHtml = useMemo(
    () => marked.parse(note?.body || '', { async: false }),
    [note?.body],
  );

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
    await navigator.clipboard.writeText(note.id);
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
            <span>Status</span>
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
              <button
                key={tag}
                type="button"
                className="tag-chip"
                onClick={() => removeTag(tag)}
                title="Remove tag"
              >
                #{tag}
                <span aria-hidden>×</span>
              </button>
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
          <textarea
            ref={editorRef}
            className="editor"
            value={note.body}
            onChange={(e) => patch({ body: e.target.value })}
            onScroll={onEditorScroll}
            spellCheck={false}
            placeholder={"Type '/' for commands…"}
          />
        )}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className="preview" ref={previewRef} onScroll={onPreviewScroll}>
            <div className="meta-cards">
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
                  <span key={tag}>#{tag}</span>
                ))}
              </div>
            )}
            <div
              className="markdown"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        )}
      </div>
    </>
  );
}
