/** Workbook settings, scoped by Tableau to this Viz Extension instance. */
export const SETTINGS_KEYS=Object.freeze({
  summaryParameter:'hierarchyFilter.summaryParameter',
  title:'hierarchyFilter.title',
  showTitle:'hierarchyFilter.showTitle'
});
export function normalizeFilterTitle(value) {
  return String(value??'').trim().slice(0,80)||'Hierarchiefilter';
}
export function textParameterOption(parameter) {
  const name=String(parameter?.name??'');
  const type=String(parameter?.dataType??'').toLowerCase();
  if((type&&type!=='string')||(!type&&typeof parameter?.currentValue?.value!=='string'))
    return {name,valid:false,reason:'Kein Textparameter'};
  const domain=parameter?.allowableValues;
  const domainType=String(domain?.type??'').toLowerCase();
  if((Array.isArray(domain?.allowableValues)&&domain.allowableValues.length>0)||
    (domainType&&domainType!=='all'))
    return {name,valid:false,reason:'Muss alle Zeichenfolgen zulassen (keine Liste)'};
  return {name,valid:true,reason:''};
}
