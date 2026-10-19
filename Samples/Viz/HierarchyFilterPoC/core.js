/** Pure transformations used by the PoC, testable without Tableau. */
export function normalizeId(value) {
  return value == null ? '' : String(value).trim();
}
export function membership(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
  const valueText = String(value ?? '').trim().toUpperCase();
  if (['IN', 'TRUE', 'WAHR', '1', 'IM SET'].includes(valueText)) return true;
  if (['OUT', 'FALSE', 'FALSCH', '0', 'AUSSERHALB DES SETS', 'NICHT IM SET'].includes(valueText)) return false;
  return null;
}
export function rowToLeaf(row, encodingMap, tupleId) {
  const idField = encodingMap.leaf?.[0]?.name;
  if (!idField) throw new Error('Im Marks-Shelf fehlt das Feld Leaf ID.');
  const id = normalizeId(row[idField]?.value);
  if (!id) throw new Error('Leere Leaf-ID in Tableau-Zeile ' + tupleId);
  const levels = (encodingMap.level ?? []).map(f => normalizeId(row[f.name]?.formattedValue ?? row[f.name]?.value)).filter(Boolean);
  const setField = encodingMap.membership?.[0]?.name;
  const raw = setField ? row[setField] : null;
  let inSet = raw ? membership(raw.value) : null;
  if (inSet === null && raw) inSet = membership(raw.formattedValue);
  return {id, path: levels.join(' › '), tupleId, inSet};
}
export function readLeafSelection(leaves) {
  const result = new Set();
  for (const leaf of leaves) {
    if (leaf.inSet === null) throw new Error('Set-Mitgliedschaft für ' + leaf.id + ' nicht lesbar.');
    if (leaf.inSet) result.add(leaf.id);
  }
  return result;
}
export function validateLeaves(leaves) {
  const seen = new Set();
  for (const leaf of leaves) {
    if (seen.has(leaf.id)) throw new Error('Leaf-ID ' + leaf.id + ' ist mehrfach vorhanden.');
    seen.add(leaf.id);
  }
}
