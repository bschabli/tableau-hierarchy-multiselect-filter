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
