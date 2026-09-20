import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';

const ICON = { size: 16, strokeWidth: 2 };

export default function QuickSearch({
  open,
  onClose,
  onSelect,
  colorsByTag = {},
}) {
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [notes, setNotes] = useState([]);
  const [index, setIndex] = useState(0);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    setIndex(0);
    let cancelled = false;
    window.taknot
      .listNotes({})
      .then((list) => {
        if (!cancelled) setNotes(list || []);
      })
      .catch(console.error);
    const t = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelled = true;
      cancelAnimationFrame(t);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes.slice(0, 40);
    return notes
      .filter((n) => {
        const title = (n.title || '').toLowerCase();
        const tags = (n.tags || []).join(' ').toLowerCase();
        return title.includes(q) || tags.includes(q);
      })
      .slice(0, 40);
  }, [notes, query]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndex((i) =>
          filtered.length ? (i + 1) % filtered.length : 0,
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndex((i) =>
          filtered.length
            ? (i - 1 + filtered.length) % filtered.length
            : 0,
        );
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const hit = filtered[index];
        if (hit) {
          onSelect(hit.id);
          onClose();
        }
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, filtered, index, onClose, onSelect]);

  useEffect(() => {
    const el = listRef.current?.querySelector('.quick-search-item.active');
    el?.scrollIntoView({ block: 'nearest' });
  }, [index, filtered]);

  if (!open) return null;

  return (
    <>
      <div
        className="settings-backdrop quick-search-backdrop"
        role="presentation"
        onMouseDown={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        className="quick-search"
        role="dialog"
        aria-label="Search notes"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="quick-search-input-wrap">
          <Search {...ICON} className="quick-search-icon" />
          <input
            ref={inputRef}
            type="search"
            className="quick-search-input"
            placeholder="Search notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="quick-search-esc">esc</kbd>
        </div>
        <div className="quick-search-list" ref={listRef} role="listbox">
          {filtered.length === 0 ? (
            <div className="quick-search-empty">No matching notes</div>
          ) : (
            filtered.map((n, i) => (
              <button
                key={n.id}
                type="button"
                role="option"
                aria-selected={i === index}
                className={`quick-search-item ${i === index ? 'active' : ''}`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => {
                  onSelect(n.id);
                  onClose();
                }}
              >
                <span className="quick-search-title">{n.title || 'Untitled'}</span>
                <span className="quick-search-meta">
                  {n.status ? <StatusBadge status={n.status} size="sm" /> : null}
                  {(n.tags || []).slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="quick-search-tag"
                      style={
                        colorsByTag[t]
                          ? { borderColor: colorsByTag[t], color: colorsByTag[t] }
                          : undefined
                      }
                    >
                      {t}
                    </span>
                  ))}
                </span>
              </button>
            ))
          )}
        </div>
        <div className="quick-search-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> Navigate
          </span>
          <span>
            <kbd>↵</kbd> Open
          </span>
        </div>
      </div>
    </>
  );
}
