import {TableauConnector} from './tableau-connector.js';
import {buildHierarchy, selectedLeafIds, getExpandedKeys} from './hierarchy.js';
import {sameIds, effectiveSelection, resolveApplyState, hasPendingChanges} from './selection-state.js';
import {SETTINGS_KEYS, normalizeFilterTitle} from './configuration.js';

const $ = id => document.getElementById(id);
const status = (message, error = false) => {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
};

let tree = null;
let leaves = [];
let selected = new Set();        // Unconfirmed checkbox selection.
let appliedSetIds = new Set();   // Last known Tableau Set membership.
let mode = 'AUSWAHL';            // Draft filter mode.
let appliedMode = 'AUSWAHL';     // Last known Tableau parameter.
let busy = false;
let ignoreEvents = false;
let refreshTimer = null;
let configured = false;
let lastExplicitSelection = new Set();

function updateOptionalTitle() {
  const show=tableau.extensions.settings.get(SETTINGS_KEYS.showTitle)==='true';
  $('filter-title').textContent=normalizeFilterTitle(
    tableau.extensions.settings.get(SETTINGS_KEYS.title)
  );
  $('heading').hidden=!show;
}

function pending() {
  return hasPendingChanges(mode, selected, appliedMode, appliedSetIds, leaves);
}

function summary() {
  const changed = pending();
  $('count').textContent = selected.size + ' von ' + leaves.length + ' ausgewählt';
  const modeNames = {ALLE: 'Alle', AUSWAHL: 'Auswahl', KEINE: 'Keine'};
  $('mode').textContent = 'Aktiv: ' + (modeNames[appliedMode] ?? appliedMode)
    + (changed ? ' · noch nicht angewendet' : '');
  $('mode-select').value = mode;
  $('mode-select').disabled = !configured || busy;
  $('reload').textContent = changed ? 'Änderungen verwerfen' : 'Neu einlesen';
  $('pending').hidden = !changed;
  $('apply').disabled = !configured || busy || !changed;
}

function lock(value) {
  busy = value;
  $('reload').disabled = value;
  tree?.setEnabled(!value);
  summary();
}

function createTree() {
  if (!window.mar10?.Wunderbaum) {
    throw new Error('Die lokale Wunderbaum-Bibliothek konnte nicht geladen werden.');
  }
  ignoreEvents = true;
  try {
    // Recreating the tree on Set updates must not expand collapsed branches.
    const expandedKeys = getExpandedKeys(tree);
    const previousScroll = $('rows').scrollTop;
    tree?.destroy();
    const {roots} = buildHierarchy(leaves, selected, expandedKeys);
    tree = new window.mar10.Wunderbaum({
      element: $('rows'),
      source: roots,
      checkbox: true,
      selectMode: 'hier',
      rowHeightPx: 32,
      minExpandLevel: 0,
      icon: false,
      iconMap: {
        ...window.mar10.Wunderbaum.iconMaps.bootstrap,
        expanderExpanded: 'wb-arrow-down',
        expanderCollapsed: 'wb-arrow-right',
        expanderLazy: 'wb-arrow-right',
        checkChecked: 'wb-box-checked',
        checkUnchecked: 'wb-box-empty',
        checkUnknown: 'wb-box-partial',
        folder: '', folderOpen: '', doc: ''
      },
      select: () => {
        if (ignoreEvents || busy) return;
        selected = selectedLeafIds(tree);
        lastExplicitSelection = new Set(selected);
        mode = 'AUSWAHL';
        summary();
        status('Auswahl geändert – noch nicht angewendet.');
      }
    });
    // Wunderbaum virtualizes rows, therefore restore viewport after layout.
    if (expandedKeys !== null) {
      requestAnimationFrame(() => {
        if (tree) $('rows').scrollTop = previousScroll;
      });
    }
  } finally {
    ignoreEvents = false;
  }
  summary();
}

function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => reload(), 450);
}

const connector = new TableauConnector({
  onDataChanged: scheduleRefresh,
  onModeChanged: value => {
    const hadPending = pending();
    appliedMode = value;
    if (!hadPending && !busy) scheduleRefresh();
    summary();
  }
});

async function reload(force = false) {
  if (!configured || busy || (pending() && !force)) return;
  lock(true);
  try {
    const snapshot = await connector.readState();
    leaves = snapshot.leaves;
    appliedSetIds = new Set(snapshot.selectedIds);
    appliedMode = snapshot.mode;
    mode = snapshot.mode;
    selected = effectiveSelection(mode, appliedSetIds);
    // An unfiltered workbook can have all members in the Tableau Set
    // without any checkbox being checked. Do not copy those IDs into
    // the user's last explicit selection.
    if (mode === 'AUSWAHL') lastExplicitSelection = new Set(selected);
    createTree();
    status('Auswahl aktualisiert.');
  } catch (error) {
    status('Lesefehler: ' + error.message, true);
  } finally {
    lock(false);
  }
}

function stageMode(nextMode) {
  if (!configured || busy || !tree ||
      !['ALLE', 'AUSWAHL', 'KEINE'].includes(nextMode)) return;
  if (mode === 'AUSWAHL') lastExplicitSelection = new Set(selected);
  ignoreEvents = true;
  try {
    mode = nextMode;
    if (nextMode === 'AUSWAHL') {
      selected = new Set(lastExplicitSelection);
      // Rebuild the checkbox states without losing the expanded nodes.
      createTree();
    } else {
      const all = nextMode === 'ALLE';
      // Neither ALLE nor KEINE should display checked boxes.
      tree.selectAll(false);
      selected = new Set();
    }
  } finally {
    ignoreEvents = false;
  }
  summary();
  status(nextMode === 'KEINE'
    ? 'Keine Auswahl vorgemerkt. Beim Anwenden werden alle Werte berücksichtigt.'
    : 'Modus geändert – noch nicht angewendet.');
}

async function apply() {
  if (!configured || busy || !tree || !pending()) return;
  lock(true);
  try {
    const intended = resolveApplyState(mode, selected, leaves);
    let writtenMarks = null;

    // Important: an empty displayed selection means all items must be
    // IN the Tableau Set, not that all checkboxes become checked.
    if (!sameIds(intended.setIds, appliedSetIds)) {
      writtenMarks = await connector.selectLeaves(intended.setIds, leaves);
      appliedSetIds = new Set(intended.setIds);
    }
    if (intended.mode !== appliedMode) {
      await connector.changeMode(intended.mode);
    }
    appliedMode = intended.mode;
    mode = intended.mode;
    selected = new Set(intended.checkedIds);

    if (mode === 'AUSWAHL') lastExplicitSelection = new Set(selected);
    // Keep the checkbox state accurate even when the full Tableau Set is selected.
    ignoreEvents = true;
    try {
      if (mode === 'ALLE') {
        tree.selectAll(false);
      }
    } finally {
      ignoreEvents = false;
    }
    summary();
    if (mode === 'ALLE') {
      status('Filter zurückgesetzt – alle Werte werden berücksichtigt.');
    } else if (writtenMarks !== null) {
      status(selected.size + ' Werte ausgewählt und angewendet.');
    } else {
      status('Auswahl angewendet.');
    }
  } catch (error) {
    status('Anwenden fehlgeschlagen: ' + error.message, true);
  } finally {
    lock(false);
  }
}

$('apply').addEventListener('click', apply);
$('reload').addEventListener('click', () => reload(true));
$('mode-select').addEventListener('change', event => stageMode(event.target.value));

async function configure() {
  if (busy) return;
  try {
    const payload = {
      parameterName: tableau.extensions.settings.get(SETTINGS_KEYS.parameter) || '',
      title: tableau.extensions.settings.get(SETTINGS_KEYS.title) || '',
      showTitle: tableau.extensions.settings.get(SETTINGS_KEYS.showTitle)==='true',
      parameters: await connector.listModeParameters().catch(error => {
        console.warn('[Hierarchy Filter] Parametervorschläge nicht verfügbar:', error);
        return [];
      })
    };
    const response = await tableau.extensions.ui.displayDialogAsync(
      new URL('./config.html', window.location.href).href,
      JSON.stringify(payload),
      {height: 380, width: 470}
    );
    if (!response || response === 'CANCEL') return;
    const next = JSON.parse(response);
    await connector.chooseParameter(next.parameterName);
    // Save only after the candidate parameter has passed validation.
    tableau.extensions.settings.set(SETTINGS_KEYS.parameter, next.parameterName);
    tableau.extensions.settings.set(SETTINGS_KEYS.title, String(next.title??'').trim().slice(0,80));
    tableau.extensions.settings.set(SETTINGS_KEYS.showTitle, String(next.showTitle===true));
    await tableau.extensions.settings.saveAsync();
    updateOptionalTitle();
    configured = true;
    mode = connector.mode;
    selected = new Set();
    leaves = [];
    appliedSetIds = new Set();
    appliedMode = mode;
    await reload(true);
  } catch(error) {
    if (error?.errorCode === 'DialogClosedByUser' ||
        String(error?.message || '').includes('DialogClosedByUser')) return;
    status('Konfiguration: ' + error.message, true);
  }
}

// In a Viz Extension, Tableau exposes configure via "Format Extension" on
// the Marks card. No configuration button is rendered in the filter itself.
async function start() {
  window.__hierarchyAppStarted = true;
  status('Verbinde mit Tableau ...');
  try {
    const handshake = connector.initialize(configure);
    handshake.catch(error => console.error('[Hierarchy Filter] Tableau handshake:', error));
    const initialMode = await Promise.race([
      handshake,
      new Promise((_, reject) => setTimeout(
        () => reject(new Error('Tableau antwortet seit 15 Sekunden nicht.')), 15000))
    ]);
    updateOptionalTitle();
    configured = initialMode !== null;
    if(!configured) {
      status(connector.configurationError ||
        'Noch nicht konfiguriert. Öffne den Einstellungsdialog …');
      summary();
      // First-run fallback: no permanent configuration button in the viz.
      await configure();
      if (!configured) {
        status('Konfiguration erforderlich: In der Marks-Karte „Format Extension“ wählen. ' +
          'Wenn die Schaltfläche fehlt, die Extension mit der neuen .trex-Datei erneut hinzufügen.');
      }
      return;
    }
    mode = initialMode;
    status('Tableau verbunden. Lese Daten und Set ...');
    await reload(true);
  } catch (error) {
    console.error('[Hierarchy Filter] Startfehler:', error);
    status('Initialisierung fehlgeschlagen: ' + (error?.message || String(error)), true);
  }
}
start().catch(error => {
  console.error('[Hierarchy Filter] Unerwarteter Startfehler:', error);
  status('Startfehler: ' + (error?.message || String(error)), true);
});
