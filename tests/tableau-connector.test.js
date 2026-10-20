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
