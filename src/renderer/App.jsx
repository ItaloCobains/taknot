import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { BUILTIN_TEMPLATES, groupTemplates } from './templates.js';
import EditorPane from './EditorPane.jsx';
import QuickSearch from './QuickSearch.jsx';
import GraphView from './GraphView.jsx';
import { useHotkeysState } from './HotkeySettings.jsx';
import { tagColorMap } from './TagBadge.jsx';
import { renderMarkdown } from './markdown.js';
import { flattenNotebooks } from './lib/notebooks.js';
import {
  TRANSLUCENCY_KEY,
  VIM_MODE_KEY,
  TAGS_COLLAPSED_KEY,
  readStoredTranslucency,
  readStoredTagsCollapsed,
  readStoredVimMode,
  applyTranslucency,
} from './lib/prefs.js';
import { noteSnapshot } from './lib/format.js';
import { useAppHotkeys } from './useAppHotkeys.js';
import { useNoteVault } from './useNoteVault.js';
import { useContextMenuDismiss } from './useContextMenuDismiss.js';
import { useNotebookActions } from './useNotebookActions.js';
import { useTagActions } from './useTagActions.js';
import SettingsPanel from './SettingsPanel.jsx';
import TagSettingsModal from './TagSettingsModal.jsx';
import NotebookDetailModal from './NotebookDetailModal.jsx';
import Sidebar from './Sidebar.jsx';
import NoteList from './NoteList.jsx';
import NotebookContextMenus from './NotebookContextMenus.jsx';
import TagContextMenu from './TagContextMenu.jsx';
import TemplatePane from './TemplatePane.jsx';

const ICON = { size: 15, strokeWidth: 1.75 };

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

  async function handleDelete() {
    if (!note) return;
    await window.taknot.deleteNote(note.id);
    setFocusMode(false);
    setSelectedId(null);
    setNote(null);
    await refreshNotes();
    await refreshMeta();
  }


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
