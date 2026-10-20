/** Tableau API, with a mode parameter chosen independently per Viz instance. */
import {rowToLeaf,readLeafSelection,validateLeaves} from './core.js';
import {parameterOption,textParameterOption,SETTINGS_KEYS,MODE_VALUES} from './configuration.js';

export class TableauConnector {
  constructor({onDataChanged,onModeChanged}={}) {
    this.worksheet=null;
    this.parameter=null;
    this.parameterName='';
    this.summaryParameter=null;
    this.summaryParameterName='';
    this.summaryConfigurationError='';
    this.configurationError='';
    this.onDataChanged=onDataChanged??(()=>{});
    this.onModeChanged=onModeChanged??(()=>{});
    this.parameterHandler=null;
  }

  async initialize(onConfigure) {
    await tableau.extensions.initializeAsync({configure:onConfigure});
    this.worksheet=tableau.extensions.worksheetContent?.worksheet;
    if(!this.worksheet) throw new Error('Diese Anwendung benötigt eine Tableau Viz Extension.');
    this.worksheet.addEventListener(
      tableau.TableauEventType.SummaryDataChanged,()=>this.onDataChanged()
    );
    const savedName=tableau.extensions.settings.get(SETTINGS_KEYS.parameter);
    if(!savedName) return null;
    try {
      await this.chooseParameter(savedName);
      const summaryName=tableau.extensions.settings.get(SETTINGS_KEYS.summaryParameter);
      if (summaryName) {
        try {
          await this.chooseSummaryParameter(summaryName);
        } catch (error) {
          // An optional removed parameter must never stop the primary filter.
          this.summaryConfigurationError=error.message;
          console.warn('[Hierarchy Filter] Zusammenfassung:', error);
        }
      }
      return this.mode;
    } catch(error) {
      // Don't block Configure if the saved parameter has been renamed.
      this.configurationError=error.message;
      return null;
    }
  }

  async listModeParameters() {
    return (await this.worksheet.getParametersAsync())
      .map(parameterOption)
      .filter(item=>item.name)
      .sort((a,b)=>a.name.localeCompare(b.name,'de'));
  }

  async listTextParameters() {
    return (await this.worksheet.getParametersAsync())
      .map(textParameterOption)
      .filter(item => item.name)
      .sort((a,b) => a.name.localeCompare(b.name,'de'));
  }

  async chooseSummaryParameter(name) {
    const normalized=String(name??'').trim();
    if (!normalized) {
      this.summaryParameter=null;
      this.summaryParameterName='';
      this.summaryConfigurationError='';
      return;
    }
    if (normalized===this.parameterName)
      throw new Error('Die Zusammenfassung benötigt einen eigenen Tableau-Parameter.');
    let candidate=null;
    if (typeof this.worksheet.findParameterAsync==='function')
      candidate=await this.worksheet.findParameterAsync(normalized);
    if (!candidate) {
      const parameters=await this.worksheet.getParametersAsync();
      candidate=parameters.find(p=>p.name===normalized);
    }
    if (!candidate)
      throw new Error('Zusammenfassungsparameter "'+normalized+'" nicht gefunden.');
    const option=textParameterOption(candidate);
    if (!option.valid)
      throw new Error('Zusammenfassungsparameter "'+normalized+'": '+option.reason);
    this.summaryParameter=candidate;
    this.summaryParameterName=normalized;
    this.summaryConfigurationError='';
  }

  async writeSummary(value) {
    if (!this.summaryParameter) return false;
    await this.summaryParameter.changeValueAsync(String(value));
    return true;
  }

  async chooseParameter(name) {
    const normalized=String(name??'').trim();
    // A parameter can be absent from the available-parameters list.
    // Resolve explicitly by name before falling back to the collection.
    let candidate=null;
    if(typeof this.worksheet.findParameterAsync==='function') {
      candidate=await this.worksheet.findParameterAsync(normalized);
    }
    if(!candidate) {
      const parameters=await this.worksheet.getParametersAsync();
      candidate=parameters.find(p=>p.name===normalized);
    }
    if(!candidate) throw new Error('Tableau-Parameter "'+normalized+'" nicht gefunden. Falls er neu angelegt wurde, verwende ihn zunächst in einem berechneten Feld im Workbook.');
    const option=parameterOption(candidate);
    if(!option.valid) throw new Error('Parameter "'+normalized+'" ist ungeeignet: '+option.reason);
    if(this.parameter&&this.parameterHandler) {
      this.parameter.removeEventListener(tableau.TableauEventType.ParameterChanged,this.parameterHandler);
    }
    this.parameter=candidate;
    this.parameterName=normalized;
    this.configurationError='';
    this.parameterHandler=async event=>{
      try {
        this.parameter=await event.getParameterAsync();
        this.onModeChanged(this.mode);
      } catch(error) {
        console.warn('[Hierarchy Filter] ParameterChanged',error);
      }
    };
    this.parameter.addEventListener(tableau.TableauEventType.ParameterChanged,this.parameterHandler);
    return this.mode;
  }

  get mode() {
    if(!this.parameter) throw new Error('Bitte zuerst einen Modusparameter konfigurieren.');
    return String(this.parameter.currentValue?.value??'AUSWAHL');
  }

  async changeMode(value) {
    if(!this.parameter) throw new Error('Bitte zuerst einen Modusparameter konfigurieren.');
    if(!MODE_VALUES.includes(value)) throw new Error('Unbekannter Filtermodus: '+value);
    await this.parameter.changeValueAsync(value);
    this.onModeChanged(value);
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
    if(!this.parameter) throw new Error('Bitte zuerst einen Modusparameter konfigurieren.');
    const encodings=await this.getEncodingMap();
    const reader=await this.worksheet.getSummaryDataReaderAsync(undefined,{ignoreSelection:true});
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
    } finally {
      await reader.releaseAsync();
    }
    validateLeaves(leaves);
    return {leaves,selectedIds:readLeafSelection(leaves),mode:this.mode};
  }

  /**
   * Clear a Set through the Tableau Set Action configured with
   * "Clearing the selection: Remove all values from set".
   * A one-mark selection first ensures clearing creates a real event.
   */
  async clearSetViaSelection(leaves) {
    if (!leaves.length) {
      throw new Error('Keine Werte verfügbar, um das Tableau Set zurückzusetzen.');
    }
    await this.worksheet.selectTuplesAsync(
      [leaves[0].tupleId], tableau.SelectOptions.Simple
    );
    if (typeof this.worksheet.clearSelectedMarksAsync === 'function') {
      await this.worksheet.clearSelectedMarksAsync();
    } else {
      // Older Viz Extension implementations may lack the explicit method.
      await this.worksheet.selectTuplesAsync([], tableau.SelectOptions.Simple);
    }
  }

  async selectLeaves(selectedIds,leaves) {
    const tupleIds=leaves.filter(leaf=>selectedIds.has(leaf.id)).map(leaf=>leaf.tupleId);
    await this.worksheet.selectTuplesAsync(tupleIds,tableau.SelectOptions.Simple);
    return tupleIds.length;
  }
}
