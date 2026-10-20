import test from 'node:test';
import assert from 'node:assert/strict';
import {TableauConnector} from '../js/tableau-connector.js';

test('Keine clears a Tableau Set by selecting a mark and clearing it', async () => {
  const calls=[];
  globalThis.tableau={SelectOptions:{Simple:'simple'}};
  const connector=new TableauConnector();
  connector.worksheet={
    async selectTuplesAsync(ids,option) {calls.push(['select',ids,option]);},
    async clearSelectedMarksAsync(){calls.push(['clear']);}
  };
  await connector.clearSetViaSelection([{id:'A',tupleId:42}]);
  assert.deepEqual(calls,[['select',[42],'simple'],['clear']]);
});

test('fallback clears selection on older Viz Extension API', async () => {
  const calls=[];
  globalThis.tableau={SelectOptions:{Simple:'simple'}};
  const connector=new TableauConnector();
  connector.worksheet={
    async selectTuplesAsync(ids){calls.push(ids);}
  };
  await connector.clearSetViaSelection([{id:'B',tupleId:13}]);
  assert.deepEqual(calls,[[13],[]]);
});

test('cannot clear Set with no source marks', async () => {
  const connector=new TableauConnector();
  connector.worksheet={};
  await assert.rejects(connector.clearSetViaSelection([]),/Keine Werte verfügbar/);
});

test('writes the configured free-text summary independently of mode parameter', async () => {
  const calls=[];
  const connector=new TableauConnector();
  connector.worksheet={
    async findParameterAsync(name) {
      return {name, dataType:'string',currentValue:{value:''},
        allowableValues:{type:'all'},
        async changeValueAsync(value){calls.push([name,value]);}};
    }
  };
  connector.parameterName='p.kostenstellen_filter_modus';
  await connector.chooseSummaryParameter('p.kostenstellen_zusammenfassung');
  assert.equal(await connector.writeSummary('Produktion, Einkauf'),true);
  assert.deepEqual(calls,[['p.kostenstellen_zusammenfassung','Produktion, Einkauf']]);
  await connector.chooseSummaryParameter('');
  assert.equal(await connector.writeSummary('Keine'),false);
});

test('rejects summary parameter with same name as mode', async () => {
  const connector=new TableauConnector();
  connector.parameterName='p.filter_modus';
  await assert.rejects(connector.chooseSummaryParameter('p.filter_modus'),
    /eigenen Tableau-Parameter/);
});

test('parameter suggestions are fetched once and categorized for both selectors',async()=>{
  const connector=new TableauConnector();
  let requests=0;
  connector.worksheet={
    async getParametersAsync() {
      requests++;
      return [
        {name:'p.modus',dataType:'string',currentValue:{value:'AUSWAHL'},
          allowableValues:{type:'list',allowableValues:[
            {value:'ALLE'},{value:'AUSWAHL'},{value:'KEINE'}]}},
        {name:'p.zusammenfassung',dataType:'string',currentValue:{value:'Keine'},
          allowableValues:{type:'all'}},
        {name:'p.anzahl',dataType:'int',currentValue:{value:5}}
      ];
    }
  };
  const result=await connector.listParameterCandidates();
  assert.equal(requests,1);
  assert.equal(result.returnedCount,3);
  assert.equal(result.parameters.find(p=>p.name==='p.modus').valid,true);
  assert.equal(result.summaryParameters.find(p=>p.name==='p.zusammenfassung').valid,true);
  assert.equal(result.summaryParameters.find(p=>p.name==='p.anzahl').valid,false);
});

test('already configured parameter remains a suggestion if bulk list is incomplete',async()=>{
  const connector=new TableauConnector();
  connector.worksheet={async getParametersAsync(){return [];}};
  connector.parameter={name:'p.vorhanden',dataType:'string',currentValue:{value:'ALLE'},
    allowableValues:{type:'list',allowableValues:[
      {value:'ALLE'},{value:'AUSWAHL'},{value:'KEINE'}]}};
  const result=await connector.listParameterCandidates();
  assert.equal(result.returnedCount,0);
  assert.equal(result.parameters.length,1);
  assert.equal(result.parameters[0].name,'p.vorhanden');
});

test('parameter API errors are reported and not replaced by empty suggestions',async()=>{
  const connector=new TableauConnector();
  connector.worksheet={async getParametersAsync(){throw new Error('API nicht verfügbar');}};
  await assert.rejects(connector.listParameterCandidates(),/API nicht verfügbar/);
});
