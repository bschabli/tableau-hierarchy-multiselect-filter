/** Workbook-persisted configuration, scoped by Tableau to each Viz instance. */
export const MODE_VALUES = ['ALLE','AUSWAHL','KEINE'];
export const SETTINGS_KEYS = Object.freeze({
  parameter: 'hierarchyFilter.modeParameter',
  title: 'hierarchyFilter.title'
});
export function parameterOption(parameter) {
  const name=String(parameter?.name??'');
  const current=parameter?.currentValue?.value;
  if(typeof current!=='string') return {name,valid:false,reason:'Kein Zeichenfolge-Parameter'};
  const list=parameter?.allowableValues?.allowableValues;
  if(Array.isArray(list)) {
    const allowed=new Set(list.map(v=>String(v?.value??'')));
    const missing=MODE_VALUES.filter(v=>!allowed.has(v));
    if(missing.length) return {name,valid:false,reason:'Fehlende Werte: '+missing.join(', ')};
  }
  return {name,valid:true,reason:''};
}
export function normalizeFilterTitle(value) {
  return String(value??'').trim().slice(0,80)||'Hierarchiefilter';
}
