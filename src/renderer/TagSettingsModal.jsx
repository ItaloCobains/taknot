import { X } from 'lucide-react';
import { TAG_SWATCHES } from './lib/prefs';

const ICON = { size: 15, strokeWidth: 1.75 };

/** Edit tag name + color swatches. */
export default function TagSettingsModal({ tagEdit, onChange, onClose, onSave }) {
  if (!tagEdit) return null;

  return (
    <>
      <button
        type="button"
        className="settings-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="settings-panel"
        role="dialog"
        aria-label="Tag settings"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="settings-panel-header">
          <span>Tag Settings</span>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X {...ICON} />
          </button>
        </div>
        <div className="settings-field">
          <label htmlFor="tag-name">Name</label>
          <input
            id="tag-name"
            className="settings-text"
            value={tagEdit.name}
            onChange={(e) => onChange({ ...tagEdit, name: e.target.value })}
          />
        </div>
        <div className="settings-field" style={{ marginTop: 14 }}>
          <label>Color</label>
          <div className="tag-swatches">
            {TAG_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                className={`tag-swatch ${(tagEdit.color || '').toLowerCase() === c ? 'active' : ''}`}
                style={{ background: c }}
                aria-label={c}
                title={c}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange({ ...tagEdit, color: c });
                }}
              />
            ))}
          </div>
        </div>
        <button type="button" className="settings-save-btn" onClick={onSave}>
          Save
        </button>
      </div>
    </>
  );
}
