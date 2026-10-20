const form = document.getElementById('config-form');
const title = document.getElementById('filter-title');
const showTitle = document.getElementById('show-title');
const modeInput = document.getElementById('mode-parameter');
const summaryInput = document.getElementById('summary-parameter');
const modeChoice = document.getElementById('mode-choice');
const summaryChoice = document.getElementById('summary-choice');
const modeInfo = document.getElementById('mode-choice-info');
const summaryInfo = document.getElementById('summary-choice-info');
const modeHint = document.getElementById('parameter-hint');
const summaryHint = document.getElementById('summary-hint');
const status = document.getElementById('config-status');
const modeOptions = new Map();
const summaryOptions = new Map();

function message(value) { status.textContent = value; }

/** Native <select> reliably shows suggestions in Tableau's embedded WebView.
 * Unlike <datalist>, it does not rely on browser-specific autocomplete popups.
 */
function populate(select, options, byName, savedName) {
  let valid = 0;
  for (const item of options || []) {
    if (!item?.name) continue;
    byName.set(item.name, item);
    const elem = document.createElement('option');
    elem.value = item.name;
    elem.textContent = item.valid
      ? item.name
      : item.name + ' (ungeeignet: ' + item.reason + ')';
    elem.disabled = !item.valid;
    select.appendChild(elem);
    if (item.valid) valid++;
  }
  select.disabled = byName.size === 0;
  select.value = byName.get(savedName)?.valid ? savedName : '';
  return valid;
}

function updateHint(input, choices, hint, byName, kind) {
  const name = input.value.trim();
  choices.value = byName.get(name)?.valid ? name : '';
  const option = byName.get(name);
  hint.textContent = !name
    ? kind === 'summary' ? 'Keine Zusammenfassung konfiguriert.'
      : 'Bitte einen Modusparameter auswählen.'
    : !option ? 'Manuelle Eingabe – Prüfung erfolgt beim Speichern.'
    : !option.valid ? option.reason + '. Bitte Parameter in Tableau anpassen.'
    : 'Passender Parameter: ' + name;
}

function linkSelect(select, input, hint, options, kind) {
  select.addEventListener('change', () => {
    if (select.value) {
      input.value = select.value;
    } else if (kind === 'summary') {
      input.value = '';
    }
    updateHint(input, select, hint, options, kind);
  });
  input.addEventListener('input', () => {
    updateHint(input, select, hint, options, kind);
  });
}

async function main() {
  try {
    const payload = JSON.parse(await tableau.extensions.initializeDialogAsync());
    const validModes = populate(
      modeChoice, payload.parameters, modeOptions, payload.parameterName);
    const validSummaries = populate(
      summaryChoice, payload.summaryParameters, summaryOptions,
      payload.summaryParameterName);
    modeInput.value = String(payload.parameterName ?? '');
    summaryInput.value = String(payload.summaryParameterName ?? '');
    title.value = String(payload.title ?? '');
    showTitle.checked = payload.showTitle === true;
    title.disabled = !showTitle.checked;
    showTitle.addEventListener('change', () => {
      title.disabled = !showTitle.checked;
    });

    linkSelect(modeChoice, modeInput, modeHint, modeOptions, 'mode');
    linkSelect(summaryChoice, summaryInput, summaryHint, summaryOptions, 'summary');
    updateHint(modeInput, modeChoice, modeHint, modeOptions, 'mode');
    updateHint(summaryInput, summaryChoice, summaryHint, summaryOptions, 'summary');

    const error = String(payload.parameterLookupError || '').trim();
    if (error) {
      modeInfo.textContent = 'Liste konnte nicht geladen werden: ' + error;
      summaryInfo.textContent = 'Manuelle Eingabe weiterhin möglich.';
      message('Tableau-Parameterliste derzeit nicht verfügbar.');
    } else {
      const count = Number(payload.returnedParameterCount ?? 0);
      modeInfo.textContent = validModes + ' passende Modusparameter (' +
        count + ' von Tableau geliefert).';
      summaryInfo.textContent = validSummaries + ' passende Textparameter.';
      if (!count && !modeOptions.size) {
        message('Tableau liefert keine Parameter. Prüfe, ob sie im Workbook verwendet werden.');
      }
    }

    form.addEventListener('submit', event => {
      event.preventDefault();
      const parameterName = modeInput.value.trim();
      const summaryParameterName = summaryInput.value.trim();
      if (!parameterName) {
        message('Bitte einen Modusparameter angeben.');
        return;
      }
      const modeOption = modeOptions.get(parameterName);
      if (modeOption && !modeOption.valid) {
        message('Modusparameter ungeeignet: ' + modeOption.reason);
        return;
      }
      const summaryOption = summaryOptions.get(summaryParameterName);
      if (summaryOption && !summaryOption.valid) {
        message('Zusammenfassungsparameter ungeeignet: ' + summaryOption.reason);
        return;
      }
      if (summaryParameterName && summaryParameterName === parameterName) {
        message('Modus- und Zusammenfassungsparameter müssen verschieden sein.');
        return;
      }
      tableau.extensions.ui.closeDialog(JSON.stringify({
        parameterName,
        summaryParameterName,
        title: title.value,
        showTitle: showTitle.checked
      }));
    });
    document.getElementById('cancel').addEventListener('click', () => {
      tableau.extensions.ui.closeDialog('CANCEL');
    });
  } catch (error) {
    console.error('[Hierarchy Filter] Konfigurationsdialog:', error);
    message('Konfiguration fehlgeschlagen: ' + error.message);
  }
}
main();
