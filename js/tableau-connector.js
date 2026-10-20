/** Tableau connection: only the Set Action is required. */
import {rowToLeaf,readLeafSelection,validateLeaves} from './core.js';
import {textParameterOption,SETTINGS_KEYS} from './configuration.js';

export class TableauConnector {
  constructor({onDataChanged}={}) {
    this.worksheet=null;
    this.summaryParameter=null;
    this.summaryParameterName='';
    this.summaryConfigurationError='';
    this.onDataChanged=onDataChanged??(()=>{});
  }

  async initialize(onConfigure) {
    await tableau.extensions.initializeAsync({configure:onConfigure});
    this.worksheet=tableau.extensions.worksheetContent?.worksheet;
    if(!this.worksheet) throw new Error('Diese Anwendung benötigt eine Tableau Viz Extension.');
    this.worksheet.addEventListener(
      tableau.TableauEventType.SummaryDataChanged,()=>this.onDataChanged()
    );
    const summaryName=tableau.extensions.settings.get(SETTINGS_KEYS.summaryParameter);
    if(summaryName) {
      try {await this.chooseSummaryParameter(summaryName);}
      catch(error) {
        this.summaryConfigurationError=error.message;
        console.warn('[Hierarchy Filter] Zusammenfassung:',error);
      }
    }
  }

  async listParameterCandidates() {
    if(!this.worksheet||typeof this.worksheet.getParametersAsync!=='function')
      throw new Error('Tableau stellt die Parameterliste in dieser Ansicht nicht bereit.');
    const found=await this.worksheet.getParametersAsync();
    if(!Array.isArray(found))
      throw new Error('Tableau hat keine gültige Parameterliste geliefert.');
    const byName=new Map();
    for(const param of found) if(param?.name) byName.set(param.name,param);
    if(this.summaryParameter?.name&&!byName.has(this.summaryParameter.name))
      byName.set(this.summaryParameter.name,this.summaryParameter);
    return {
      summaryParameters:[...byName.values()].map(textParameterOption)
        .filter(item=>item.name).sort((a,b)=>a.name.localeCompare(b.name,'de')),
      returnedCount:found.length
    };
  }

  async chooseSummaryParameter(name) {
    const normalized=String(name??'').trim();
    if(!normalized) {
      this.summaryParameter=null;
      this.summaryParameterName='';
      this.summaryConfigurationError='';
      return;
    }
    let candidate=null;
    if(typeof this.worksheet.findParameterAsync==='function')
      candidate=await this.worksheet.findParameterAsync(normalized);
    if(!candidate) {
      const parameters=await this.worksheet.getParametersAsync();
      candidate=parameters.find(p=>p.name===normalized);
    }
    if(!candidate)
      throw new Error('Zusammenfassungsparameter "'+normalized+'" nicht gefunden.');
    const option=textParameterOption(candidate);
    if(!option.valid)
      throw new Error('Zusammenfassungsparameter "'+normalized+'": '+option.reason);
    this.summaryParameter=candidate;
    this.summaryParameterName=normalized;
    this.summaryConfigurationError='';
  }

  async writeSummary(value) {
    if(!this.summaryParameter) return false;
    await this.summaryParameter.changeValueAsync(String(value));
    return true;
  }

  async getEncodingMap() {
    const spec=await this.worksheet.getVisualSpecificationAsync();
    const index=spec.activeMarksSpecificationIndex;
    if(index<0) throw new Error('Kein aktiver Marks-Typ.');
    const encodings={};
    for(const entry of spec.marksSpecifications[index].encodings)
      (encodings[entry.id]??=[]).push(entry.field);
    if(!encodings.leaf?.length||!encodings.membership?.length)
      throw new Error('Leaf ID und Set-Mitgliedschaft müssen auf dem Marks-Shelf liegen.');
    return encodings;
  }

  async readState() {
    const encodings=await this.getEncodingMap();
    const reader=await this.worksheet.getSummaryDataReaderAsync(
      undefined,{ignoreSelection:true}
    );
    const leaves=[];
    try {
      for(let pageIndex=0;pageIndex<reader.pageCount;pageIndex++){
        const page=await reader.getPageAsync(pageIndex);
        for(const cells of page.data) {
          const row={};
          for(const column of page.columns) row[column.fieldName]=cells[column.index];
          leaves.push(rowToLeaf(row,encodings,leaves.length+1));
        }
      }
    } finally {await reader.releaseAsync();}
    validateLeaves(leaves);
    return {leaves,selectedIds:readLeafSelection(leaves)};
  }

  async clearSetViaSelection(leaves) {
    if(!leaves.length)
      throw new Error('Keine Werte verfügbar, um das Tableau Set zurückzusetzen.');
    // Requires "Clearing the selection: Remove all values from set" in Tableau.
    await this.worksheet.selectTuplesAsync([leaves[0].tupleId],tableau.SelectOptions.Simple);
    if(typeof this.worksheet.clearSelectedMarksAsync==='function') {
      await this.worksheet.clearSelectedMarksAsync();
    } else {
      await this.worksheet.selectTuplesAsync([],tableau.SelectOptions.Simple);
    }
  }

  async selectLeaves(selectedIds,leaves) {
    const tupleIds=leaves.filter(leaf=>selectedIds.has(leaf.id)).map(leaf=>leaf.tupleId);
    await this.worksheet.selectTuplesAsync(tupleIds,tableau.SelectOptions.Simple);
    return tupleIds.length;
  }
}
