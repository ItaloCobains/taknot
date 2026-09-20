import { useEffect, useState } from 'react';
import {
  HOTKEY_DEFS,
  HOTKEY_ORDER,
  bindingFromEvent,
  findHotkeyConflict,
  formatHotkey,
  loadHotkeys,
  resetHotkeys,
  saveHotkeys,
} from './hotkeys.js';

/**
 * Settings block: list + click-to-record bindings.
 * @param {{ hotkeys: Record<string, import('./hotkeys.js').HotkeyBinding>, onChange: (next: Record<string, import('./hotkeys.js').HotkeyBinding>) => void }} props
 */
export default function HotkeySettings({ hotkeys, onChange }) {
  const [recordingId, setRecordingId] = useState(null);
  const [conflict, setConflict] = useState(null);

  useEffect(() => {
    if (!recordingId) return undefined;

    function onKeyDown(e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setRecordingId(null);
        setConflict(null);
        return;
      }
      const next = bindingFromEvent(e);
      if (!next) return;
      const clash = findHotkeyConflict(hotkeys, recordingId, next);
      if (clash) {
        setConflict({ id: recordingId, with: clash });
        return;
      }
      const map = { ...hotkeys, [recordingId]: next };
      saveHotkeys(map);
      onChange(map);
      setRecordingId(null);
      setConflict(null);
    }

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [recordingId, hotkeys, onChange]);

  return (
    <section className="settings-section">
      <h3 className="settings-section-title">Atalhos</h3>
      <div className="settings-card settings-card-stack">
        <p className="settings-hint" style={{ margin: 0 }}>
          Clique num atalho e pressione a nova combinação. Esc cancela.
        </p>
        <ul className="hotkey-list">
          {HOTKEY_ORDER.map((id) => (
            <li key={id} className="hotkey-row">
              <span className="hotkey-label">{HOTKEY_DEFS[id].label}</span>
              <button
                type="button"
                className={`hotkey-bind ${recordingId === id ? 'is-recording' : ''}`}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setConflict(null);
                  setRecordingId((cur) => (cur === id ? null : id));
                }}
              >
                {recordingId === id
                  ? 'Press keys…'
                  : formatHotkey(hotkeys[id] || HOTKEY_DEFS[id].binding)}
              </button>
            </li>
          ))}
        </ul>
        {conflict && (
          <p className="settings-hint hotkey-conflict">
            Conflito com “{HOTKEY_DEFS[conflict.with]?.label || conflict.with}”.
            Escolha outra combinação.
          </p>
        )}
        <button
          type="button"
          className="settings-update-btn"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            const next = resetHotkeys();
            onChange(next);
            setRecordingId(null);
            setConflict(null);
          }}
        >
          Reset to defaults
        </button>
      </div>
    </section>
  );
}

export function useHotkeysState() {
  const [hotkeys, setHotkeys] = useState(loadHotkeys);
  useEffect(() => {
    const sync = () => setHotkeys(loadHotkeys());
    window.addEventListener('taknot:hotkeys-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('taknot:hotkeys-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return [hotkeys, setHotkeys];
}
