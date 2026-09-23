import { useMemo, type MouseEvent as ReactMouseEvent } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Network,
  NotebookPen,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Tag,
} from 'lucide-react';
import { STATUSES } from './statuses';
import { NotebookIcon } from './notebookIcons';
import { formatHotkey, type HotkeyMap } from './hotkeys';
import type { NoteFilterState, TaknotNotebook, TaknotTag } from '../vite-env';

type NotebookTreeNode = TaknotNotebook & { children?: NotebookTreeNode[]; depth?: number };

type SidebarProps = {
  settingsOpen: boolean;
  onToggleSettings: () => void;
  onToggleSidebar: () => void;
  hotkeys: HotkeyMap;
  graphOpen: boolean;
  onOpenGraph: () => void;
  onCloseGraph: () => void;
  filter: NoteFilterState;
  onFilterChange: (f: NoteFilterState) => void;
  notebookTree: NotebookTreeNode[];
  notebooks: TaknotNotebook[];
  collapsedNotebook: Set<string>;
  onToggleNotebookCollapse: (id: string) => void;
  addingNotebook: boolean;
  addingUnderId: string | null;
  notebookDraft: string;
  onNotebookDraftChange: (v: string) => void;
  onStartAddNotebook: (parentId?: string | null) => void;
  onCancelAddNotebook: () => void;
  onCreateNotebook: () => void;
  renamingNotebookId: string | null;
  renameDraft: string;
  onRenameDraftChange: (v: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onOpenNotebookMenu: (e: ReactMouseEvent, nb: TaknotNotebook) => void;
  tags: TaknotTag[];
  tagsCollapsed: boolean;
  onToggleTagsCollapsed: () => void;
  tagFilterQuery: string;
  onTagFilterQueryChange: (v: string) => void;
  onOpenTagMenu: (e: ReactMouseEvent, tag: TaknotTag) => void;
};

const ICON = { size: 15, strokeWidth: 1.75 };

/**
 * Left nav: settings/toggle, all notes, graph, notebooks tree, status, tags.
 */
export default function Sidebar({
  settingsOpen,
  onToggleSettings,
  onToggleSidebar,
  hotkeys,
  graphOpen,
  onOpenGraph,
  onCloseGraph,
  filter,
  onFilterChange,
  notebookTree,
  notebooks,
  collapsedNotebook,
  onToggleNotebookCollapse,
  addingNotebook,
  addingUnderId,
  notebookDraft,
  onNotebookDraftChange,
  onStartAddNotebook,
  onCancelAddNotebook,
  onCreateNotebook,
  renamingNotebookId,
  renameDraft,
  onRenameDraftChange,
  onCommitRename,
  onCancelRename,
  onOpenNotebookMenu,
  tags,
  tagsCollapsed,
  onToggleTagsCollapsed,
  tagFilterQuery,
  onTagFilterQueryChange,
  onOpenTagMenu,
}: SidebarProps) {
  const childIdsByParent = useMemo(() => {
    const map = new Map<string | null, string[]>();
    for (const nb of notebooks) {
      const p = nb.parentId || null;
      if (!map.has(p)) map.set(p, []);
      map.get(p)!.push(nb.id);
    }
    return map;
  }, [notebooks]);

  function hasChildren(id: string) {
    return (childIdsByParent.get(id) || []).length > 0;
  }

  function isHiddenByCollapse(nb: TaknotNotebook) {
    let parentId = nb.parentId || null;
    while (parentId) {
      if (collapsedNotebook.has(parentId)) return true;
      parentId = notebooks.find((n) => n.id === parentId)?.parentId || null;
    }
    return false;
  }

  const notebookName = (id: string) =>
    notebooks.find((n) => n.id === id)?.name || 'notebook';

  const isActive = (type: string, id?: string): boolean =>
    filter.type === type && (!id || ('id' in filter && (filter as { id?: string }).id === id));

  const filteredSidebarTags = useMemo(() => {
    const q = tagFilterQuery.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((tag) =>
      String(tag.name || tag).toLowerCase().includes(q),
    );
  }, [tags, tagFilterQuery]);

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <button
          type="button"
          className={`icon-btn ${settingsOpen ? 'active' : ''}`}
          title="Settings"
          onClick={onToggleSettings}
        >
          <Settings {...ICON} />
        </button>
        <button
          type="button"
          className="icon-btn"
          title={`Toggle sidebar (${formatHotkey(hotkeys.toggleSidebar)})`}
          onClick={onToggleSidebar}
        >
          <PanelLeft {...ICON} />
        </button>
      </div>

      <div className="sidebar-section sidebar-section-fixed">
        <button
          type="button"
          className={`nav-item ${isActive('all') && !graphOpen ? 'active' : ''}`}
          onClick={() => {
            onCloseGraph();
            onFilterChange({ type: 'all' });
          }}
        >
          <NotebookPen {...ICON} />
          All Notes
        </button>
        <button
          type="button"
          className={`nav-item ${graphOpen ? 'active' : ''}`}
          onClick={onOpenGraph}
        >
          <Network {...ICON} />
          Graph
        </button>
      </div>

      <div className="sidebar-section sidebar-section-scroll">
        <div className="section-head">
          <h2>Notebooks</h2>
          <button
            type="button"
            className="section-icon-btn"
            title="New notebook"
            onClick={() => onStartAddNotebook()}
          >
            <Plus {...ICON} />
          </button>
        </div>
        <div className="sidebar-section-body">
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
                onCreateNotebook();
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
                onChange={(e) => onNotebookDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') onCancelAddNotebook();
                }}
              />
            </form>
          )}
          {notebookTree
            .filter((nb) => !isHiddenByCollapse(nb))
            .map((nb) =>
              renamingNotebookId === nb.id ? (
                <form
                  key={nb.id}
                  className="inline-create"
                  style={{ paddingLeft: 12 + (nb.depth ?? 0) * 12 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    onCommitRename();
                  }}
                >
                  <input
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => onRenameDraftChange(e.target.value)}
                    onBlur={onCommitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') onCancelRename();
                    }}
                  />
                </form>
              ) : (
                <button
                  key={nb.id}
                  type="button"
                  className={`nav-item ${isActive('notebook', nb.id) ? 'active' : ''}`}
                  style={{ paddingLeft: 12 + (nb.depth ?? 0) * 12 }}
                  onClick={() => onFilterChange({ type: 'notebook', id: nb.id })}
                  onContextMenu={(e) => onOpenNotebookMenu(e, nb)}
                >
                  {hasChildren(nb.id) ? (
                    <span
                      className="nv-chevron"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleNotebookCollapse(nb.id);
                      }}
                    >
                      {collapsedNotebook.has(nb.id) ? (
                        <ChevronRight size={14} strokeWidth={2} />
                      ) : (
                        <ChevronDown size={14} strokeWidth={2} />
                      )}
                    </span>
                  ) : (
                    <span className="nb-chevron-spacer" />
                  )}
                  <NotebookIcon name={nb.icon} {...ICON} />
                  {nb.name}
                </button>
              ),
            )}
        </div>
      </div>

      <div className="sidebar-section sidebar-section-fixed">
        <h2>Status</h2>
        {STATUSES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`nav-item ${isActive('status', s.id) ? 'active' : ''}`}
            onClick={() => onFilterChange({ type: 'status', id: s.id })}
          >
            <s.Icon {...ICON} className={`status-icon ${s.className}`} />
            {s.label}
          </button>
        ))}
      </div>

      <div
        className={`sidebar-section sidebar-section-scroll ${tagsCollapsed ? 'is-collapsed' : ''}`}
      >
        <button
          type="button"
          className="section-head section-head-toggle"
          onClick={onToggleTagsCollapsed}
          title={tagsCollapsed ? 'Expandir tags' : 'Recolher tags'}
        >
          <span className="section-head-left">
            {tagsCollapsed ? (
              <ChevronRight size={14} strokeWidth={2} />
            ) : (
              <ChevronDown size={14} strokeWidth={2} />
            )}
            <h2>Tags</h2>
            {tags.length > 0 && (
              <span className="section-count">{tags.length}</span>
            )}
          </span>
          <Tag {...ICON} className="section-icon" />
        </button>
        {!tagsCollapsed && (
          <div className="sidebar-section-body">
            {tags.length > 6 && (
              <div className="tag-filter-wrap">
                <Search size={13} strokeWidth={2} className="tag-filter-icon" />
                <input
                  type="search"
                  className="tag-filter-input"
                  placeholder="Filtrar tags…"
                  value={tagFilterQuery}
                  onChange={(e) => onTagFilterQueryChange(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>
            )}
            {tags.length === 0 && <p className="muted">—</p>}
            {tags.length > 0 && filteredSidebarTags.length === 0 && (
              <p className="muted tag-filter-empty">Nenhuma tag</p>
            )}
            {filteredSidebarTags.map((tag: any) => (
              <button
                key={tag.id || tag.name || tag}
                type="button"
                className={`nav-item ${isActive('tag', tag.name || tag) ? 'active' : ''}`}
                onClick={() =>
                  onFilterChange({ type: 'tag', id: tag.name || tag })
                }
                onContextMenu={(e) =>
                  tag.id ? onOpenTagMenu(e, tag) : undefined
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
        )}
      </div>
    </aside>
  );
}
