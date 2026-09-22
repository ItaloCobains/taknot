/**
 * Empty-state templates: create note from template + custom template CRUD.
 */
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
}) {
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

  async function removeTemplate(id) {
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
