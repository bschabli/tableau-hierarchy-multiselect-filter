/** PoC UI layer. The future Wunderbaum renderer replaces only this layer. */
import {TableauConnector} from './tableau-connector.js';

const ids = ['status','rows','count','mode','debug','reload','apply','all','none'];
const elements = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
const state = {
  leaves: [],
  selectedIds: new Set(),
  mode: 'AUSWAHL',
  busy: false,
  dirty: false,
  applyTimer: null,
  refreshTimer: null
};

function log(message) {
  elements.debug.textContent =
    new Date().toLocaleTimeString() + ' ' + message + '\n' + elements.debug.textContent;
  elements.debug.textContent = elements.debug.textContent.slice(0, 5000);
}
function status(message, error = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle('error', error);
  log(message);
}
function updateSummary() {
  elements.count.textContent = state.selectedIds.size + ' / ' +
    state.leaves.length + ' Leaf-IDs im Entwurf';
  elements.mode.textContent = 'Filtermodus: ' + state.mode;
}
function setBusy(value) {
  state.busy = value;
  for (const id of ['all','none','apply','reload']) elements[id].disabled = value;
  for (const checkbox of elements.rows.querySelectorAll('input[type="checkbox"]'))
    checkbox.disabled = value;
}
function render() {
  const fragment = document.createDocumentFragment();
  for (const leaf of state.leaves) {
    const label = document.createElement('label');
    label.className = 'item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.selectedIds.has(leaf.id);
    checkbox.disabled = state.busy;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) state.selectedIds.add(leaf.id);
      else state.selectedIds.delete(leaf.id);
      state.dirty = true;
      updateSummary();
      clearTimeout(state.applyTimer);
      state.applyTimer = setTimeout(applySelection, 300);
    });
    const body = document.createElement('span');
    body.className = 'item-text';
    const title = document.createElement('strong');
    title.textContent = leaf.id;
    const path = document.createElement('small');
    path.textContent = leaf.path || 'Ohne Hierarchiepfad';
    body.append(title, path);
    label.append(checkbox, body);
    fragment.append(label);
  }
  elements.rows.replaceChildren(fragment);
  updateSummary();
}
function scheduleRefresh() {
  clearTimeout(state.refreshTimer);
  state.refreshTimer = setTimeout(() => reload(), 350);
}

const connector = new TableauConnector({
  onDataChanged: scheduleRefresh,
  onModeChanged: value => { state.mode = value; updateSummary(); }
});

async function reload(force = false) {
  if (state.busy || (state.dirty && !force)) return;
  setBusy(true);
  try {
    const model = await connector.readState();
    state.leaves = model.leaves;
    state.selectedIds = model.selectedIds;
    state.mode = model.mode;
    state.dirty = false;
    render();
    status('Set eingelesen: ' + state.leaves.length + ' IDs, ' +
      state.selectedIds.size + ' IN.');
  } catch (error) {
    status('Lesefehler: ' + error.message, true);
  } finally {
    setBusy(false);
  }
}

async function applySelection() {
  if (state.busy || !state.leaves.length) return;
  clearTimeout(state.applyTimer);
  setBusy(true);
  try {
    if (!state.selectedIds.size) {
      // Empty Tableau selection is not reliable as a Set-clear operation.
      await connector.changeMode('KEINE');
      status('Keine Werte: Parameter KEINE gesetzt; Set bleibt unverändert.');
    } else {
      await connector.changeMode('AUSWAHL');
      const count = await connector.selectLeaves(state.selectedIds, state.leaves);
      status(count + ' Marks ausgewählt. Bitte Set-Mitgliedschaft separat zurücklesen.');
    }
    state.dirty = false;
  } catch (error) {
    status('Auswahlfehler: ' + error.message, true);
  } finally {
    setBusy(false);
  }
}

async function changeMode(value) {
  clearTimeout(state.applyTimer);
  if (state.busy) return;
  setBusy(true);
  try {
    await connector.changeMode(value);
    state.dirty = false;
    status('Filtermodus: ' + value + '. Das Set wurde nicht verändert.');
  } catch (error) {
    status('Parameterfehler: ' + error.message, true);
  } finally {
    setBusy(false);
  }
}

async function main() {
  elements.apply.addEventListener('click', applySelection);
  elements.reload.addEventListener('click', () => reload(true));
  elements.all.addEventListener('click', () => changeMode('ALLE'));
  elements.none.addEventListener('click', () => changeMode('KEINE'));
  try {
    status('Tableau Extensions API wird initialisiert …');
    state.mode = await connector.initialize();
    await reload(true);
  } catch (error) {
    status('Initialisierung fehlgeschlagen: ' + error.message, true);
  }
}

main();
