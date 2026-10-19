import {normalizeId} from './core.js';
/**
 * Optional expandedKeys overrides the initial expansion defaults.
 * An empty Set explicitly means that the user collapsed every branch.
 */
export function buildHierarchy(leaves, selectedIds = new Set(), expandedKeys = null) {
  const roots = [], byPath = new Map(), leafByKey = new Map();
  for (const leaf of leaves) {
    let siblings = roots, parts = [];
    const levels = leaf.levels?.length ? leaf.levels : (leaf.path ? leaf.path.split(' › ') : []);
    for (const level of levels) {
      parts.push(level);
      const key = 'p:' + JSON.stringify(parts);
      let node = byPath.get(key);
      if (!node) {
        node = {key, title:level, expanded:expandedKeys === null ? parts.length === 1 : expandedKeys.has(key), children:[], folder:true};
        byPath.set(key,node);
        siblings.push(node);
      }
      siblings = node.children;
    }
    const key = 'l:' + leaf.id;
    if (leafByKey.has(key)) throw new Error('Doppelte Leaf-ID: '+leaf.id);
    const node = {key,title:leaf.id,selected:selectedIds.has(leaf.id),data:{leafId:leaf.id},icon:false};
    siblings.push(node);
    leafByKey.set(key,node);
  }
  return {roots,leafByKey};
}
export function selectedLeafIds(tree) {
  const ids = new Set();
  for (const node of tree) {
    if (node.key?.startsWith('l:') && node.selected) ids.add(node.key.slice(2));
  }
  return ids;
}

/** Preserve the user's expanded/collapsed branches across Set refreshes. */
export function getExpandedKeys(tree) {
  if (!tree) return null;
  const keys = new Set();
  for (const node of tree) {
    if (node.key?.startsWith('p:') && node.expanded) keys.add(node.key);
  }
  return keys;
}
