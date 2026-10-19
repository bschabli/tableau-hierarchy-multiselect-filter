import {TableauConnector} from './tableau-connector.js';
import {buildHierarchy, selectedLeafIds, getExpandedKeys} from './hierarchy.js';
import {sameIds, effectiveSelection, hasPendingChanges} from './selection-state.js';
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

function pending() {
  return hasPendingChanges(mode, selected, appliedMode, appliedSetIds, leaves);
}

function summary() {
  const changed = pending();
  $('count').textContent = selected.size + ' / ' + leaves.length + ' Leaf-IDs';
  $('mode').textContent = 'Modus: ' + mode + (changed ? ' · Entwurf' : '');
  $('apply').disabled = busy || !changed;
  $('reload').textContent = changed ? 'Änderungen verwerfen' : 'Neu einlesen';
  $('pending').hidden = !changed;
  $('apply').disabled = !configured || busy || !changed;
  for(const id of ['all','none']) $(id).disabled = busy || !configured;
}

function lock(value) {
  busy = value;
  for (const id of ['all', 'none', 'reload']) $(id).disabled = value;
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
    selected = effectiveSelection(mode, appliedSetIds, leaves);
    createTree();
    status('Aus Tableau gelesen: ' + leaves.length + ' Leaf-IDs; Modus ' + mode + '.');
  } catch (error) {
    status('Lesefehler: ' + error.message, true);
  } finally {
    lock(false);
  }
}

function stageMode(nextMode) {
  if (!configured || busy || !tree) return;
  ignoreEvents = true;
  try {
    tree.selectAll(nextMode === 'ALLE');
    selected = effectiveSelection(nextMode, appliedSetIds, leaves);
    mode = nextMode;
  } finally {
    ignoreEvents = false;
  }
  summary();
  status('Modus ' + nextMode + ' vorgemerkt – noch nicht angewendet.');
}

async function apply() {
  if (!configured || busy || !tree || !pending()) return;
  lock(true);
  try {
    // No selected checkboxes = no filter restriction. Keep the Tableau Set
    // unchanged and use ALLE, because clearing a Set Action is unreliable.
    const resetToAll = mode === 'KEINE' || (mode === 'AUSWAHL' && selected.size === 0);
    const targetMode = resetToAll ? 'ALLE' : mode;
    let writtenMarks = null;
    if (targetMode === 'AUSWAHL' && !sameIds(selected, appliedSetIds)) {
      writtenMarks = await connector.selectLeaves(selected, leaves);
      appliedSetIds = new Set(selected); // Until Tableau's next data event.
    }
    if (targetMode !== appliedMode) {
      await connector.changeMode(targetMode);
    }
    appliedMode = targetMode;
    mode = targetMode;
    selected = effectiveSelection(mode, appliedSetIds, leaves);
    if (resetToAll) {
      // Match the visual checkboxes to the normalized no-filter state.
      ignoreEvents = true;
      try {
        tree.selectAll(true);
      } finally {
        ignoreEvents = false;
      }
    }
    summary();
    if (resetToAll) {
      status('Keine Auswahl: Filter zurückgesetzt, alle Werte ausgewählt.');
    } else if (writtenMarks !== null) {
      status(writtenMarks + ' Marks an Tableau übergeben. Die Set Action aktualisiert die Auswahl.');
    } else {
      status('Modus ' + mode + ' angewendet. Das Tableau Set blieb unverändert.');
    }
  } catch (error) {
    status('Anwenden fehlgeschlagen: ' + error.message, true);
  } finally {
    lock(false);
  }
}

$('apply').addEventListener('click', apply);
$('reload').addEventListener('click', () => reload(true));
$('all').addEventListener('click', () => stageMode('ALLE'));
$('none').addEventListener('click', () => stageMode('KEINE'));

async function configure() {
  if (busy) return;
  try {
    const payload = {
      parameterName: tableau.extensions.settings.get(SETTINGS_KEYS.parameter) || '',
      title: tableau.extensions.settings.get(SETTINGS_KEYS.title) || '',
      parameters: await connector.listModeParameters()
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
    tableau.extensions.settings.set(SETTINGS_KEYS.title, normalizeFilterTitle(next.title));
    await tableau.extensions.settings.saveAsync();
    $('filter-title').textContent = normalizeFilterTitle(next.title);
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

$('configure').addEventListener('click', configure);

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
    $('filter-title').textContent = normalizeFilterTitle(
      tableau.extensions.settings.get(SETTINGS_KEYS.title)
    );
    configured = initialMode !== null;
    if(!configured) {
      status(connector.configurationError ||
        'Noch nicht konfiguriert: Bitte über „Konfigurieren“ einen Tableau-Modusparameter wählen.');
      summary();
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
