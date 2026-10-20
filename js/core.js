/** Tableau represents special DataValue.value fields using percent sentinels. */
export function normalizeId(v) { return v == null ? '' : String(v).trim(); }

export function isMissingTableauValue(cell) {
  if (!cell || cell.value == null) return true;
  if (Object.prototype.hasOwnProperty.call(cell, 'nativeValue') &&
      cell.nativeValue === null) return true;
  return /^%(?:null|no-access)%$/i.test(normalizeId(cell.value));
}

/**
 * Use the human-readable label unless the raw value is NULL.
 * This prevents formatted "(Null)" or "Null" from inventing hierarchy nodes.
 * A literal, genuinely stored string "Null" is not dropped.
 */
export function displayHierarchyLevel(cell) {
  if (isMissingTableauValue(cell)) return '';
  const formatted = normalizeId(cell.formattedValue);
  return formatted && !/^%(?:null|no-access)%$/i.test(formatted)
    ? formatted : normalizeId(cell.value);
}

export function membership(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
  const v = String(value ?? '').trim().toUpperCase();
  if (['IN', 'TRUE', 'WAHR', '1', 'IM SET'].includes(v)) return true;
  if (['OUT', 'FALSE', 'FALSCH', '0', 'AUSSERHALB DES SETS', 'NICHT IM SET'].includes(v)) return false;
  return null;
}

export function rowToLeaf(row, encodingMap, tupleId) {
  const field = encodingMap.leaf?.[0]?.name;
  if (!field) throw new Error('Leaf ID fehlt.');
  const idCell = row[field];
  const id = isMissingTableauValue(idCell) ? '' : normalizeId(idCell.value);
  if (!id) throw new Error('Leere Leaf-ID in Zeile ' + tupleId);

  // Skips actual nulls, nativeValue === null and Tableau's "%null%" sentinel.
  // Any final populated level therefore becomes the visible terminal node.
  const levels = (encodingMap.level ?? [])
    .map(f => displayHierarchyLevel(row[f.name]))
    .filter(Boolean);

  const raw = encodingMap.membership?.[0] ? row[encodingMap.membership[0].name] : null;
  let inSet = raw ? membership(raw.value) : null;
  if (inSet === null && raw) inSet = membership(raw.formattedValue);
  return {id, levels, path: levels.join(' › '), tupleId, inSet};
}

export function readLeafSelection(leaves) {
  const selected = new Set();
  for (const leaf of leaves) {
    if (leaf.inSet === null) throw new Error('Set-Mitgliedschaft von ' + leaf.id + ' unlesbar.');
    if (leaf.inSet) selected.add(leaf.id);
  }
  return selected;
}

export function validateLeaves(leaves) {
  const seen = new Set();
  for (const leaf of leaves) {
    if (seen.has(leaf.id)) throw new Error('Leaf-ID ' + leaf.id + ' mehrfach.');
    seen.add(leaf.id);
  }
}
