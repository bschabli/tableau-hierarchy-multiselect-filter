/**
 * Summarize a selection by collapsing fully selected hierarchy branches.
 * Partial selections retain their path to avoid ambiguous duplicate labels.
 * All values and none are intentionally concise: "Alle" / "Keine".
 */
export function summarizeFilterSelection(leaves, selectedIds, maxLength = 240) {
  const total = leaves.length;
  if (!total || selectedIds.size === 0) return 'Keine';
  if (leaves.every(leaf => selectedIds.has(leaf.id))) return 'Alle';

  const root = {children: new Map(), count: 0, selectedCount: 0, selectedHere: 0};
  for (const leaf of leaves) {
    const isSelected = selectedIds.has(leaf.id);
    root.count++;
    if (isSelected) root.selectedCount++;
    const levels = (leaf.levels ?? []).filter(Boolean);
    // A missing label must never leak a technical ID into the displayed summary.
    const path = levels.length ? levels : ['Ohne Bezeichnung'];
    let parent = root;
    for (const title of path) {
      if (!parent.children.has(title)) {
        parent.children.set(title, {
          title, children: new Map(), count: 0,
          selectedCount: 0, selectedHere: 0
        });
      }
      parent = parent.children.get(title);
      parent.count++;
      if (isSelected) parent.selectedCount++;
    }
    if (isSelected) parent.selectedHere++;
  }

  const labels = [];
  function collect(node, prefix) {
    if (node.selectedCount === 0) return;
    const path = node.title ? [...prefix, node.title] : prefix;
    if (node.title && node.selectedCount === node.count) {
      labels.push(path.join(' › '));
      return;
    }
    if (node.selectedHere) labels.push(path.join(' › '));
    for (const child of node.children.values()) collect(child, path);
  }
  for (const node of root.children.values()) collect(node, []);

  const limit = Math.max(24, Number(maxLength) || 240);
  const parts = [];
  for (let i = 0; i < labels.length; i++) {
    const candidate = [...parts, labels[i]].join(', ');
    const remaining = labels.length - i - 1;
    const suffix = remaining ? ' (+' + remaining + ' weitere)' : '';
    if (candidate.length + suffix.length > limit) {
      if (parts.length === 0) {
        const tail = labels.length > 1 ? ' (+' + (labels.length - 1) + ' weitere)' : '';
        return labels[0].slice(0, Math.max(1, limit - tail.length - 1)) + '…' + tail;
      }
      const hidden = labels.length - i;
      return parts.join(', ') + ' (+' + hidden + ' weitere)';
    }
    parts.push(labels[i]);
  }
  return parts.join(', ');
}
