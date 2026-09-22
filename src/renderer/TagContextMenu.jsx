/** Tag right-click menu. */
export default function TagContextMenu({
  tagMenu,
  onSettings,
  onFilter,
  onCopyId,
  onDelete,
}) {
  if (!tagMenu) return null;

  return (
    <div
      className="context-menu"
      style={{ top: tagMenu.y, left: tagMenu.x }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button type="button" onClick={onSettings}>
        Tag Settings…
      </button>
      <button type="button" onClick={onFilter}>
        Filter by Tag
      </button>
      <button type="button" onClick={onCopyId}>
        Copy Tag ID
      </button>
      <div className="menu-sep" />
      <button type="button" className="danger" onClick={onDelete}>
        Delete Tag…
      </button>
    </div>
  );
}
