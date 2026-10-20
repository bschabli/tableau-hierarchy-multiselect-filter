import test from 'node:test';
import assert from 'node:assert/strict';
import {membership, rowToLeaf, readLeafSelection, validateLeaves} from '../js/core.js';
import {buildHierarchy, selectedLeafIds, getExpandedKeys} from '../js/hierarchy.js';
import {sameIds, effectiveSelection, resolveApplyState, hasPendingChanges} from '../js/selection-state.js';

test('reads Tableau set membership correctly', () => {
  assert.equal(membership('IN'), true);
  assert.equal(membership('OUT'), false);
  assert.deepEqual(
    [...readLeafSelection([{id:'A',inSet:true},{id:'B',inSet:false}])], ['A']
  );
});

test('uses only populated hierarchy levels', () => {
  const leaf = rowToLeaf(
    {id:{value:'ID-102'},a:{value:'Kostenstellen'},b:{value:null},
      c:{value:'Produktion'},membership:{value:true}},
    {leaf:[{name:'id'}],level:[{name:'a'},{name:'b'},{name:'c'}],
      membership:[{name:'membership'}]},1
  );
  assert.deepEqual(leaf.levels, ['Kostenstellen','Produktion']);
  assert.equal(leaf.id,'ID-102');
});

test('leaf ID is not rendered as another level', () => {
  const leaf={id:'4711',levels:['Organisation','Abteilung','Montage']};
  const {roots,leafByKey}=buildHierarchy([leaf],new Set(['4711']));
  assert.equal(roots[0].title,'Organisation');
  assert.equal(roots[0].children[0].title,'Abteilung');
  assert.equal(roots[0].children[0].children[0].title,'Montage');
  assert.equal(roots[0].children[0].children[0].key,'l:4711');
  assert.equal(roots[0].children[0].children[0].children,undefined);
  assert.equal(leafByKey.get('l:4711').selected,true);
});

test('one-level hierarchy shows the level name, not the id', () => {
  const {roots}=buildHierarchy([{id:'X42',levels:['Kostenstelle A']}]);
  assert.deepEqual(roots.map(n=>n.title),['Kostenstelle A']);
  assert.equal(roots[0].key,'l:X42');
});

test('ragged hierarchy groups only actual ancestors', () => {
  const leaves=[
    {id:'1',levels:['A']},
    {id:'2',levels:['A','B']},
    {id:'3',levels:['A','C','D']}
  ];
  const {roots}=buildHierarchy(leaves,new Set(['2']));
  // Standalone 'A' and group 'A' are distinct Tableau objects.
  assert.equal(roots.filter(n=>n.title==='A').length,2);
  const group=roots.find(n=>n.key.startsWith('p:'));
  assert.deepEqual(group.children.map(n=>n.title),['B','C']);
  assert.equal(group.children[0].selected,true);
  assert.equal(group.children[1].children[0].title,'D');
});

test('identical labels in distinct branches are different objects',()=>{
  const {roots}=buildHierarchy([
    {id:'x',levels:['A','X']},{id:'y',levels:['B','X']}
  ]);
  assert.equal(roots[0].children[0].title,'X');
  assert.notEqual(roots[0].children[0].key,roots[1].children[0].key);
});

test('identical full paths with different Leaf IDs stay independently selectable',()=>{
  const {roots,leafByKey}=buildHierarchy([
    {id:'a',levels:['A','X']},{id:'b',levels:['A','X']}
  ],new Set(['b']));
  assert.equal(roots.length,1);
  assert.equal(roots[0].children.length,2);
  assert.equal(leafByKey.get('l:a').selected,false);
  assert.equal(leafByKey.get('l:b').selected,true);
  const fakeTree=[{key:'p:["A"]',selected:false},
    {key:'l:a',selected:false},{key:'l:b',selected:true}];
  assert.deepEqual([...selectedLeafIds(fakeTree)],['b']);
});

test('duplicate Leaf IDs are rejected by Tableau preflight',()=>{
  assert.throws(()=>validateLeaves([{id:'a'},{id:'a'}]));
  assert.throws(()=>buildHierarchy([{id:'a',levels:['A']},{id:'a',levels:['B']}]));
});

test('hierarchy level must be present',()=>{
  assert.throws(()=>buildHierarchy([{id:'id',levels:[]}]),/Hierarchiestufen fehlen/);
});

test('expansion state persists when rebuilding',()=>{
  const leaves=[
    {id:'a',levels:['Dept A','Team 1']},
    {id:'b',levels:['Dept A','Team 2']},
    {id:'c',levels:['Dept B','Team 1']}
  ];
  const first=buildHierarchy(leaves);
  const keys=getExpandedKeys([
    {key:first.roots[0].key,expanded:false},
    {key:first.roots[1].key,expanded:true}
  ]);
  const next=buildHierarchy(leaves,new Set(['c']),keys);
  assert.equal(next.roots[0].expanded,false);
  assert.equal(next.roots[1].expanded,true);
  assert.equal(next.leafByKey.get('l:c').selected,true);
});

test('draft selections and filter modes',()=>{
  const leaves=[{id:'A'},{id:'B'},{id:'C'}];
  const saved=new Set(['B']);
  assert.deepEqual([...effectiveSelection('ALLE',saved,leaves)],['B']);
  assert.deepEqual([...effectiveSelection('KEINE',saved,leaves)],['B']);
  assert.equal(hasPendingChanges('AUSWAHL',new Set(['B']),'AUSWAHL',saved,leaves),false);
  assert.equal(hasPendingChanges('AUSWAHL',new Set(['A']),'AUSWAHL',saved,leaves),true);
  assert.equal(sameIds(new Set(['A','B']),new Set(['B','A'])),true);
});


test('Alle writes all Set members and checks all boxes', () => {
  const leaves=[{id:'A'},{id:'B'},{id:'C'}];
  const result=resolveApplyState('ALLE',new Set(),leaves);
  assert.equal(result.mode,'ALLE');
  assert.deepEqual([...result.setIds],['A','B','C']);
  assert.deepEqual([...result.checkedIds],['A','B','C']);
});

test('Keine writes an empty Set and unchecks all boxes', () => {
  const leaves=[{id:'A'},{id:'B'}];
  const result=resolveApplyState('KEINE',new Set(['A']),leaves);
  assert.equal(result.mode,'KEINE');
  assert.deepEqual([...result.setIds],[]);
  assert.deepEqual([...result.checkedIds],[]);
});

test('AUSWAHL writes exactly the checked values', () => {
  const leaves=[{id:'A'},{id:'B'},{id:'C'}];
  const result=resolveApplyState('AUSWAHL',new Set(['A','C']),leaves);
  assert.equal(result.mode,'AUSWAHL');
  assert.deepEqual([...result.setIds],['A','C']);
  assert.deepEqual([...result.checkedIds],['A','C']);
});

test('empty AUSWAHL does not silently become ALLE', () => {
  const result=resolveApplyState('AUSWAHL',new Set(),[{id:'A'}]);
  assert.equal(result.mode,'AUSWAHL');
  assert.equal(result.setIds.size,0);
  assert.equal(result.checkedIds.size,0);
});

test('UI displays actual Tableau Set membership even in Alle or Keine modes', () => {
  const saved=new Set(['B']);
  assert.deepEqual([...effectiveSelection('ALLE',saved)],['B']);
  assert.deepEqual([...effectiveSelection('KEINE',saved)],['B']);
});

test('changes are pending until the full intended set is in Tableau', () => {
  const full=new Set(['A','B']);
  const partial=new Set(['A']);
  assert.equal(hasPendingChanges('ALLE',full,'ALLE',partial),true);
  assert.equal(hasPendingChanges('KEINE',new Set(),'ALLE',full),true);
  assert.equal(hasPendingChanges('KEINE',new Set(),'KEINE',new Set()),false);
  assert.equal(hasPendingChanges('AUSWAHL',partial,'AUSWAHL',partial),false);
});
