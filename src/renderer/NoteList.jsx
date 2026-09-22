import {
  ListTodo,
  NotebookPen,
  PanelLeft,
  PenLine,
  Pin,
  Search,
} from 'lucide-react';
import { formatHotkey } from './hotkeys.js';
import { relativeTime } from './lib/format.js';
import StatusBadge from './StatusBadge.jsx';
import TagBadge from './TagBadge.jsx';

const ICON = { size: 15, strokeWidth: 1.75 };
const EMPTY_ICON = { size: 56, strokeWidth: 1.25 };

/** Middle column: search, new note, and the filtered note rows. */
export default function NoteList({
  sidebarOpen,
  onToggleSidebar,
  hotkeys,
  listSearchRef,
  query,
  onQueryChange,
  onNewNote,
  newNoteShortcut,
  notes,
  selectedId,
  onSelectNote,
  colorsByTag,
}) {
  return (
    <section className="note-list">
      <header className="pane-header list-header">
        <button
          type="button"
          className="icon-btn sidebar-reopen"
          title={`Toggle sidebar (${formatHotkey(hotkeys.toggleSidebar)})`}
          onClick={onToggleSidebar}
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
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="icon-btn new-note-btn"
          onClick={onNewNote}
          onMouseDown={(e) => e.stopPropagation()}
          title={`${newNoteShortcut} new note`}
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
              Press <kbd>{newNoteShortcut}</kbd> to create new note
            </div>
          </div>
        ) : (
          notes.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`note-item status-${(n.status || 'active').replace('_', '-')} ${n.pinned ? 'pinned' : ''} ${selectedId === n.id ? 'selected' : ''}`}
              onClick={() => onSelectNote(n.id)}
            >
              <div className="note-item-title">
                {n.pinned && (
                  <Pin size={12} strokeWidth={2.25} className="note-pin-icon" />
                )}
                {n.title}
              </div>
              <div className="note-item-meta">
                <span className="note-item-time">
                  {relativeTime(n.updatedAt)}
                </span>
                {n.status && <StatusBadge status={n.status} size="sm" />}
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
  );
}
