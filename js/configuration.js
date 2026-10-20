/** Workbook-persisted configuration, scoped by Tableau to each Viz instance. */
export const MODE_VALUES = ['ALLE','AUSWAHL','KEINE'];
export const SETTINGS_KEYS = Object.freeze({
  parameter: 'hierarchyFilter.modeParameter',
  summaryParameter: 'hierarchyFilter.summaryParameter',
  title: 'hierarchyFilter.title',
  showTitle: 'hierarchyFilter.showTitle'
});
export function parameterOption(parameter) {
  const name=String(parameter?.name??'');
  const dataType=String(parameter?.dataType??'').toLowerCase();
  const current=parameter?.currentValue?.value;
  if(dataType && dataType!=='string') {
    return {name,valid:false,reason:'Kein Zeichenfolge-Parameter'};
  }
  if(!dataType && typeof current!=='string') {
    return {name,valid:false,reason:'Kein Zeichenfolge-Parameter'};
  }
  const list=parameter?.allowableValues?.allowableValues;
  if(Array.isArray(list)) {
    const allowed=new Set(list.flatMap(v=>[
      String(v?.value??''), String(v?.formattedValue??'')
    ]));
    const missing=MODE_VALUES.filter(v=>!allowed.has(v));
    if(missing.length) return {name,valid:false,reason:'Fehlende Werte: '+missing.join(', ')};
  }
  return {name,valid:true,reason:''};
}
export function normalizeFilterTitle(value) {
  return String(value??'').trim().slice(0,80)||'Hierarchiefilter';
}

/** A summary parameter must be a string accepting arbitrary text (not a fixed list). */
export function textParameterOption(parameter) {
  const name = String(parameter?.name ?? '');
  const type = String(parameter?.dataType ?? '').toLowerCase();
  if ((type && type !== 'string') ||
      (!type && typeof parameter?.currentValue?.value !== 'string')) {
    return {name, valid: false, reason: 'Kein Textparameter'};
  }
  const domain = parameter?.allowableValues;
  const domainType = String(domain?.type ?? '').toLowerCase();
  if ((Array.isArray(domain?.allowableValues) && domain.allowableValues.length > 0) ||
      (domainType && domainType !== 'all')) {
    return {name, valid: false, reason: 'Muss alle Zeichenfolgen zulassen (keine Liste)'};
  }
  return {name, valid: true, reason: ''};
}
