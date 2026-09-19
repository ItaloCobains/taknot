import { findStatus } from './statuses.js';

export default function StatusBadge({ status, size = 'md', showIcon = true }) {
  const s = findStatus(status);
  const { r, g, b } = hexToRgb(s.color);
  const style = {
    '--status-color': s.color,
    '--status-bg': `rgba(${r}, ${g}, ${b}, 0.18)`,
    '--status-border': `rgba(${r}, ${g}, ${b}, 0.45)`,
  };
  const Icon = s.Icon;

  return (
    <span
      className={`status-badge status-badge-${size} status-${s.className}`}
      style={style}
    >
      {showIcon && <Icon size={size === 'sm' ? 11 : 13} strokeWidth={2} />}
      {s.label}
    </span>
  );
}

function hexToRgb(hex) {
  const h = String(hex || '#8b93a7').replace('#', '');
  if (h.length !== 6) return { r: 139, g: 147, b: 167 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
