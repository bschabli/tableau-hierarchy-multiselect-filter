/** Pure draft-state helpers, independent of the Tableau Extensions API. */
export function sameIds(a, b) {
  return a.size === b.size && [...a].every(id => b.has(id));
}

export function effectiveSelection(mode, setIds, leaves) {
  if (mode === 'ALLE') return new Set(leaves.map(leaf => leaf.id));
  if (mode === 'KEINE') return new Set();
  return new Set(setIds);
}

export function hasPendingChanges(draftMode, draftIds, appliedMode, appliedSetIds, leaves) {
  return draftMode !== appliedMode ||
    !sameIds(draftIds, effectiveSelection(appliedMode, appliedSetIds, leaves));
}
