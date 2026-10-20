import {TableauConnector} from './tableau-connector.js';
import {buildHierarchy, selectedLeafIds, getExpandedKeys} from './hierarchy.js';
import {sameIds, effectiveSelection, resolveApplyState, hasPendingChanges} from './selection-state.js';
import {SETTINGS_KEYS, normalizeFilterTitle} from './configuration.js';
import {findSearchBranches, searchDisplayMode} from './tree-search.js';

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
let beforeSearchExpansion = null;
let searchTimer = null;
let showOnlyMatches = false;
const modeButtons = [...document.querySelectorAll('[data-mode]')];

function updateOptionalTitle() {
  const show=tableau.extensions.settings.get(SETTINGS_KEYS.showTitle)==='true';
  $('filter-title').textContent=normalizeFilterTitle(
    tableau.extensions.settings.get(SETTINGS_KEYS.title)
  );
  $('heading').hidden=!show;
}

function pending() {
  return hasPendingChanges(mode, selected, appliedMode, appliedSetIds);
}

function summary() {
  const changed = pending();
  $('count').textContent = selected.size + ' von ' + leaves.length + ' ausgewählt';
  const modeNames = {ALLE: 'Alle', AUSWAHL: 'Auswahl', KEINE: 'Keine'};
  $('mode').textContent = 'Aktiv: ' + (modeNames[appliedMode] ?? appliedMode)
    + (changed ? ' · noch nicht angewendet' : '');
  for (const button of modeButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    button.disabled = !configured || busy;
  }
  $('search-query').disabled = !configured || busy;
  $('search-only').disabled = !configured || busy;
  $('expand-all').disabled = !configured || busy;
  $('collapse-all').disabled = !configured || busy;
  $('search-only').setAttribute('aria-pressed', String(showOnlyMatches));
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
    const expandedKeys = beforeSearchExpansion ?? getExpandedKeys(tree);
    const previousScroll = $('rows').scrollTop;
    tree?.destroy();
    const {roots} = buildHierarchy(leaves, selected, expandedKeys);
    tree = new window.mar10.Wunderbaum({
      element: $('rows'),
      source: roots,
      checkbox: true,
      selectMode: 'hier',
      // Search changes only visibility/highlighting, never checkbox state.
      filter: {mode: 'mark', highlight: true, autoExpand: false},
      init: event => {
        // Wunderbaum loads the initial source asynchronously.
        if (event.error || event.tree !== tree) return;
        if ($('search-query').value.trim()) {
          try {
            applySearch(false);
          } catch (error) {
            console.error('[Hierarchy Filter] Suche:', error);
            status('Suchfehler: ' + error.message, true);
          }
        }
      },
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

/**
 * Restore the expansion state that was active before the search started.
 * Wunderbaum's internal virtual scrolling must be updated using its API.
 */
function restoreExpansion(keys) {
  if (!tree || keys === null) return;
  tree.runWithDeferredUpdate(() => {
    for (const node of tree) {
      if (!node.key?.startsWith('p:')) continue;
      const expand = keys.has(node.key);
      if (Boolean(node.expanded) !== expand) {
        // All hierarchy groups are eager, so setExpanded is synchronous
        // up to its returned resolved promise; the batched redraw is deferred.
        void node.setExpanded(expand, {force: true, noEvents: true});
      }
    }
  });
}

/**
 * Case-insensitive substring search over visible hierarchy labels.
 * Open all matching branches, and restore the prior expansion on clearing.
 */
function applySearch(scrollToTop = true) {
  if (!tree) return;
  const query = $('search-query').value.trim();
  if (query && beforeSearchExpansion === null) {
    beforeSearchExpansion = getExpandedKeys(tree);
  }

  if (tree.isFilterActive()) tree.clearFilter();
  if (beforeSearchExpansion !== null) restoreExpansion(beforeSearchExpansion);

  if (!query) {
    beforeSearchExpansion = null;
    $('search-count').textContent = '';
    return;
  }

  const {expandKeys, count} =
    findSearchBranches(tree.root.children || [], query);

  tree.filterNodes(query, {
    mode: searchDisplayMode(showOnlyMatches),
    highlight: true,
    autoExpand: false,
    matchBranch: false
  });
  tree.runWithDeferredUpdate(() => {
    for (const key of expandKeys) {
      const node = tree.findKey(key);
      if (node && !node.expanded) {
        void node.setExpanded(true, {noEvents: true});
      }
    }
  });
  $('search-count').textContent = count === 0
    ? 'Keine Treffer'
    : count === 1 ? '1 Treffer' : count + ' Treffer';
  if (scrollToTop) $('rows').scrollTop = 0;
}

/**
 * Expand or collapse the complete hierarchy without affecting selection.
 * During search, the pre-search expansion snapshot remains unchanged so
 * clearing the query still restores the user's original tree view.
 */
async function setAllExpanded(expand) {
  if (!configured || busy || !tree) return;
  try {
    await tree.expandAll(expand, {
      force: true,
      ...(expand ? {} : {deep: true}),
      keepActiveNodeVisible: false
    });
  } catch (error) {
    console.error('[Hierarchy Filter] Baumansicht:', error);
    status('Ansicht konnte nicht geändert werden: ' + error.message, true);
  }
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
      tree.selectAll(all);
      selected = all ? new Set(leaves.map(leaf => leaf.id)) : new Set();
    }
  } finally {
    ignoreEvents = false;
  }
  summary();
  status(nextMode === 'KEINE'
    ? 'Keine ausgewählt – noch nicht angewendet.'
    : nextMode === 'ALLE'
      ? 'Alle ausgewählt – noch nicht angewendet.'
      : 'Modus geändert – noch nicht angewendet.');
}

async function apply() {
  if (!configured || busy || !tree || !pending()) return;
  lock(true);
  try {
    const intended = resolveApplyState(mode, selected, leaves);
    const setChanged = !sameIds(intended.setIds, appliedSetIds);

    if (setChanged) {
      if (intended.setIds.size === 0) {
        // A Tableau Set Action with "Keep set values" cannot clear a Set.
        // Trigger an actual selection-cleared event, which requires
        // "Remove all values from set" in the Tableau Set Action.
        await connector.clearSetViaSelection(leaves);

        // Confirm the Set became empty before reporting success or
        // updating the mode parameter. Tableau actions can be asynchronous.
        let cleared = false;
        for (let attempt = 0; attempt < 4; attempt++) {
          if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 250));
          const current = await connector.readState();
          if (current.selectedIds.size === 0) {
            cleared = true;
            break;
          }
        }
        if (!cleared) {
          throw new Error(
            'Das Set wurde nicht geleert. Stelle bei der Tableau Set Action ' +
            'unter „Auswahl aufheben“ die Option „Alle Werte aus Set entfernen“ ein.'
          );
        }
      } else {
        await connector.selectLeaves(intended.setIds, leaves);
      }
      appliedSetIds = new Set(intended.setIds);
    }

    if (intended.mode !== appliedMode) {
      await connector.changeMode(intended.mode);
    }
    appliedMode = intended.mode;
    mode = intended.mode;
    selected = new Set(intended.checkedIds);
    if (mode === 'AUSWAHL') lastExplicitSelection = new Set(selected);

    // Programmatic tree selections are ignored by the select callback
    // and must mirror the draft, without changing the Tableau Set again.
    ignoreEvents = true;
    try {
      tree.selectAll(mode === 'ALLE');
      if (mode === 'AUSWAHL') createTree();
    } finally {
      ignoreEvents = false;
    }
    summary();
    if (mode === 'ALLE') {
      status('Alle Werte ausgewählt und angewendet.');
    } else if (mode === 'KEINE') {
      status('Keine Werte ausgewählt und angewendet.');
    } else {
      status(selected.size + ' Werte ausgewählt und angewendet.');
    }
  } catch (error) {
    status('Anwenden fehlgeschlagen: ' + error.message, true);
  } finally {
    lock(false);
  }
}

$('apply').addEventListener('click', apply);
$('reload').addEventListener('click', () => reload(true));
for (const button of modeButtons) {
  button.addEventListener('click', () => stageMode(button.dataset.mode));
}
$('search-only').addEventListener('click', () => {
  showOnlyMatches = !showOnlyMatches;
  summary();
  try { applySearch(false); }
  catch (error) {
    console.error('[Hierarchy Filter] Suchansicht:', error);
    status('Suchansicht konnte nicht geändert werden: ' + error.message, true);
  }
});
$('expand-all').addEventListener('click', () => setAllExpanded(true));
$('collapse-all').addEventListener('click', () => setAllExpanded(false));
$('search-query').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    try { applySearch(); }
    catch (error) {
      console.error('[Hierarchy Filter] Suche:', error);
      status('Suchfehler: ' + error.message, true);
    }
  }, 200);
});
$('search-query').addEventListener('keydown', event => {
  if (event.key === 'Escape' && $('search-query').value) {
    $('search-query').value = '';
    clearTimeout(searchTimer);
    applySearch(false);
    event.stopPropagation();
  }
});

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
