import type { Dispatch, SetStateAction } from 'react';
import type {
  NoteFilterState,
  TaknotNote,
  TaknotTemplate,
} from '../vite-env';

type TemplateEditor = {
  id?: string;
  name: string;
  category: string;
  body: string;
} | null;

type Args = {
  note: TaknotNote | null;
  allTemplates: TaknotTemplate[];
  selectedTemplateId: string;
  templateEditor: TemplateEditor;
  filter: NoteFilterState;
  selectNote: (id: string) => void;
  openCreate: () => void;
  refreshNotes: () => Promise<unknown>;
  refreshMeta: () => Promise<unknown>;
  setTemplateEditor: Dispatch<SetStateAction<TemplateEditor>>;
  setSelectedTemplateId: Dispatch<SetStateAction<string>>;
};

/** Empty-state templates: create note from template + custom template CRUD. */
export function useTemplateActions({
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
}: Args) {
  function handleNewClick() {
    if (!note) {
      void createFromTemplate();
      return;
    }
    openCreate();
  }

  async function createFromTemplate(template?: TaknotTemplate) {
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

  function openEditTemplate(t: TaknotTemplate | null | undefined) {
    if (!t || t.builtin) return;
    setTemplateEditor({
      id: t.id,
      name: t.name,
      category: t.category,
      body: t.body || '',
    });
  }

  async function saveTemplateEditor() {
    if (!templateEditor) return;
    const name = templateEditor.name.trim();
    if (!name) return;
    try {
      const saved = await window.taknot.saveTemplate({
        id: templateEditor.id,
        name,
        category: templateEditor.category.trim() || 'Custom',
        body: templateEditor.body,
      });
      await refreshMeta();
      setSelectedTemplateId(saved.id);
      setTemplateEditor(null);
    } catch (err) {
      console.error(err);
    }
  }

  async function removeTemplate(id: string) {
    try {
      await window.taknot.deleteTemplate(id);
      await refreshMeta();
      if (selectedTemplateId === id) setSelectedTemplateId('blank');
      setTemplateEditor(null);
    } catch (err) {
      console.error(err);
    }
  }

  return {
    handleNewClick,
    createFromTemplate,
    openNewTemplate,
    openEditTemplate,
    saveTemplateEditor,
    removeTemplate,
  };
}
