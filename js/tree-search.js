/**
 * Find branches to expand so every matched label becomes visible.
 * Searches displayed titles only, never the technical leaf keys.
 */
/** Wunderbaum uses 'hide' to show only matches and 'mark' to just highlight. */
export function searchDisplayMode(showOnlyMatches) {
  return showOnlyMatches ? 'hide' : 'mark';
}

export function findSearchBranches(nodes, query) {
  const needle = String(query ?? '').trim().toLocaleLowerCase('de-DE');
  const expandKeys = new Set();
  let count = 0;
  if (!needle) return {expandKeys, count};

  const ancestors = [];
  const visit = node => {
    const isBranch = Boolean(node.children?.length);
    if (String(node.title ?? '').toLocaleLowerCase('de-DE').includes(needle)) {
      count++;
      for (const key of ancestors) expandKeys.add(key);
      if (isBranch) expandKeys.add(node.key);
    }
    if (isBranch) {
      ancestors.push(node.key);
      for (const child of node.children) visit(child);
      ancestors.pop();
    }
  };
  for (const node of nodes ?? []) visit(node);
  return {expandKeys, count};
}
