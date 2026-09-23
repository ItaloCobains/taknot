import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  NoteFilterState,
  TaknotMcpInfo,
  TaknotNotebook,
  TaknotNote,
  TaknotTag,
  TaknotTemplate,
} from '../vite-env';
import type { HotkeyMap } from './hotkeys';

type EditorNote = TaknotNote & { body: string };
import { X } from 'lucide-react';
import { BUILTIN_TEMPLATES, groupTemplates } from './templates';
import EditorPane from './EditorPane';
import QuickSearch from './QuickSearch';
import GraphView from './GraphView';
import { useHotkeysState } from './HotkeySettings';
import { formatHotkey } from './hotkeys';
import { tagColorMap } from './TagBadge';
import { renderMarkdown } from './markdown';
import { flattenNotebooks } from './lib/notebooks';
import {
  TRANSLUCENCY_KEY,
  VIM_MODE_KEY,
  TAGS_COLLAPSED_KEY,
  readStoredTranslucency,
  readStoredTagsCollapsed,
  readStoredVimMode,
  applyTranslucency,
} from './lib/prefs';
import { noteSnapshot } from './lib/format';
import { useAppHotkeys } from './useAppHotkeys';
import { useNoteVault } from './useNoteVault';
import { useContextMenuDismiss } from './useContextMenuDismiss';
import { useNotebookActions } from './useNotebookActions';
import { useTagActions } from './useTagActions';
import { useNoteNavigation } from './useNoteNavigation';
import { useTemplateActions } from './useTemplateActions';
import SettingsPanel from './SettingsPanel';
import TagSettingsModal from './TagSettingsModal';
import NotebookDetailModal from './NotebookDetailModal';
import Sidebar from './Sidebar';
import NoteList from './NoteList';
import NotebookContextMenus from './NotebookContextMenus';
import TagContextMenu from './TagContextMenu';
import TemplatePane from './TemplatePane';

export default function App() {
  const [notebooks, setNotebooks] = useState<TaknotNotebook[]>([]);
  const [tags, setTags] = useState<TaknotTag[]>([]);
  const [notes, setNotes] = useState<TaknotNote[]>([]);
  const [filter, setFilter] = useState<NoteFilterState>({ type: 'all' });
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState<EditorNote | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [templateQuery, setTemplateQuery] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('blank');
  const [customTemplates, setCustomTemplates] = useState<TaknotTemplate[]>([])
  const [templateEditor, setTemplateEditor] = useState<any>(null)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [translucency, setTranslucency] = useState(readStoredTranslucency);
  const [vimMode, setVimMode] = useState(readStoredVimMode);
  const [hotkeys, setHotkeys] = useHotkeysState();
  const hotkeysRef = useRef<HotkeyMap>(hotkeys);
  hotkeysRef.current = hotkeys;
  const [tagsCollapsed, setTagsCollapsed] = useState(readStoredTagsCollapsed);
  const [tagFilterQuery, setTagFilterQuery] = useState('');
  const [appVersion, setAppVersion] = useState("");
  const [mcpInfo, setMcpInfo] = useState<TaknotMcpInfo | null>(null);
  const [mcpCopied, setMcpCopied] = useState(false);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [focusMode, setFocusMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [addingNotebook, setAddingNotebook] = useState(false);
  const [addingUnderId, setAddingUnderId] = useState<string | null>(null);
  const [notebookDraft, setNotebookDraft] = useState('');
  const [nbMenu, setNbMenu] = useState<any>(null); // { id, name, icon, x, y }
  const [iconPicker, setIconPicker] = useState<any>(null); // { id, icon, x, y }
  const [movePicker, setMovePicker] = useState<any>(null); // { id, x, y }
  const [tagMenu, setTagMenu] = useState<any>(null); // { id, name, color, x, y }
  const [tagEdit, setTagEdit] = useState<any>(null); // { id, name, color }
  const [collapsedNotebook, setCollapsedNotebook] = useState(() => new Set<string>())
  const [renamingNotebookId, setRenamingNotebookId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [notebookDetail, setNotebookDetail] = useState<any>(null);
  const saveBaselineRef = useRef('');
  const noteRef = useRef<EditorNote | null>(null);
  noteRef.current = note;
  const listSearchRef = useRef<HTMLInputElement | null>(null);
  const historyRef = useRef<string[]>(history);
  const historyIndexRef = useRef<number>(historyIndex);
  historyRef.current = history;
  historyIndexRef.current = historyIndex;

  const notebookTree = useMemo(() => flattenNotebooks(notebooks), [notebooks]);

  function toggleNotebookCollapse(id: string) {
    setCollapsedNotebook((prev) => {
      const next = new Set(prev);

      if (next.has(id)) next.delete(id)
      else next.add(id)

      return next
    })
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
    const f: {
      query?: string;
      notebookId?: string;
      status?: string;
      tag?: string;
    } = { query: query.trim() || undefined };
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

  const { persistNote } = useNoteVault({
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
  });

  const {
    togglePin,
    selectNote,
    openNoteByTitle,
    goBack,
    goForward,
    openCreate,
    handleDelete,
  } = useNoteNavigation({
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
  });

  const {
    handleNewClick,
    createFromTemplate,
    openNewTemplate,
    openEditTemplate,
    saveTemplateEditor,
    removeTemplate,
  } = useTemplateActions({
    note,
    allTemplates,
    selectedTemplateId,
    templateEditor,
    filter,
    selectNote,
    openCreate,
    refreshNotes,
    refreshMeta,
    setTemplateEditor,
    setSelectedTemplateId,
  });

  useAppHotkeys({
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
  });

  useContextMenuDismiss({
    nbMenu,
    tagMenu,
    iconPicker,
    movePicker,
    setNbMenu,
    setTagMenu,
    setIconPicker,
    setMovePicker,
  });

  const {
    handleCreateNotebook,
    openNotebookMenu,
    copyNotebookId,
    showNotebookDetail,
    startRenameNotebook,
    startNewSubNotebook,
    openIconPicker,
    openMoveNotebook,
    pickNotebookIcon,
    pickMoveParent,
    commitRenameNotebook,
    handleDeleteNotebook,
  } = useNotebookActions({
    notebookDraft,
    addingUnderId,
    nbMenu,
    iconPicker,
    movePicker,
    renamingNotebookId,
    renameDraft,
    filter,
    setNotebookDraft,
    setAddingNotebook,
    setAddingUnderId,
    setFilter,
    setNbMenu,
    setTagMenu,
    setIconPicker,
    setMovePicker,
    setNotebookDetail,
    setRenamingNotebookId,
    setRenameDraft,
    setNotebooks,
    refreshMeta,
    refreshNotes,
  });

  const {
    openTagMenu,
    openTagSettings,
    copyTagId,
    filterByTag,
    handleDeleteTag,
    commitTagEdit,
  } = useTagActions({
    tagMenu,
    tagEdit,
    tags,
    filter,
    setNbMenu,
    setIconPicker,
    setMovePicker,
    setTagMenu,
    setTagEdit,
    setFilter,
    setNote,
    refreshMeta,
    refreshNotes,
  });

  const shortcut = formatHotkey(hotkeys.newNote);
  const colorsByTag = useMemo(() => tagColorMap(tags), [tags]);

  return (
    <div
      className={`app ${settingsOpen ? 'settings-open' : ''} ${tagEdit || notebookDetail || quickSearchOpen ? 'modal-open' : ''
        } ${nbMenu || tagMenu || iconPicker || movePicker ? 'menu-open' : ''
        } ${focusMode ? 'focus-mode' : ''} ${sidebarOpen ? '' : 'sidebar-collapsed'} ${graphOpen ? 'graph-open' : ''}`}
    >
      <NotebookContextMenus
        nbMenu={nbMenu}
        iconPicker={iconPicker}
        movePicker={movePicker}
        notebookTree={notebookTree}
        notebooks={notebooks}
        onShowDetail={showNotebookDetail}
        onCopyId={copyNotebookId}
        onNewSub={startNewSubNotebook}
        onRename={startRenameNotebook}
        onOpenIconPicker={openIconPicker}
        onOpenMove={openMoveNotebook}
        onDelete={handleDeleteNotebook}
        onPickIcon={pickNotebookIcon}
        onPickMoveParent={pickMoveParent}
      />

      <TagContextMenu
        tagMenu={tagMenu}
        onSettings={openTagSettings}
        onFilter={filterByTag}
        onCopyId={copyTagId}
        onDelete={handleDeleteTag}
      />

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
        notes={notes}
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

      <NoteList
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        hotkeys={hotkeys}
        listSearchRef={listSearchRef}
        query={query}
        onQueryChange={setQuery}
        onNewNote={handleNewClick}
        newNoteShortcut={shortcut}
        notes={notes}
        selectedId={selectedId}
        onSelectNote={selectNote}
        colorsByTag={colorsByTag}
      />

      <section className="editor-pane">
        {!note ? (
          <TemplatePane
            templateQuery={templateQuery}
            onTemplateQueryChange={setTemplateQuery}
            templateGroups={templateGroups}
            selectedTemplateId={selectedTemplateId}
            onSelectTemplate={setSelectedTemplateId}
            onCreateFromTemplate={createFromTemplate}
            onOpenEditTemplate={openEditTemplate}
            onOpenNewTemplate={openNewTemplate}
            templateEditor={templateEditor}
            onTemplateEditorChange={setTemplateEditor}
            onCancelTemplateEditor={() => setTemplateEditor(null)}
            onSaveTemplateEditor={saveTemplateEditor}
            onRemoveTemplate={removeTemplate}
            templatePreviewHtml={templatePreviewHtml}
          />
        ) : (
          <EditorPane
            note={note}
            tagColors={colorsByTag}
            saving={saving}
            focusMode={focusMode}
            vimMode={vimMode}
            noteTitles={notes.map((n) => n.title).filter((t): t is string => Boolean(t))}
            canGoBack={historyIndex > 0}
            canGoForward={historyIndex >= 0 && historyIndex < history.length - 1}
            onBack={goBack}
            onForward={goForward}
            onToggleFocus={() => setFocusMode((v) => !v)}
            onChange={(partial) =>
              setNote((prev) => (prev ? { ...prev, ...partial } : prev))
            }
            onDelete={handleDelete}
            onOpenNoteByTitle={openNoteByTitle}
            onTogglePin={togglePin}
            onDuplicated={(created: TaknotNote) => {
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
