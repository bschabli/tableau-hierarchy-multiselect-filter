const form=document.getElementById('config-form');
const title=document.getElementById('filter-title');
const showTitle=document.getElementById('show-title');
const input=document.getElementById('summary-parameter');
const choice=document.getElementById('summary-choice');
const info=document.getElementById('summary-choice-info');
const hint=document.getElementById('summary-hint');
const status=document.getElementById('config-status');
const options=new Map();
const message=text=>{status.textContent=text;};

function updateHint() {
  const name=input.value.trim();
  const option=options.get(name);
  choice.value=option?.valid ? name : '';
  hint.textContent=!name ? 'Keine automatische Zusammenfassung konfiguriert.'
    : !option ? 'Manuelle Eingabe – Prüfung erfolgt beim Speichern.'
      : !option.valid ? option.reason+'. Bitte Parameter in Tableau anpassen.'
        : 'Passender Textparameter: '+name;
}

async function main() {
  try {
    const payload=JSON.parse(await tableau.extensions.initializeDialogAsync());
    title.value=String(payload.title??'');
    showTitle.checked=payload.showTitle===true;
    title.disabled=!showTitle.checked;
    showTitle.addEventListener('change',()=>{title.disabled=!showTitle.checked;});

    let valid=0;
    for(const item of payload.summaryParameters??[]) {
      if(!item.name) continue;
      options.set(item.name,item);
      const el=document.createElement('option');
      el.value=item.name;
      el.textContent=item.valid ? item.name
        : item.name+' (ungeeignet: '+item.reason+')';
      el.disabled=!item.valid;
      choice.appendChild(el);
      if(item.valid) valid++;
    }
    input.value=String(payload.summaryParameterName??'');
    choice.disabled=options.size===0;
    choice.addEventListener('change',()=>{input.value=choice.value;updateHint();});
    input.addEventListener('input',updateHint);
    updateHint();

    const error=String(payload.parameterLookupError??'').trim();
    if(error) {
      info.textContent='Parameterliste nicht verfügbar: '+error;
      message('Manuelle Eingabe ist weiterhin möglich.');
    } else {
      const total=Number(payload.returnedParameterCount??0);
      info.textContent=valid+' passende Textparameter ('+total+' von Tableau geliefert).';
      if(!total&&!options.size)
        message('Tableau liefert keine Parameter. Prüfe, ob der Parameter im Workbook verwendet wird.');
    }

    form.addEventListener('submit',event=>{
      event.preventDefault();
      const summaryParameterName=input.value.trim();
      const option=options.get(summaryParameterName);
      if(option&&!option.valid) {
        message('Zusammenfassungsparameter ungeeignet: '+option.reason);
        return;
      }
      tableau.extensions.ui.closeDialog(JSON.stringify({
        summaryParameterName,title:title.value,showTitle:showTitle.checked
      }));
    });
    document.getElementById('cancel').addEventListener('click',()=>{
      tableau.extensions.ui.closeDialog('CANCEL');
    });
  } catch(error) {
    console.error('[Hierarchy Filter] Konfigurationsdialog:',error);
    message('Konfiguration fehlgeschlagen: '+error.message);
  }
}
main();
