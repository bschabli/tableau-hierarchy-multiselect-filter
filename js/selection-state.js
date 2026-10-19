/** Pure draft state helpers. Checkbox state is deliberately separate from Set membership. */
export function sameIds(a, b) {
  return a.size === b.size && [...a].every(id => b.has(id));
}

/**
 * ALLE: all values can pass the filter, but no checkbox needs to be checked.
 * AUSWAHL: checked nodes correspond to the current Tableau Set.
 * KEINE: temporary empty checkbox state; Apply normalizes to ALLE.
 */
export function effectiveSelection(mode, setIds) {
  if (mode === 'ALLE' || mode === 'KEINE') return new Set();
  return new Set(setIds);
}

/** What Tableau should contain after an explicit Apply operation. */
export function resolveApplyState(mode, checkedIds, leaves) {
  const allIds = new Set(leaves.map(leaf => leaf.id));
  if (mode !== 'AUSWAHL' || checkedIds.size === 0) {
    return {mode: 'ALLE', setIds: allIds, checkedIds: new Set()};
  }
  return {
    mode: 'AUSWAHL',
    setIds: new Set(checkedIds),
    checkedIds: new Set(checkedIds)
  };
}

export function hasPendingChanges(draftMode, draftIds, appliedMode, appliedSetIds, leaves) {
  const desired = resolveApplyState(draftMode, draftIds, leaves);
  return draftMode !== appliedMode
    || !sameIds(draftIds, effectiveSelection(appliedMode, appliedSetIds))
    || !sameIds(desired.setIds, appliedSetIds);
}
