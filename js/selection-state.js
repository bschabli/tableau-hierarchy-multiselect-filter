/** Pure draft state helpers, independent of Tableau and the tree widget. */
export function sameIds(a, b) {
  return a.size === b.size && [...a].every(id => b.has(id));
}

/** The visible checkbox state reflects the real Tableau Set membership. */
export function effectiveSelection(_mode, setIds) {
  return new Set(setIds);
}

/**
 * ALLE  = all values IN the Set, all checked.
 * KEINE = no values IN the Set, none checked.
 * AUSWAHL = exactly the individually checked values IN the Set.
 * A zero-item custom selection is not silently converted to ALLE.
 */
export function resolveApplyState(mode, checkedIds, leaves) {
  let setIds;
  if (mode === 'ALLE') {
    setIds = new Set(leaves.map(leaf => leaf.id));
  } else if (mode === 'KEINE') {
    setIds = new Set();
  } else if (mode === 'AUSWAHL') {
    setIds = new Set(checkedIds);
  } else {
    throw new Error('Unbekannter Filtermodus: ' + mode);
  }
  return {mode, setIds, checkedIds: new Set(setIds)};
}

export function hasPendingChanges(draftMode, draftIds, appliedMode, appliedSetIds) {
  return draftMode !== appliedMode || !sameIds(draftIds, appliedSetIds);
}
