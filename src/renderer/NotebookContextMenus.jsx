import { NOTEBOOK_ICON_NAMES, NotebookIcon } from './notebookIcons.jsx';
import { descendantIds } from './lib/notebooks';

const ICON = { size: 15, strokeWidth: 1.75 };

/** Notebook right-click menu + icon/move pickers. */
export default function NotebookContextMenus({
  nbMenu,
  iconPicker,
  movePicker,
  notebookTree,
  notebooks,
  onShowDetail,
  onCopyId,
  onNewSub,
  onRename,
  onOpenIconPicker,
  onOpenMove,
  onDelete,
  onPickIcon,
  onPickMoveParent,
}) {
  return (
    <>
      {nbMenu && (
        <div
          className="context-menu"
          style={{ top: nbMenu.y, left: nbMenu.x }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button type="button" onClick={onShowDetail}>
            Show Detail…
          </button>
          <button type="button" onClick={onCopyId}>
            Copy Notebook ID
          </button>
          <div className="menu-sep" />
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onNewSub();
            }}
          >
            New Sub Notebook…
          </button>
          <button type="button" onClick={onRename}>
            Rename Notebook…
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenIconPicker();
            }}
          >
            Change Notebook Icon…
          </button>
          <button
            type="button"
            disabled={nbMenu.id === 'nb_inbox'}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenMove();
            }}
          >
            Move Notebook…
          </button>
          <button
            type="button"
            className="danger"
            disabled={nbMenu.id === 'nb_inbox'}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (nbMenu.id === 'nb_inbox') return;
              onDelete(nbMenu.id);
            }}
          >
            Delete Notebook…
          </button>
        </div>
      )}

      {iconPicker && (
        <div
          className="context-menu icon-picker"
          style={{ top: iconPicker.y, left: iconPicker.x }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="icon-picker-grid">
            {NOTEBOOK_ICON_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                className={iconPicker.icon === name ? 'active' : ''}
                title={name}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onPickIcon(name);
                }}
              >
                <NotebookIcon name={name} {...ICON} />
              </button>
            ))}
          </div>
        </div>
      )}

      {movePicker && (
        <div
          className="context-menu"
          style={{ top: movePicker.y, left: movePicker.x }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPickMoveParent(null);
            }}
          >
            Top level
          </button>
          <div className="menu-sep" />
          {notebookTree
            .filter((nb) => {
              if (nb.id === movePicker.id) return false;
              if (descendantIds(notebooks, movePicker.id).has(nb.id)) return false;
              return true;
            })
            .map((nb) => (
              <button
                key={nb.id}
                type="button"
                style={{ paddingLeft: 12 + nb.depth * 12 }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onPickMoveParent(nb.id);
                }}
              >
                <NotebookIcon name={nb.icon} {...ICON} />
                {nb.name}
              </button>
            ))}
        </div>
      )}
    </>
  );
}
