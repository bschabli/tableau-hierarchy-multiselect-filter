const form=document.getElementById('config-form');
const title=document.getElementById('filter-title');
const select=document.getElementById('mode-parameter');
const message=text=>{document.getElementById('config-status').textContent=text;};
async function main(){
  try {
    const payload=JSON.parse(await tableau.extensions.initializeDialogAsync());
    title.value=String(payload.title??'');
    let valid=0;
    for(const option of payload.parameters??[]) {
      const el=document.createElement('option');
      el.value=option.name;
      el.textContent=option.valid?option.name:option.name+' ('+option.reason+')';
      el.disabled=!option.valid;
      select.appendChild(el);
      if(option.valid) valid++;
    }
    select.value=payload.parameterName??'';
    if(!select.value) select.value='';
    if(!valid) {
      message('Kein passender Parameter gefunden. Lege zuerst einen Zeichenfolge-Parameter mit ALLE, AUSWAHL und KEINE an.');
      document.getElementById('save').disabled=true;
    }
    form.addEventListener('submit',event=>{
      event.preventDefault();
      if(!select.value) {message('Bitte einen Modusparameter auswählen.');return;}
      tableau.extensions.ui.closeDialog(JSON.stringify({
        parameterName:select.value,title:title.value
      }));
    });
    document.getElementById('cancel').addEventListener('click',()=>{
      tableau.extensions.ui.closeDialog('CANCEL');
    });
  }catch(error) {message('Konfiguration fehlgeschlagen: '+error.message);}
}
main();
