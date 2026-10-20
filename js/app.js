import {TableauConnector} from './tableau-connector.js';
import {buildHierarchy, selectedLeafIds, getExpandedKeys} from './hierarchy.js';
import {hasPendingChanges} from './selection-state.js';
import {SETTINGS_KEYS, normalizeFilterTitle} from './configuration.js';
import {findSearchBranches, searchDisplayMode} from './tree-search.js';
import {summarizeFilterSelection} from './filter-summary.js';

const $ = id => document.getElementById(id);
const status = (message, error = false) => {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
};

let tree = null;
let leaves = [];
let selected = new Set();        // Unconfirmed checkbox selection.
let appliedSetIds = new Set();   // Last known Tableau Set membership.
let busy = false;
let ignoreEvents = false;
let refreshTimer = null;
let configured = false;
let beforeSearchExpansion = null;
let searchTimer = null;
let showOnlyMatches = false;

function updateOptionalTitle() {
  const show=tableau.extensions.settings.get(SETTINGS_KEYS.showTitle)==='true';
  $('filter-title').textContent=normalizeFilterTitle(
    tableau.extensions.settings.get(SETTINGS_KEYS.title)
  );
  $('heading').hidden=!show;
}

function pending() {
  return hasPendingChanges(selected, appliedSetIds);
}

function summary() {
  const changed = pending();
  $('count').textContent = selected.size + ' von ' + leaves.length + ' ausgewählt';
  $('draft-status').textContent=changed ? 'Noch nicht angewendet' : '';
  $('all').disabled=!configured || busy;
  $('none').disabled=!configured || busy;
  $('search-query').disabled = !configured || busy;
  $('search-only').disabled = !configured || busy;
  $('expand-all').disabled = !configured || busy;
  $('collapse-all').disabled = !configured || busy;
  $('search-only').setAttribute('aria-pressed', String(showOnlyMatches));
  const filterHint = showOnlyMatches ? 'Alle Treffer und übrige Knoten anzeigen'
    : 'Nur Treffer anzeigen';
  $('search-only').title = filterHint;
  $('search-only').setAttribute('aria-label', filterHint);
  const reloadHint = changed ? 'Änderungen verwerfen' : 'Neu einlesen';
  $('reload').title = reloadHint;
  $('reload').setAttribute('aria-label', reloadHint);
  $('apply').disabled = !configured || busy || !changed;
}

function lock(value) {
  busy = value;
  $('reload').disabled = value;
  tree?.setEnabled(!value);
  summary();
}

function createTree(resetExpansion = false) {
  if (!window.mar10?.Wunderbaum) {
    throw new Error('Die lokale Wunderbaum-Bibliothek konnte nicht geladen werden.');
  }
  ignoreEvents = true;
  try {
    // Recreating the tree on Set updates must not expand collapsed branches.
    // Manual 'Neu einlesen', initial load and reconfiguration start closed.
    // Passive Tableau Set refreshes and mode changes keep user expansion.
    const expandedKeys = resetExpansion
      ? new Set()
      : (beforeSearchExpansion ?? getExpandedKeys(tree));
    if (resetExpansion) beforeSearchExpansion = null;
    const previousScroll = resetExpansion ? 0 : $('rows').scrollTop;
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
      rowHeightPx: 26,
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

const connector=new TableauConnector({onDataChanged:scheduleRefresh});

async function reload(force = false) {
  if (!configured || busy || (pending() && !force)) return;
  lock(true);
  try {
    const snapshot = await connector.readState();
    leaves = snapshot.leaves;
    appliedSetIds = new Set(snapshot.selectedIds);
    selected=new Set(appliedSetIds);
    createTree(force);
    status('Auswahl aktualisiert.');
  } catch (error) {
    status('Lesefehler: ' + error.message, true);
  } finally {
    lock(false);
  }
}

/** Alle/Keine only edit the current draft. */
function stageAll(checked) {
  if(!configured||busy||!tree) return;
  ignoreEvents=true;
  try {
    tree.selectAll(checked);
    selected=checked ? new Set(leaves.map(leaf=>leaf.id)) : new Set();
  } finally {ignoreEvents=false;}
  summary();
  status(checked ? 'Alle ausgewählt – noch nicht angewendet.'
    : 'Keine ausgewählt – noch nicht angewendet.');
}

async function apply() {
  if(!configured||busy||!tree||!pending()) return;
  lock(true);
  try {
    const intendedIds=new Set(selected);
    if(intendedIds.size===0) {
      await connector.clearSetViaSelection(leaves);
      let cleared=false;
      for(let attempt=0;attempt<4;attempt++) {
        if(attempt>0) await new Promise(resolve=>setTimeout(resolve,250));
        const state=await connector.readState();
        if(state.selectedIds.size===0) {cleared=true;break;}
      }
      if(!cleared) throw new Error('Das Set wurde nicht geleert. '+
        'Stelle bei der Set Action „Auswahl aufheben“ auf „Alle Werte aus Set entfernen“.');
    } else {
      await connector.selectLeaves(intendedIds,leaves);
    }
    appliedSetIds=new Set(intendedIds);
    summary();
    let summaryWarning='';
    try {
      await connector.writeSummary(summarizeFilterSelection(leaves,intendedIds));
    } catch(error) {
      console.error('[Hierarchy Filter] Zusammenfassung:',error);
      summaryWarning=' Zusammenfassung nicht aktualisiert: '+error.message;
    }
    const success=intendedIds.size===0 ? 'Keine Werte ausgewählt und angewendet.'
      : intendedIds.size===leaves.length ? 'Alle Werte ausgewählt und angewendet.'
        : intendedIds.size+' Werte ausgewählt und angewendet.';
    status(success+summaryWarning,!!summaryWarning);
  } catch(error) {
    status('Anwenden fehlgeschlagen: '+error.message,true);
  } finally {lock(false);}
}

$('apply').addEventListener('click', apply);
$('reload').addEventListener('click', () => reload(true));
$('all').addEventListener('click',()=>stageAll(true));
$('none').addEventListener('click',()=>stageAll(false));
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
  if(busy) return;
  try {
    let candidates={summaryParameters:[],returnedCount:0};
    let parameterLookupError='';
    try {candidates=await connector.listParameterCandidates();}
    catch(error) {
      parameterLookupError=error?.message||String(error);
      console.error('[Hierarchy Filter] Parameterliste:',error);
    }
    const payload={
      title:tableau.extensions.settings.get(SETTINGS_KEYS.title)||'',
      showTitle:tableau.extensions.settings.get(SETTINGS_KEYS.showTitle)==='true',
      summaryParameterName:
        tableau.extensions.settings.get(SETTINGS_KEYS.summaryParameter)||'',
      summaryParameters:candidates.summaryParameters,
      returnedParameterCount:candidates.returnedCount,
      parameterLookupError
    };
    const response=await tableau.extensions.ui.displayDialogAsync(
      new URL('./config.html',window.location.href).href,
      JSON.stringify(payload),{height:430,width:490}
    );
    if(!response||response==='CANCEL') return;
    const next=JSON.parse(response);
    await connector.chooseSummaryParameter(next.summaryParameterName||'');
    tableau.extensions.settings.set(
      SETTINGS_KEYS.summaryParameter,next.summaryParameterName||''
    );
    tableau.extensions.settings.set(
      SETTINGS_KEYS.title,String(next.title??'').trim().slice(0,80)
    );
    tableau.extensions.settings.set(
      SETTINGS_KEYS.showTitle,String(next.showTitle===true)
    );
    await tableau.extensions.settings.saveAsync();
    updateOptionalTitle();
    if(connector.summaryParameter) {
      await connector.writeSummary(summarizeFilterSelection(leaves,appliedSetIds));
    }
    status('Einstellungen gespeichert.');
  } catch(error) {
    if(error?.errorCode==='DialogClosedByUser'||
      String(error?.message||'').includes('DialogClosedByUser')) return;
    status('Konfiguration: '+error.message,true);
  }
}

// In a Viz Extension, Tableau exposes configure via "Format Extension" on
// the Marks card. No configuration button is rendered in the filter itself.
async function start() {
  window.__hierarchyAppStarted=true;
  status('Verbinde mit Tableau ...');
  try {
    const handshake=connector.initialize(configure);
    handshake.catch(error=>console.error('[Hierarchy Filter] Tableau handshake:',error));
    await Promise.race([
      handshake,
      new Promise((_,reject)=>setTimeout(
        ()=>reject(new Error('Tableau antwortet seit 15 Sekunden nicht.')),15000))
    ]);
    updateOptionalTitle();
    configured=true;
    status('Tableau verbunden. Lese Auswahl aus dem Set ...');
    await reload(true);
    if(connector.summaryConfigurationError) {
      status('Auswahl geladen, aber der Zusammenfassungsparameter ist ungültig: '+
        connector.summaryConfigurationError,true);
    }
  } catch(error) {
    console.error('[Hierarchy Filter] Startfehler:',error);
    status('Initialisierung fehlgeschlagen: '+(error?.message||String(error)),true);
  }
}

start().catch(error => {
  console.error('[Hierarchy Filter] Unerwarteter Startfehler:', error);
  status('Startfehler: ' + (error?.message || String(error)), true);
});
