// @ts-nocheck — gradual typing after JS→TS rename.
import { PenLine, Search } from 'lucide-react';

const ICON = { size: 15, strokeWidth: 1.75 };

/**
 * Empty-editor state: pick/create templates and preview/edit them.
 */
export default function TemplatePane({
  templateQuery,
  onTemplateQueryChange,
  templateGroups,
  selectedTemplateId,
  onSelectTemplate,
  onCreateFromTemplate,
  onOpenEditTemplate,
  onOpenNewTemplate,
  templateEditor,
  onTemplateEditorChange,
  onCancelTemplateEditor,
  onSaveTemplateEditor,
  onRemoveTemplate,
  templatePreviewHtml,
}) {
  return (
    <>
      <header className="pane-header template-header">
        <button
          type="button"
          className="create-note-title-btn"
          onClick={() => onCreateFromTemplate()}
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
              onChange={(e) => onTemplateQueryChange(e.target.value)}
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
                    className={`template-item ${selectedTemplateId === t.id ? 'selected' : ''}`}
                    onClick={() => onSelectTemplate(t.id)}
                    onDoubleClick={() => onCreateFromTemplate(t)}
                  >
                    {t.name}
                    {!t.builtin && (
                      <span className="template-item-actions">
                        <button
                          type="button"
                          className="template-mini-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenEditTemplate(t);
                          }}
                        >
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
              onClick={() => onCreateFromTemplate()}
            >
              Create note
            </button>
            <button
              type="button"
              className="btn"
              onClick={onOpenNewTemplate}
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
                    onTemplateEditorChange({
                      ...templateEditor,
                      name: e.target.value,
                    })
                  }
                />
              </div>
              <div className="settings-field" style={{ marginTop: 10 }}>
                <label>Category</label>
                <input
                  className="settings-text"
                  value={templateEditor.category}
                  onChange={(e) =>
                    onTemplateEditorChange({
                      ...templateEditor,
                      category: e.target.value,
                    })
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
                    onTemplateEditorChange({
                      ...templateEditor,
                      body: e.target.value,
                    })
                  }
                />
              </div>
              <div className="template-editor-actions">
                {templateEditor.id && (
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => onRemoveTemplate(templateEditor.id)}
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  className="btn"
                  onClick={onCancelTemplateEditor}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={onSaveTemplateEditor}
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
  );
}
