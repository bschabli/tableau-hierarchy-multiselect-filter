import {rowToLeaf, readLeafSelection, validateLeaves} from './core.js';

const els = Object.fromEntries(['status','rows','count','mode','debug','reload','apply','all','none']
  .map(id => [id, document.getElementById(id)]));
let worksheet;
let modeParameter;
let leaves = [];
let chosenIds = new Set();
let mode = 'AUSWAHL';
let busy = false;
let pendingLocalChanges = false;
let refreshHandle;
let applyHandle;

function log(message) {
  els.debug.textContent = new Date().toLocaleTimeString() + ' ' + message + '\n' + els.debug.textContent;
  els.debug.textContent = els.debug.textContent.slice(0, 5500);
}
function status(message, error = false) {
  els.status.textContent = message;
  els.status.classList.toggle('error', error);
  log(message);
}
function setBusy(next) {
  busy = next;
  for (const button of [els.apply, els.reload, els.all, els.none]) button.disabled = next;
}
function updateCount() {
  els.count.textContent = chosenIds.size + ' / ' + leaves.length + ' Leaf-IDs im Set-Entwurf';
  els.mode.textContent = 'Filtermodus: ' + mode;
}
function render() {
  const fragment = document.createDocumentFragment();
  for (const leaf of leaves) {
    const label = document.createElement('label');
    label.className = 'item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = chosenIds.has(leaf.id);
    checkbox.disabled = busy;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) chosenIds.add(leaf.id);
      else chosenIds.delete(leaf.id);
      pendingLocalChanges = true;
      updateCount();
      clearTimeout(applyHandle);
      applyHandle = setTimeout(applySelection, 300);
    });
    const title = document.createElement('strong');
    title.textContent = leaf.id;
    const subtitle = document.createElement('small');
    subtitle.textContent = leaf.path || 'Ohne Hierarchiepfad';
    const detail = document.createElement('span');
    detail.className = 'item-text';
    detail.append(title, subtitle);
    label.append(checkbox, detail);
    fragment.append(label);
  }
  els.rows.replaceChildren(fragment);
  updateCount();
}
async function getEncodings() {
  const spec = await worksheet.getVisualSpecificationAsync();
  const index = spec.activeMarksSpecificationIndex;
  if (index < 0) throw new Error('Kein aktiver Marks-Typ.');
  const fields = {};
  for (const e of spec.marksSpecifications[index].encodings) (fields[e.id] ||= []).push(e.field);
  if (!fields.leaf?.length || !fields.membership?.length)
    throw new Error('Leaf ID und Set-Mitgliedschaft müssen auf dem Marks-Shelf liegen.');
  return fields;
}
async function fetchLeaves() {
  const encodings = await getEncodings();
  const reader = await worksheet.getSummaryDataReaderAsync(undefined, {ignoreSelection: true});
  const loaded = [];
  try {
    for (let page = 0; page < reader.pageCount; page++) {
      const dataPage = await reader.getPageAsync(page);
      for (const cells of dataPage.data) {
        const row = {};
        for (const column of dataPage.columns) row[column.fieldName] = cells[column.index];
        loaded.push(rowToLeaf(row, encodings, loaded.length + 1));
      }
    }
  } finally {
    await reader.releaseAsync();
  }
  validateLeaves(loaded);
  return loaded;
}
async function loadFromTableau(force = false) {
  if (busy && !force) return;
  if (pendingLocalChanges && !force) return;
  try {
    const loaded = await fetchLeaves();
    const selected = readLeafSelection(loaded);
    leaves = loaded;
    chosenIds = selected;
    pendingLocalChanges = false;
    render();
    status('Aus Tableau gelesen: ' + leaves.length + ' IDs, davon ' + chosenIds.size + ' IN.');
  } catch (error) {
    status('Lesefehler: ' + error.message, true);
  }
}
async function changeMode(next) {
  if (!modeParameter) throw new Error('Parameter p.filter_modus fehlt.');
  await modeParameter.changeValueAsync(next);
  mode = next;
  updateCount();
}
async function applySelection() {
  if (busy) return;
  clearTimeout(applyHandle);
  if (!leaves.length) return;
  setBusy(true);
  try {
    await changeMode('AUSWAHL');
    const tupleIds = leaves.filter(leaf => chosenIds.has(leaf.id)).map(leaf => leaf.tupleId);
    await worksheet.selectTuplesAsync(tupleIds, tableau.SelectOptions.Simple);
    status('selectTuplesAsync: ' + tupleIds.length + ' Marks gesendet. Set Action separat prüfen!');
    pendingLocalChanges = false;
  } catch (error) {
    pendingLocalChanges = true;
    status('Schreibfehler: ' + error.message, true);
  } finally {
    setBusy(false);
    render();
  }
}
async function overrideMode(target) {
  if (busy) return;
  setBusy(true);
  try {
    await changeMode(target);
    status('p.filter_modus = ' + target + '. Das Set bleibt unverändert.');
  } catch (error) {
    status('Parameterfehler: ' + error.message, true);
  } finally {
    setBusy(false);
  }
}
function scheduleRefresh() {
  clearTimeout(refreshHandle);
  refreshHandle = setTimeout(() => loadFromTableau(), 350);
}
async function main() {
  try {
    status('Tableau API wird initialisiert …');
    await tableau.extensions.initializeAsync();
    worksheet = tableau.extensions.worksheetContent?.worksheet;
    if (!worksheet) throw new Error('Dieses Beispiel benötigt eine Tableau Viz Extension.');
    const parameters = await worksheet.getParametersAsync();
    modeParameter = parameters.find(p => p.name === 'p.filter_modus');
    if (!modeParameter) throw new Error('Workbook-Parameter p.filter_modus fehlt.');
    mode = String(modeParameter.currentValue.value);
    modeParameter.addEventListener(tableau.TableauEventType.ParameterChanged, async e => {
      try {
        modeParameter = await e.getParameterAsync();
        mode = String(modeParameter.currentValue.value);
        updateCount();
      } catch (error) {
        log('Parameter-Event: ' + error.message);
      }
    });
    worksheet.addEventListener(tableau.TableauEventType.SummaryDataChanged, scheduleRefresh);
    els.apply.addEventListener('click', applySelection);
    els.reload.addEventListener('click', () => loadFromTableau(true));
    els.all.addEventListener('click', () => overrideMode('ALLE'));
    els.none.addEventListener('click', () => overrideMode('KEINE'));
    await loadFromTableau(true);
  } catch (error) {
    status('Initialisierungsfehler: ' + error.message, true);
  }
}
main();
