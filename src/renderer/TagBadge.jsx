const DEFAULT = '#8b93a7';

function hexToRgb(hex) {
  const h = String(hex || DEFAULT).replace('#', '');
  if (h.length !== 6) return { r: 139, g: 147, b: 167 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Colored tag badge — used in list, editor, and preview. */
export default function TagBadge({
  name,
  color = DEFAULT,
  onRemove,
  onClick,
  size = 'md',
}) {
  const { r, g, b } = hexToRgb(color);
  const style = {
    '--tag-color': color,
    '--tag-bg': `rgba(${r}, ${g}, ${b}, 0.18)`,
    '--tag-border': `rgba(${r}, ${g}, ${b}, 0.45)`,
  };

  const className = `tag-badge tag-badge-${size}${onRemove || onClick ? ' is-interactive' : ''}`;

  if (onRemove) {
    return (
      <button
        type="button"
        className={className}
        style={style}
        onClick={onRemove}
        title="Remove tag"
      >
        {name}
        <span className="tag-badge-x" aria-hidden>
          ×
        </span>
      </button>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={className} style={style} onClick={onClick}>
        {name}
      </button>
    );
  }

  return (
    <span className={className} style={style}>
      {name}
    </span>
  );
}

export function tagColorMap(tags) {
  const map = {};
  for (const t of tags || []) {
    if (t?.name) map[t.name] = t.color || DEFAULT;
  }
  return map;
}
