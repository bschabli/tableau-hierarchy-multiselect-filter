/**
 * A Tableau Leaf ID is a technical key, not an extra display level.
 * Render exactly the configured hierarchy levels.
 */
export function buildHierarchy(leaves, selectedIds = new Set(), expandedKeys = null) {
  const roots = [];
  const groups = new Map();
  const leafByKey = new Map();

  for (const leaf of leaves) {
    // Tableau can return sparsely populated / ragged hierarchies.
    const levels = Array.isArray(leaf.levels) ? leaf.levels.filter(Boolean)
      : (leaf.path ? leaf.path.split(' › ').filter(Boolean) : []);
    if (!levels.length) {
      throw new Error('Hierarchiestufen fehlen für Leaf-ID ' + leaf.id);
    }

    let children = roots;
    const prefix = [];
    // Only ancestor levels are grouped. The last populated level is the
    // visible selectable leaf, with its unique technical key.
    for (const label of levels.slice(0, -1)) {
      prefix.push(label);
      const key = 'p:' + JSON.stringify(prefix);
      let parent = groups.get(key);
      if (!parent) {
        parent = {
          key, title: label, folder: true,
          // Fully collapsed on the first load. Explicit saved keys
          // are only used for an in-session tree refresh.
          expanded: expandedKeys?.has(key) ?? false,
          children: []
        };
        groups.set(key, parent);
        children.push(parent);
      }
      children = parent.children;
    }
    const key = 'l:' + leaf.id;
    if (leafByKey.has(key)) throw new Error('Doppelte Leaf-ID: ' + leaf.id);
    const node = {
      key,
      title: levels[levels.length - 1],
      selected: selectedIds.has(leaf.id),
      data: {leafId: leaf.id},
      icon: false
    };
    children.push(node);
    leafByKey.set(key, node);
  }
  return {roots, leafByKey};
}

export function selectedLeafIds(tree) {
  const ids = new Set();
  for (const node of tree) {
    if (node.key?.startsWith('l:') && node.selected) {
      ids.add(node.key.slice(2));
    }
  }
  return ids;
}

/** Preserve expansion states across refreshes, without storing them in Tableau. */
export function getExpandedKeys(tree) {
  if (!tree) return null;
  const keys = new Set();
  for (const node of tree) {
    if (node.key?.startsWith('p:') && node.expanded) keys.add(node.key);
  }
  return keys;
}
