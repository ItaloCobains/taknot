import { X } from 'lucide-react';

const ICON = { size: 15, strokeWidth: 1.75 } as const;

type NotebookDetail = {
  id: string;
  name: string;
  noteCount?: number;
};

type Props = {
  notebook: NotebookDetail | null | undefined;
  onClose: () => void;
};

/** Read-only notebook name / id / note count. */
export default function NotebookDetailModal({ notebook, onClose }: Props) {
  if (!notebook) return null;

  return (
    <>
      <button
        type="button"
        className="settings-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="settings-panel notebook-detail" role="dialog">
        <div className="settings-panel-header">
          <span>Notebook detail</span>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X {...ICON} />
          </button>
        </div>
        <p>
          <strong>{notebook.name}</strong>
        </p>
        <p className="settings-hint">ID: {notebook.id}</p>
        <p className="settings-hint">Notes: {notebook.noteCount}</p>
      </div>
    </>
  );
}
