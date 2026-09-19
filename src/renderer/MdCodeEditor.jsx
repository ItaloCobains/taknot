import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EditorState } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  drawSelection,
  placeholder,
} from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  HighlightStyle,
} from '@codemirror/language';
import { tags } from '@lezer/highlight';
import {
  detectSlash,
  filterSlashCommands,
} from './slashCommands.js';

const coolHighlight = HighlightStyle.define([
  { tag: tags.heading1, color: '#ff7eb6', fontWeight: '700', fontSize: '1.75em' },
  { tag: tags.heading2, color: '#ff7eb6', fontWeight: '700', fontSize: '1.4em' },
  { tag: tags.heading3, color: '#ff9ecd', fontWeight: '700', fontSize: '1.2em' },
  { tag: tags.heading4, color: '#ff9ecd', fontWeight: '700', fontSize: '1.1em' },
  { tag: tags.heading, color: '#ff7eb6', fontWeight: '700', fontSize: '1.2em' },
  { tag: tags.strong, color: '#c4b5fd', fontWeight: '700' },
  { tag: tags.emphasis, color: '#7dd3fc', fontStyle: 'italic' },
  { tag: tags.strikethrough, color: '#94a3b8', textDecoration: 'line-through' },
  { tag: tags.link, color: '#38bdf8' },
  { tag: tags.url, color: '#38bdf8' },
  { tag: tags.monospace, color: '#5eead4' },
  { tag: tags.processingInstruction, color: '#818cf8' },
  { tag: tags.meta, color: '#64748b' },
  { tag: tags.quote, color: '#94a3b8', fontStyle: 'italic' },
  { tag: tags.list, color: '#818cf8' },
  { tag: tags.contentSeparator, color: '#475569' },
]);

const editorTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      fontSize: '14px',
      backgroundColor: 'transparent',
    },
    '.cm-scroller': {
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      lineHeight: '1.6',
      overflow: 'auto',
    },
    '.cm-content': {
      caretColor: '#e8f0ff',
      padding: '16px 8px',
      minHeight: '100%',
      color: '#d7deea',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      border: 'none',
      color: '#4b5563',
      minWidth: '32px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: '#9ca3af',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(90, 140, 255, 0.06)',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: 'rgba(90, 140, 255, 0.4) !important',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#e8f0ff',
    },
  },
  { dark: true },
);

export default function MdCodeEditor({
  noteId,
  value,
  onChange,
  onScrollRatio,
  apiRef,
}) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const slashMenuRef = useRef(null);
  const [slash, setSlash] = useState(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const slashList = useMemo(
    () => (slash ? filterSlashCommands(slash.query) : []),
    [slash],
  );

  const onChangeRef = useRef(onChange);
  const onScrollRef = useRef(onScrollRatio);
  const slashListRef = useRef(slashList);
  const slashIndexRef = useRef(slashIndex);
  const slashRef = useRef(slash);
  onChangeRef.current = onChange;
  onScrollRef.current = onScrollRatio;
  slashListRef.current = slashList;
  slashIndexRef.current = slashIndex;
  slashRef.current = slash;

  useEffect(() => {
    if (!slash || !slashMenuRef.current) return;
    const active = slashMenuRef.current.querySelector('.slash-item.active');
    active?.scrollIntoView({ block: 'nearest' });
  }, [slashIndex, slash, slashList.length]);

  function applySlashCommand(cmd) {
    const view = viewRef.current;
    const s = slashRef.current;
    if (!view || !s || !cmd) return;
    const insert = cmd.insert;
    const cursor = s.start + (cmd.cursor ?? insert.length);
    view.dispatch({
      changes: { from: s.start, to: s.end, insert },
      selection: { anchor: cursor },
    });
    setSlash(null);
    view.focus();
  }

  useEffect(() => {
    if (!hostRef.current) return undefined;

    const updateSlash = (view) => {
      const caret = view.state.selection.main.head;
      const body = view.state.doc.toString();
      const hit = detectSlash(body, caret);
      if (!hit) {
        setSlash(null);
        return;
      }
      const coords = view.coordsAtPos(hit.start);
      if (!coords) {
        setSlash({ ...hit, top: 8, left: 16 });
        setSlashIndex(0);
        return;
      }
      const matches = filterSlashCommands(hit.query);
      const menuW = 240;
      const menuH = Math.min(280, Math.max(48, matches.length * 36 + 12));
      const gap = 6;
      const spaceBelow = window.innerHeight - coords.bottom - 8;
      const openAbove = spaceBelow < menuH && coords.top > menuH + 8;
      const top = openAbove
        ? Math.max(8, coords.top - menuH - gap)
        : Math.min(coords.bottom + gap, window.innerHeight - menuH - 8);
      const left = Math.max(
        8,
        Math.min(coords.left, window.innerWidth - menuW - 8),
      );
      setSlash({ ...hit, top, left, maxHeight: menuH });
      setSlashIndex(0);
    };

    const applyFromKey = () => {
      const list = slashListRef.current;
      const s = slashRef.current;
      if (!s || !list.length) return false;
      applySlashCommand(list[slashIndexRef.current] || list[0]);
      return true;
    };

    const state = EditorState.create({
      doc: value || '',
      extensions: [
        lineNumbers(),
        drawSelection(),
        history(),
        markdown(),
        syntaxHighlighting(coolHighlight),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        editorTheme,
        placeholder("Type '/' for commands…"),
        keymap.of([
          {
            key: 'ArrowDown',
            run: () => {
              if (!slashRef.current || !slashListRef.current.length) return false;
              setSlashIndex((i) => (i + 1) % slashListRef.current.length);
              return true;
            },
          },
          {
            key: 'ArrowUp',
            run: () => {
              if (!slashRef.current || !slashListRef.current.length) return false;
              setSlashIndex(
                (i) =>
                  (i - 1 + slashListRef.current.length) %
                  slashListRef.current.length,
              );
              return true;
            },
          },
          { key: 'Enter', run: applyFromKey },
          { key: 'Tab', run: applyFromKey },
          {
            key: 'Escape',
            run: () => {
              if (!slashRef.current) return false;
              setSlash(null);
              return true;
            },
          },
          ...defaultKeymap,
          ...historyKeymap,
          indentWithTab,
        ]),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
          if (update.docChanged || update.selectionSet) {
            updateSlash(update.view);
          }
        }),
        EditorView.domEventHandlers({
          scroll: (_event, view) => {
            const scroller = view.scrollDOM;
            const max = scroller.scrollHeight - scroller.clientHeight;
            if (max > 0) onScrollRef.current?.(scroller.scrollTop / max);
            return false;
          },
        }),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Remount when note changes so doc/history reset cleanly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if ((value || '') === current) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value || '' },
    });
  }, [value]);

  // Expose scroll setter for preview → editor sync
  useEffect(() => {
    const view = viewRef.current;
    if (!apiRef) return undefined;
    apiRef.current = {
      setScrollRatio: (ratio) => {
        if (!view) return;
        const scroller = view.scrollDOM;
        const max = scroller.scrollHeight - scroller.clientHeight;
        if (max > 0) scroller.scrollTop = ratio * max;
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [noteId, apiRef]);

  return (
    <div className="md-code-wrap">
      <div className="md-code-editor" ref={hostRef} />
      {slash &&
        slashList.length > 0 &&
        createPortal(
          <div
            className="slash-menu"
            ref={slashMenuRef}
            style={{
              top: slash.top,
              left: slash.left,
              maxHeight: slash.maxHeight || 280,
            }}
            role="listbox"
          >
            {slashList.map((cmd, i) => (
              <button
                key={cmd.id}
                type="button"
                role="option"
                aria-selected={i === slashIndex}
                className={`slash-item ${i === slashIndex ? 'active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  applySlashCommand(cmd);
                }}
              >
                <span className="slash-label">{cmd.label}</span>
                <span className="slash-hint">{cmd.hint}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
