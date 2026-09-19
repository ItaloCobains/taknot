import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Compartment, EditorState } from '@codemirror/state';
import { vim, getCM } from '@replit/codemirror-vim';
import {
  EditorView,
  keymap,
  lineNumbers,
  drawSelection,
  placeholder,
  Decoration,
  MatchDecorator,
  ViewPlugin,
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
import {
  detectLatex,
  filterLatexCommands,
} from './latexCommands.js';

const wikiMatcher = new MatchDecorator({
  regexp: /\[\[[^\]\n]+?\]\]/g,
  decoration: Decoration.mark({ class: 'cm-wiki-link' }),
});

const wikiLinkPlugin = ViewPlugin.fromClass(
  class {
    decorations;
    constructor(view) {
      this.decorations = wikiMatcher.createDeco(view);
    }
    update(update) {
      this.decorations = wikiMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations },
);

function detectWiki(body, caret) {
  const before = body.slice(0, caret);
  const open = before.lastIndexOf('[[');
  if (open < 0) return null;
  const afterOpen = before.slice(open + 2);
  if (afterOpen.includes(']]') || afterOpen.includes('\n')) return null;
  return { start: open, end: caret, query: afterOpen };
}

function formatVimMode(mode) {
  const m = String(mode || 'normal').toLowerCase();
  if (m.includes('insert')) return { key: 'insert', label: 'INSERT' };
  if (m.includes('replace')) return { key: 'replace', label: 'REPLACE' };
  if (m.includes('visual')) return { key: 'visual', label: 'VISUAL' };
  if (m.includes('command')) return { key: 'command', label: 'COMMAND' };
  return { key: 'normal', label: 'NORMAL' };
}

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
    '.cm-wiki-link': {
      color: '#5eead4',
      textDecoration: 'underline',
      textDecorationStyle: 'dashed',
      textUnderlineOffset: '3px',
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
  vimMode = false,
  noteTitles = [],
}) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const vimCompartmentRef = useRef(null);
  const slashMenuRef = useRef(null);
  const wikiMenuRef = useRef(null);
  const latexMenuRef = useRef(null);
  const [slash, setSlash] = useState(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [wiki, setWiki] = useState(null);
  const [wikiIndex, setWikiIndex] = useState(0);
  const [latex, setLatex] = useState(null);
  const [latexIndex, setLatexIndex] = useState(0);
  const [vimStatus, setVimStatus] = useState(null);

  const slashList = useMemo(
    () => (slash ? filterSlashCommands(slash.query) : []),
    [slash],
  );
  const wikiList = useMemo(() => {
    if (!wiki) return [];
    const q = wiki.query.trim().toLowerCase();
    const titles = [...new Set(noteTitles.filter(Boolean))];
    const filtered = q
      ? titles.filter((title) => title.toLowerCase().includes(q))
      : titles;
    return filtered.slice(0, 12);
  }, [wiki, noteTitles]);
  const latexList = useMemo(
    () => (latex ? filterLatexCommands(latex.query) : []),
    [latex],
  );

  const onChangeRef = useRef(onChange);
  const onScrollRef = useRef(onScrollRatio);
  const slashListRef = useRef(slashList);
  const slashIndexRef = useRef(slashIndex);
  const slashRef = useRef(slash);
  const wikiListRef = useRef(wikiList);
  const wikiIndexRef = useRef(wikiIndex);
  const wikiRef = useRef(wiki);
  const latexListRef = useRef(latexList);
  const latexIndexRef = useRef(latexIndex);
  const latexRef = useRef(latex);
  const noteTitlesRef = useRef(noteTitles);
  onChangeRef.current = onChange;
  onScrollRef.current = onScrollRatio;
  slashListRef.current = slashList;
  slashIndexRef.current = slashIndex;
  slashRef.current = slash;
  wikiListRef.current = wikiList;
  wikiIndexRef.current = wikiIndex;
  wikiRef.current = wiki;
  latexListRef.current = latexList;
  latexIndexRef.current = latexIndex;
  latexRef.current = latex;
  noteTitlesRef.current = noteTitles;

  useEffect(() => {
    if (!slash || !slashMenuRef.current) return;
    const active = slashMenuRef.current.querySelector('.slash-item.active');
    active?.scrollIntoView({ block: 'nearest' });
  }, [slashIndex, slash, slashList.length]);

  useEffect(() => {
    if (!wiki || !wikiMenuRef.current) return;
    const active = wikiMenuRef.current.querySelector('.wiki-item.active');
    active?.scrollIntoView({ block: 'nearest' });
  }, [wikiIndex, wiki, wikiList.length]);

  useEffect(() => {
    if (!latex || !latexMenuRef.current) return;
    const active = latexMenuRef.current.querySelector('.latex-item.active');
    active?.scrollIntoView({ block: 'nearest' });
  }, [latexIndex, latex, latexList.length]);

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
    setWiki(null);
    setLatex(null);
    view.focus();
  }

  function applyWikiTitle(title) {
    const view = viewRef.current;
    const w = wikiRef.current;
    if (!view || !w || !title) return;
    const insert = `[[${title}]]`;
    view.dispatch({
      changes: { from: w.start, to: w.end, insert },
      selection: { anchor: w.start + insert.length },
    });
    setWiki(null);
    setLatex(null);
    view.focus();
  }

  function applyLatexCommand(cmd) {
    const view = viewRef.current;
    const hit = latexRef.current;
    if (!view || !hit || !cmd) return;
    const insert = cmd.insert;
    const cursor = hit.start + (cmd.cursor ?? insert.length);
    view.dispatch({
      changes: { from: hit.start, to: hit.end, insert },
      selection: { anchor: cursor },
    });
    setLatex(null);
    view.focus();
  }

  useEffect(() => {
    if (!hostRef.current) return undefined;

    const placeMenu = (view, pos, count) => {
      const coords = view.coordsAtPos(pos);
      const menuW = 260;
      const menuH = Math.min(280, Math.max(48, count * 36 + 12));
      const gap = 6;
      if (!coords) return { top: 8, left: 16, maxHeight: menuH };
      const spaceBelow = window.innerHeight - coords.bottom - 8;
      const openAbove = spaceBelow < menuH && coords.top > menuH + 8;
      const top = openAbove
        ? Math.max(8, coords.top - menuH - gap)
        : Math.min(coords.bottom + gap, window.innerHeight - menuH - 8);
      const left = Math.max(
        8,
        Math.min(coords.left, window.innerWidth - menuW - 8),
      );
      return { top, left, maxHeight: menuH };
    };

    const updateMenus = (view) => {
      const caret = view.state.selection.main.head;
      const body = view.state.doc.toString();

      const wikiHit = detectWiki(body, caret);
      if (wikiHit) {
        setSlash(null);
        setLatex(null);
        const titles = noteTitlesRef.current || [];
        const q = wikiHit.query.trim().toLowerCase();
        const matches = (
          q
            ? titles.filter((title) => title.toLowerCase().includes(q))
            : titles
        ).slice(0, 12);
        const place = placeMenu(view, wikiHit.start, Math.max(matches.length, 1));
        setWiki({ ...wikiHit, ...place });
        setWikiIndex(0);
        return;
      }
      setWiki(null);

      const latexHit = detectLatex(body, caret);
      if (latexHit) {
        setSlash(null);
        const matches = filterLatexCommands(latexHit.query);
        const place = placeMenu(
          view,
          latexHit.start,
          Math.max(matches.length, 1),
        );
        setLatex({ ...latexHit, ...place });
        setLatexIndex(0);
        return;
      }
      setLatex(null);

      const hit = detectSlash(body, caret);
      if (!hit) {
        setSlash(null);
        return;
      }
      const matches = filterSlashCommands(hit.query);
      const place = placeMenu(view, hit.start, Math.max(matches.length, 1));
      setSlash({ ...hit, ...place });
      setSlashIndex(0);
    };

    const applyFromKey = () => {
      const w = wikiRef.current;
      const wlist = wikiListRef.current;
      if (w && wlist.length) {
        applyWikiTitle(wlist[wikiIndexRef.current] || wlist[0]);
        return true;
      }
      const lhit = latexRef.current;
      const llist = latexListRef.current;
      if (lhit && llist.length) {
        applyLatexCommand(llist[latexIndexRef.current] || llist[0]);
        return true;
      }
      const list = slashListRef.current;
      const s = slashRef.current;
      if (!s || !list.length) return false;
      applySlashCommand(list[slashIndexRef.current] || list[0]);
      return true;
    };

    const vimCompartment = new Compartment();
    vimCompartmentRef.current = vimCompartment;

    const state = EditorState.create({
      doc: value || '',
      extensions: [
        lineNumbers(),
        drawSelection(),
        history(),
        markdown(),
        wikiLinkPlugin,
        vimCompartment.of(vimMode ? vim() : []),
        syntaxHighlighting(coolHighlight),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        editorTheme,
        placeholder("Type '/' for commands, [[ notes, or \\ in math…"),
        keymap.of([
          {
            key: 'ArrowDown',
            run: () => {
              if (wikiRef.current && wikiListRef.current.length) {
                setWikiIndex((i) => (i + 1) % wikiListRef.current.length);
                return true;
              }
              if (latexRef.current && latexListRef.current.length) {
                setLatexIndex((i) => (i + 1) % latexListRef.current.length);
                return true;
              }
              if (!slashRef.current || !slashListRef.current.length) return false;
              setSlashIndex((i) => (i + 1) % slashListRef.current.length);
              return true;
            },
          },
          {
            key: 'ArrowUp',
            run: () => {
              if (wikiRef.current && wikiListRef.current.length) {
                setWikiIndex(
                  (i) =>
                    (i - 1 + wikiListRef.current.length) %
                    wikiListRef.current.length,
                );
                return true;
              }
              if (latexRef.current && latexListRef.current.length) {
                setLatexIndex(
                  (i) =>
                    (i - 1 + latexListRef.current.length) %
                    latexListRef.current.length,
                );
                return true;
              }
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
              if (wikiRef.current) {
                setWiki(null);
                return true;
              }
              if (latexRef.current) {
                setLatex(null);
                return true;
              }
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
            updateMenus(update.view);
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

    const syncVimStatus = () => {
      if (!vimMode) {
        setVimStatus(null);
        return;
      }
      const cm = getCM(view);
      const mode = cm?.state?.vim?.mode || 'normal';
      setVimStatus(formatVimMode(mode));
    };
    syncVimStatus();
    const cm = getCM(view);
    const onMode = (e) => setVimStatus(formatVimMode(e?.mode || 'normal'));
    if (cm) cm.on('vim-mode-change', onMode);

    return () => {
      if (cm) cm.off('vim-mode-change', onMode);
      view.destroy();
      viewRef.current = null;
      vimCompartmentRef.current = null;
      setVimStatus(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  useEffect(() => {
    const view = viewRef.current;
    const compartment = vimCompartmentRef.current;
    if (!view || !compartment) return undefined;
    view.dispatch({
      effects: compartment.reconfigure(vimMode ? vim() : []),
    });
    if (!vimMode) {
      setVimStatus(null);
      return undefined;
    }
    const cm = getCM(view);
    const onMode = (e) => setVimStatus(formatVimMode(e?.mode || 'normal'));
    setVimStatus(formatVimMode(cm?.state?.vim?.mode || 'normal'));
    if (cm) cm.on('vim-mode-change', onMode);
    return () => {
      if (cm) cm.off('vim-mode-change', onMode);
    };
  }, [vimMode]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if ((value || '') === current) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value || '' },
    });
  }, [value]);

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
      {vimMode && vimStatus && (
        <div className={`vim-status vim-${vimStatus.key}`}>
          <span className="vim-status-pill">{vimStatus.label}</span>
          <span className="vim-status-hint">Esc normal · i insert · v visual</span>
        </div>
      )}
      {wiki &&
        createPortal(
          <div
            className="slash-menu wiki-menu"
            ref={wikiMenuRef}
            style={{
              top: wiki.top,
              left: wiki.left,
              maxHeight: wiki.maxHeight || 280,
            }}
            role="listbox"
          >
            {wikiList.length === 0 ? (
              <div className="slash-item muted">No matching notes</div>
            ) : (
              wikiList.map((title, i) => (
                <button
                  key={title}
                  type="button"
                  role="option"
                  aria-selected={i === wikiIndex}
                  className={`slash-item wiki-item ${i === wikiIndex ? 'active' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyWikiTitle(title);
                  }}
                >
                  <span className="slash-label">{title}</span>
                </button>
              ))
            )}
          </div>,
          document.body,
        )}
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
