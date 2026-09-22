/** Depth-first tree order for sidebar nesting. */
export function flattenNotebooks(notebooks) {
  const byParent = new Map();
  for (const nb of notebooks) {
    const p = nb.parentId || null;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(nb);
  }
  const out = [];
  function walk(parentId, depth) {
    for (const nb of byParent.get(parentId) || []) {
      out.push({ ...nb, depth });
      walk(nb.id, depth + 1);
    }
  }
  walk(null, 0);
  for (const nb of notebooks) {
    if (!out.some((x) => x.id === nb.id)) out.push({ ...nb, depth: 0 });
  }
  return out;
}

/** All descendant notebook ids under rootId (not including root). */
export function descendantIds(notebooks, rootId) {
  const kids = new Map();
  for (const nb of notebooks) {
    const p = nb.parentId || null;
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p).push(nb.id);
  }
  const out = new Set();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop();
    for (const child of kids.get(id) || []) {
      if (!out.has(child)) {
        out.add(child);
        stack.push(child);
      }
    }
  }
  return out;
}
