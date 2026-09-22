export function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function titleFromBody(body) {
  const line = (body || '').split('\n').find((l) => l.trim());
  if (!line) return 'Untitled';
  return line.replace(/^#+\s*/, '').trim() || 'Untitled';
}

export function isMac() {
  return navigator.platform.toUpperCase().includes('MAC');
}
