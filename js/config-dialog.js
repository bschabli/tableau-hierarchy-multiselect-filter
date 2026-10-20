const form=document.getElementById('config-form');
const title=document.getElementById('filter-title');
const showTitle=document.getElementById('show-title');
const input=document.getElementById('mode-parameter');
const list=document.getElementById('mode-parameter-options');
const notice=document.getElementById('parameter-hint');
const message=text=>{document.getElementById('config-status').textContent=text;};
const parameters=new Map();
const summaryParameters=new Map();
const summaryInput=document.getElementById('summary-parameter');
const summaryOptions=document.getElementById('summary-parameter-options');
const summaryHint=document.getElementById('summary-hint');

function updateInputHelp() {
  const name=input.value.trim();
  const known=parameters.get(name);
  if(!name) {
    notice.textContent='Bitte einen Modusparameter auswählen oder eingeben.';
  } else if(!known) {
    notice.textContent='Manuell eingegebener Name: Tableau prüft ihn beim Speichern.';
  } else if(!known.valid) {
    notice.textContent=known.reason+'. Bitte den Parameter in Tableau entsprechend anpassen.';
  } else {
    notice.textContent='Passender Parameter: '+name;
  }
}

async function main() {
  try {
    const payload=JSON.parse(await tableau.extensions.initializeDialogAsync());
    title.value=String(payload.title??'');
    showTitle.checked=payload.showTitle===true;
    for(const option of payload.parameters??[]) {
      parameters.set(option.name,option);
      const el=document.createElement('option');
      el.value=option.name;
      el.label=option.valid?'':option.reason;
      list.appendChild(el);
    }
    for (const option of payload.summaryParameters ?? []) {
      summaryParameters.set(option.name, option);
      const el=document.createElement('option');
      el.value=option.name;
      el.label=option.valid ? '' : option.reason;
      summaryOptions.appendChild(el);
    }
    summaryInput.value=String(payload.summaryParameterName??'');
    summaryInput.addEventListener('input',()=>{
      const name=summaryInput.value.trim();
      const option=summaryParameters.get(name);
      summaryHint.textContent=!name ? 'Keine automatische Zusammenfassung konfiguriert.'
        : option && !option.valid ? option.reason
          : option ? 'Passender Textparameter: '+name
            : 'Tableau prüft den eingegebenen Namen beim Speichern.';
    });
    summaryInput.dispatchEvent(new Event('input'));
    input.value=String(payload.parameterName??'');
    input.addEventListener('input',updateInputHelp);
    showTitle.addEventListener('change',()=>{
      title.disabled=!showTitle.checked;
    });
    title.disabled=!showTitle.checked;
    updateInputHelp();

    if(!parameters.size) {
      message('Tableau liefert derzeit keine Parameter-Vorschläge. Du kannst den Parameternamen trotzdem manuell eingeben.');
    }

    form.addEventListener('submit',event=>{
      event.preventDefault();
      const parameterName=input.value.trim();
      if(!parameterName) {
        message('Bitte einen Modusparameter angeben.');
        return;
      }
      const option=parameters.get(parameterName);
      if(option && !option.valid) {
        message('Parameter "'+parameterName+'" ist ungeeignet: '+option.reason);
        return;
      }
      const summaryParameterName=summaryInput.value.trim();
      const summaryOption=summaryParameters.get(summaryParameterName);
      if (summaryParameterName === parameterName) {
        message('Modusparameter und Zusammenfassungsparameter müssen verschieden sein.');
        return;
      }
      if (summaryOption && !summaryOption.valid) {
        message('Zusammenfassungsparameter ungeeignet: '+summaryOption.reason);
        return;
      }
      tableau.extensions.ui.closeDialog(JSON.stringify({
        parameterName,
        summaryParameterName,
        title:title.value,
        showTitle:showTitle.checked
      }));
    });
    document.getElementById('cancel').addEventListener('click',()=>{
      tableau.extensions.ui.closeDialog('CANCEL');
    });
  } catch(error) {
    message('Konfiguration fehlgeschlagen: '+error.message);
  }
}

main();
