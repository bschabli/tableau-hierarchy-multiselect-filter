import test from 'node:test';
import assert from 'node:assert/strict';
import {membership, rowToLeaf, readLeafSelection, validateLeaves} from '../js/core.js';

test('Set membership accepts booleans and localized labels', () => {
  assert.equal(membership(true), true);
  assert.equal(membership('In'), true);
  assert.equal(membership('Out'), false);
  assert.equal(membership('Falsch'), false);
  assert.equal(membership('unknown'), null);
});

test('Ragged hierarchy rows', () => {
  const m = {leaf:[{name:'id'}],level:[{name:'level0'}, {name:'level1'}],membership:[{name:'set'}]};
  const r = {id:{value:'L004'},level0:{value:'Company'},level1:{value:null},set:{value:true}};
  assert.deepEqual(rowToLeaf(r,m,7),{id:'L004',path:'Company',tupleId:7,inSet:true});
});

test('Read membership and reject unreadable state', () => {
  assert.deepEqual([...readLeafSelection([{id:'A',inSet:true},{id:'B',inSet:false}])],['A']);
  assert.throws(() => readLeafSelection([{id:'A',inSet:null}]),/nicht lesbar/);
});

test('Reject duplicate leaves', () => {
  assert.throws(() => validateLeaves([{id:'A'},{id:'A'}]),/mehrfach/);
});
