import test from 'node:test';
import assert from 'node:assert/strict';
import {membership, rowToLeaf, readLeafSelection, validateLeaves} from '../js/core.js';
import {buildHierarchy} from '../js/hierarchy.js';
import {sameIds, effectiveSelection, hasPendingChanges} from '../js/selection-state.js';

test('set membership', () => {
  assert.equal(membership('IN'), true);
  assert.equal(membership('OUT'), false);
});
test('ragged leaf', () => {
  const x = rowToLeaf(
    {id:{value:'X'}, a:{value:'A'}, b:{value:null}, set:{value:true}},
    {leaf:[{name:'id'}], level:[{name:'a'},{name:'b'}], membership:[{name:'set'}]},
    1
  );
  assert.deepEqual(x.levels, ['A']);
});
test('selection', () => {
  assert.deepEqual([...readLeafSelection([{id:'A',inSet:true},{id:'B',inSet:false}])], ['A']);
});
test('duplicate leaves rejected', () => {
  assert.throws(() => validateLeaves([{id:'a'},{id:'a'}]));
});
test('ragged siblings and parent + direct leaf', () => {
  const leaves = [{id:'1',levels:['A']},{id:'2',levels:['A','B']},{id:'3',levels:['A','B']}];
  const {roots} = buildHierarchy(leaves, new Set(['2']));
  assert.equal(roots.length, 1);
  assert.equal(roots[0].children.length, 2);
  assert.equal(roots[0].children[1].children[0].selected, true);
});
test('identical labels with different parents', () => {
  const {roots} = buildHierarchy([{id:'x',levels:['A','X']},{id:'y',levels:['B','X']}]);
  assert.notEqual(roots[0].children[0].key, roots[1].children[0].key);
});
const leaves = [{id:'A'},{id:'B'},{id:'C'}];
const saved = new Set(['B']);
test('Alle and Keine are local effective selections', () => {
  assert.deepEqual([...effectiveSelection('ALLE', saved, leaves)], ['A','B','C']);
  assert.deepEqual([...effectiveSelection('KEINE', saved, leaves)], []);
  assert.deepEqual([...saved], ['B']);
});
test('Checkbox edits remain pending until apply', () => {
  assert.equal(hasPendingChanges('AUSWAHL', new Set(['A','B']), 'AUSWAHL', saved, leaves), true);
  assert.equal(hasPendingChanges('AUSWAHL', new Set(['B']), 'AUSWAHL', saved, leaves), false);
});
test('Mode changes remain pending until apply', () => {
  assert.equal(hasPendingChanges('ALLE', new Set(['A','B','C']), 'AUSWAHL', saved, leaves), true);
  assert.equal(hasPendingChanges('ALLE', new Set(['A','B','C']), 'ALLE', saved, leaves), false);
  assert.equal(hasPendingChanges('KEINE', new Set(), 'KEINE', saved, leaves), false);
});
test('Set comparisons ignore order', () => {
  assert.equal(sameIds(new Set(['A','B']), new Set(['B','A'])), true);
  assert.equal(sameIds(new Set(['A']), new Set(['B'])), false);
});
