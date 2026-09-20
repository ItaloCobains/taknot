import { useCallback, useEffect, useRef, useState } from 'react';
import { Network, RefreshCw, X } from 'lucide-react';
import { findStatus } from './statuses.js';

const ICON = { size: 15, strokeWidth: 1.75 };

function hashPos(id, i, n) {
  let h = 0;
  for (let c = 0; c < id.length; c++) h = (h * 31 + id.charCodeAt(c)) | 0;
  const ang = ((h >>> 0) % 360) * (Math.PI / 180) + (i / Math.max(n, 1)) * Math.PI * 2;
  const r = 80 + (h % 120);
  return { x: Math.cos(ang) * r, y: Math.sin(ang) * r };
}

/**
 * Force-directed wiki-link graph.
 * @param {{ onOpenNote: (id: string) => void, onClose: () => void, selectedId?: string | null }} props
 */
export default function GraphView({ onOpenNote, onClose, selectedId = null }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const simRef = useRef({ nodes: [], edges: [], running: true });
  const camRef = useRef({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef(null);
  const panRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });
  const [hoverId, setHoverId] = useState(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await window.taknot.getWikiGraph();
      const nodes = (data.nodes || []).map((n, i, arr) => {
        const p = hashPos(n.id, i, arr.length);
        return {
          ...n,
          x: p.x,
          y: p.y,
          vx: 0,
          vy: 0,
        };
      });
      const idSet = new Set(nodes.map((n) => n.id));
      const edges = (data.edges || []).filter(
        (e) => idSet.has(e.source) && idSet.has(e.target),
      );
      simRef.current = { nodes, edges, running: true };
      setStats({ nodes: nodes.length, edges: edges.length });
    } catch (err) {
      console.error(err);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const q = query.trim().toLowerCase();

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;

    const ctx = canvas.getContext('2d');
    let raf = 0;
    let alive = true;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { clientWidth: w, clientHeight: h } = wrap;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const byId = () => {
      const m = new Map();
      for (const n of simRef.current.nodes) m.set(n.id, n);
      return m;
    };

    const step = () => {
      const { nodes, edges, running } = simRef.current;
      if (running && nodes.length) {
        const N = nodes.length;
        // repulsion
        for (let i = 0; i < N; i++) {
          for (let j = i + 1; j < N; j++) {
            const a = nodes[i];
            const b = nodes[j];
            let dx = a.x - b.x;
            let dy = a.y - b.y;
            let dist2 = dx * dx + dy * dy || 0.01;
            const dist = Math.sqrt(dist2);
            const force = 1200 / dist2;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            a.vx += fx;
            a.vy += fy;
            b.vx -= fx;
            b.vy -= fy;
          }
        }
        // springs
        const map = byId();
        for (const e of edges) {
          const a = map.get(e.source);
          const b = map.get(e.target);
          if (!a || !b) continue;
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const ideal = 110;
          const force = (dist - ideal) * 0.02;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
        // center gravity + integrate
        for (const n of nodes) {
          if (dragRef.current?.id === n.id) {
            n.vx = 0;
            n.vy = 0;
            continue;
          }
          n.vx += -n.x * 0.005;
          n.vy += -n.y * 0.005;
          n.vx *= 0.85;
          n.vy *= 0.85;
          n.x += n.vx;
          n.y += n.vy;
        }
      }

      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const cam = camRef.current;
      ctx.clearRect(0, 0, w, h);

      // subtle grid
      ctx.save();
      ctx.translate(w / 2 + cam.x, h / 2 + cam.y);
      ctx.scale(cam.scale, cam.scale);

      const map = byId();
      ctx.lineWidth = 1.25 / cam.scale;
      for (const e of simRef.current.edges) {
        const a = map.get(e.source);
        const b = map.get(e.target);
        if (!a || !b) continue;
        const hi =
          hoverId && (e.source === hoverId || e.target === hoverId);
        ctx.strokeStyle = hi
          ? 'rgba(122, 162, 255, 0.85)'
          : 'rgba(255, 255, 255, 0.14)';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      for (const n of simRef.current.nodes) {
        const status = findStatus(n.status);
        const match = !q || String(n.title || '').toLowerCase().includes(q);
        const isSel = n.id === selectedId;
        const isHover = n.id === hoverId;
        const r = isSel || isHover ? 9 : 7;
        ctx.globalAlpha = match ? 1 : 0.18;
        ctx.beginPath();
        ctx.fillStyle = status.color || '#7aa2ff';
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();
        if (isSel || isHover) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2 / cam.scale;
          ctx.stroke();
        }
        if (match && (isHover || isSel || cam.scale > 0.85 || q)) {
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.font = `${12 / cam.scale}px ui-sans-serif, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(n.title || 'Untitled', n.x, n.y + 18 / cam.scale);
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      if (alive) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [hoverId, selectedId, q, loading]);

  const toWorld = (clientX, clientY) => {
    const wrap = wrapRef.current;
    const cam = camRef.current;
    const rect = wrap.getBoundingClientRect();
    const x = (clientX - rect.left - wrap.clientWidth / 2 - cam.x) / cam.scale;
    const y = (clientY - rect.top - wrap.clientHeight / 2 - cam.y) / cam.scale;
    return { x, y };
  };

  const hitTest = (clientX, clientY) => {
    const { x, y } = toWorld(clientX, clientY);
    const cam = camRef.current;
    const thresh = 12 / cam.scale;
    let best = null;
    let bestD = thresh * thresh;
    for (const n of simRef.current.nodes) {
      const dx = n.x - x;
      const dy = n.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  };

  return (
    <section className="graph-view">
      <header className="pane-header graph-header">
        <div className="graph-header-left">
          <Network {...ICON} />
          <strong>Graph</strong>
          <span className="graph-stats">
            {stats.nodes} notes · {stats.edges} links
          </span>
        </div>
        <div className="graph-header-right">
          <input
            type="search"
            className="graph-filter"
            placeholder="Filter nodes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="icon-btn"
            title="Reload graph"
            onClick={() => void load()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <RefreshCw {...ICON} />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Close graph"
            onClick={onClose}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <X {...ICON} />
          </button>
        </div>
      </header>
      <div
        className="graph-canvas-wrap"
        ref={wrapRef}
        onWheel={(e) => {
          e.preventDefault();
          const cam = camRef.current;
          const factor = e.deltaY > 0 ? 0.9 : 1.1;
          cam.scale = Math.min(3, Math.max(0.25, cam.scale * factor));
        }}
        onMouseDown={(e) => {
          if (e.button === 1 || e.button === 2 || e.altKey) {
            panRef.current = {
              x: e.clientX,
              y: e.clientY,
              camX: camRef.current.x,
              camY: camRef.current.y,
            };
            return;
          }
          const hit = hitTest(e.clientX, e.clientY);
          if (hit) {
            dragRef.current = {
              id: hit.id,
              moved: false,
              ox: e.clientX,
              oy: e.clientY,
            };
            simRef.current.running = true;
          } else {
            panRef.current = {
              x: e.clientX,
              y: e.clientY,
              camX: camRef.current.x,
              camY: camRef.current.y,
            };
          }
        }}
        onMouseMove={(e) => {
          if (dragRef.current) {
            const n = simRef.current.nodes.find((x) => x.id === dragRef.current.id);
            if (n) {
              const w = toWorld(e.clientX, e.clientY);
              n.x = w.x;
              n.y = w.y;
              n.vx = 0;
              n.vy = 0;
              if (
                Math.abs(e.clientX - dragRef.current.ox) > 4 ||
                Math.abs(e.clientY - dragRef.current.oy) > 4
              ) {
                dragRef.current.moved = true;
              }
            }
            return;
          }
          if (panRef.current) {
            camRef.current.x =
              panRef.current.camX + (e.clientX - panRef.current.x);
            camRef.current.y =
              panRef.current.camY + (e.clientY - panRef.current.y);
            return;
          }
          const hit = hitTest(e.clientX, e.clientY);
          setHoverId(hit?.id || null);
        }}
        onMouseUp={(e) => {
          if (dragRef.current && !dragRef.current.moved) {
            onOpenNote?.(dragRef.current.id);
          }
          dragRef.current = null;
          panRef.current = null;
        }}
        onMouseLeave={() => {
          dragRef.current = null;
          panRef.current = null;
          setHoverId(null);
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {loading && <div className="graph-overlay">Loading graph…</div>}
        {error && <div className="graph-overlay error">{error}</div>}
        {!loading && !error && stats.nodes === 0 && (
          <div className="graph-overlay">No notes yet</div>
        )}
        <canvas ref={canvasRef} className="graph-canvas" />
      </div>
      <footer className="graph-footer">
        Drag nodes · scroll zoom · click opens note · colors = status
      </footer>
    </section>
  );
}
