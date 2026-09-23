import { X } from 'lucide-react';
import HotkeySettings from './HotkeySettings';
import type { HotkeyMap } from './hotkeys';
import type { TaknotMcpInfo } from '../vite-env';

const ICON = { size: 15, strokeWidth: 1.75 };

/**
 * App settings dialog: appearance, editor, hotkeys, MCP, updates.
 */
type SettingsPanelProps = {
  open: boolean;
  onClose: () => void;
  translucency: number;
  onTranslucencyChange: (n: number) => void;
  vimMode: boolean;
  onVimModeChange: (v: boolean) => void;
  hotkeys: HotkeyMap;
  onHotkeysChange: (h: HotkeyMap) => void;
  mcpInfo: TaknotMcpInfo | null;
  mcpCopied: boolean;
  onMcpCopied: (v: boolean) => void;
  appVersion: string;
  updateChecking: boolean;
  onUpdateChecking: (v: boolean) => void;
};

export default function SettingsPanel({
  open,
  onClose,
  translucency,
  onTranslucencyChange,
  vimMode,
  onVimModeChange,
  hotkeys,
  onHotkeysChange,
  mcpInfo,
  mcpCopied,
  onMcpCopied,
  appVersion,
  updateChecking,
  onUpdateChecking,
}: SettingsPanelProps) {
  if (!open) return null;

  return (
    <>
      <div
        className="settings-backdrop"
        role="presentation"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
      />
      <div
        className="settings-panel"
        role="dialog"
        aria-label="Settings"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="settings-panel-header">
          <span>Settings</span>
          <button
            type="button"
            className="icon-btn"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
          >
            <X {...ICON} />
          </button>
        </div>
        <div className="settings-body">
          <section className="settings-section">
            <h3 className="settings-section-title">Aparência</h3>
            <div className="settings-card">
              <div className="settings-field">
                <label htmlFor="pane-translucency">
                  Translucency
                  <strong>{translucency}%</strong>
                </label>
                <input
                  id="pane-translucency"
                  type="range"
                  min={0}
                  max={100}
                  value={translucency}
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => onTranslucencyChange(Number(e.target.value))}
                />
                <p className="settings-hint">
                  100% = liquid glass extremo. 0% = bem sólido e legível.
                </p>
              </div>
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title">Editor</h3>
            <div className="settings-card">
              <label className="settings-toggle" htmlFor="vim-mode">
                <span>
                  Vim mode
                  <span className="settings-hint" style={{ display: 'block', margin: 0 }}>
                    Atalhos Vim no markdown (hjkl, modes, etc.).
                  </span>
                </span>
                <input
                  id="vim-mode"
                  type="checkbox"
                  checked={vimMode}
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) => onVimModeChange(e.target.checked)}
                />
              </label>
            </div>
          </section>

          <HotkeySettings hotkeys={hotkeys} onChange={onHotkeysChange} />

          <section className="settings-section">
            <h3 className="settings-section-title">
              MCP
              <span className="settings-pill">HTTP</span>
            </h3>
            <div className="settings-card settings-card-stack">
              <p className="settings-hint" style={{ margin: 0 }}>
                Abrir o taknot <strong>sobe</strong> o servidor MCP em
                localhost. Deixe o app aberto e aponte o Cursor para a URL
                abaixo (plug and play — sem <code>server.mjs</code>).
              </p>
              {mcpInfo?.vault ? (
                <div className="settings-kv">
                  <span>Vault</span>
                  <code>{String(mcpInfo.vault ?? "")}</code>
                </div>
              ) : (
                <p className="settings-hint" style={{ margin: 0 }}>
                  Reinicie o app se o path do vault não aparecer.
                </p>
              )}
              <div className="settings-kv">
                <span>Status</span>
                <code>
                  {mcpInfo?.running
                    ? `online · ${mcpInfo.url || ''}`
                    : 'offline — abra o app'}
                </code>
              </div>
              <pre className="settings-mcp-code">{`{
  "mcpServers": {
    "taknot": {
      "url": ${JSON.stringify(mcpInfo?.url || 'http://127.0.0.1:19841/mcp')}
    }
  }
}`}</pre>
              <div className="settings-mcp-actions">
                <button
                  type="button"
                  className="settings-update-btn"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={async () => {
                    const url = mcpInfo?.url || 'http://127.0.0.1:19841/mcp';
                    const snippet = JSON.stringify(
                      {
                        mcpServers: {
                          taknot: {
                            url,
                          },
                        },
                      },
                      null,
                      2,
                    );
                    try {
                      await window.taknot.writeClipboard(snippet);
                      onMcpCopied(true);
                      setTimeout(() => onMcpCopied(false), 1600);
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                >
                  {mcpCopied ? 'Copiado' : 'Copiar snippet Cursor'}
                </button>
              </div>
              <p className="settings-hint" style={{ margin: 0 }}>
                Merge em <code>~/.cursor/mcp.json</code> e refresh no MCP.
                O app precisa estar aberto.
              </p>
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title">
              Sistema
              <span className="settings-pill muted">
                {appVersion ? `v${appVersion}` : '…'}
              </span>
            </h3>
            <div className="settings-card settings-card-stack">
              <p className="settings-hint" style={{ margin: 0 }}>
                Quando houver versão nova no GitHub, o app avisa e você
                pode atualizar sem baixar manualmente.
              </p>
              <button
                type="button"
                className="settings-update-btn"
                disabled={updateChecking}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={async () => {
                  onUpdateChecking(true);
                  try {
                    await window.taknot.checkForUpdates();
                  } catch (err) {
                    console.error(err);
                  } finally {
                    onUpdateChecking(false);
                  }
                }}
              >
                {updateChecking ? 'Verificando…' : 'Verificar atualizações'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
