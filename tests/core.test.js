import test from 'node:test';
import assert from 'node:assert/strict';
import {membership, rowToLeaf, readLeafSelection, validateLeaves} from '../js/core.js';
import {buildHierarchy, selectedLeafIds, getExpandedKeys} from '../js/hierarchy.js';
import {sameIds, hasPendingChanges} from '../js/selection-state.js';

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

test('draft remains separate from Tableau Set',()=>{
 const saved=new Set(['B']);
 assert.equal(hasPendingChanges(new Set(['B']),saved),false);
 assert.equal(hasPendingChanges(new Set(['A']),saved),true);
 assert.equal(hasPendingChanges(new Set(),saved),true);
 assert.equal(hasPendingChanges(new Set(),new Set()),false);
 assert.equal(sameIds(new Set(['A','B']),new Set(['B','A'])),true);
});

test('Tableau %null% is removed from ragged paths', () => {
  const row = {
    id:{value:'P-1'}, l1:{value:'Produktion',formattedValue:'Produktion'},
    l2:{value:'%null%',formattedValue:'Null'},
    l3:{value:null,formattedValue:'(Null)'},
    l4:{value:'Montage',formattedValue:'Montage'},
    flag:{value:true}
  };
  const encoding = {
    leaf:[{name:'id'}],
    level:[{name:'l1'},{name:'l2'},{name:'l3'},{name:'l4'}],
    membership:[{name:'flag'}]
  };
  const leaf=rowToLeaf(row,encoding,1);
  assert.deepEqual(leaf.levels,['Produktion','Montage']);
  assert.equal(buildHierarchy([leaf]).roots[0].children[0].title,'Montage');
});

test('nativeValue null suppresses formatted Null labels', () => {
  const row={
    id:{value:'P-2'},
    l1:{value:'%null%',nativeValue:null,formattedValue:'Null'},
    l2:{value:'X',nativeValue:'X',formattedValue:'Abteilung X'},
    flag:{value:'IN'}
  };
  const leaf=rowToLeaf(row,{
    leaf:[{name:'id'}],level:[{name:'l1'},{name:'l2'}],
    membership:[{name:'flag'}]
  },2);
  assert.deepEqual(leaf.levels,['Abteilung X']);
});

test('a literal String "Null" is not silently removed', () => {
  const leaf=rowToLeaf({
    id:{value:'A'},level:{value:'Null',formattedValue:'Null'},flag:{value:true}
  },{leaf:[{name:'id'}],level:[{name:'level'}],membership:[{name:'flag'}]},1);
  assert.deepEqual(leaf.levels,['Null']);
});

test('invalid Tableau null ID gets rejected', () => {
  assert.throws(()=>rowToLeaf({
    id:{value:'%null%'},level:{value:'Name'},flag:{value:true}
  },{leaf:[{name:'id'}],level:[{name:'level'}],membership:[{name:'flag'}]},1),/Leere Leaf-ID/);
});

test('missing first hierarchy level becomes an explicit unassigned root', () => {
  const encoding={
    leaf:[{name:'id'}],
    level:[{name:'a'},{name:'b'},{name:'c'}],
    membership:[{name:'set'}]
  };
  const leaves=[
    rowToLeaf({
      id:{value:'001'},a:{value:'%null%',formattedValue:'Null'},
      b:{value:'Team 1'},c:{value:null},set:{value:true}
    },encoding,1),
    rowToLeaf({
      id:{value:'002'},a:{value:null,formattedValue:'(Null)'},
      b:{value:'Team 2'},c:{value:'%null%'},set:{value:false}
    },encoding,2)
  ];
  assert.deepEqual(leaves[0].levels,['Ohne Zuordnung','Team 1']);
  assert.deepEqual(leaves[1].levels,['Ohne Zuordnung','Team 2']);
  const {roots,leafByKey}=buildHierarchy(leaves,new Set(['001']));
  assert.equal(roots.length,1);
  assert.equal(roots[0].title,'Ohne Zuordnung');
  assert.deepEqual(roots[0].children.map(n=>n.title),['Team 1','Team 2']);
  assert.equal(leafByKey.get('l:001').selected,true);
  assert.equal(leafByKey.get('l:002').selected,false);
});

test('fully empty hierarchies still yield selectable leaves under unassigned root', () => {
  const encoding={
    leaf:[{name:'id'}],level:[{name:'a'},{name:'b'}],
    membership:[{name:'set'}]
  };
  const leaves=['A','B'].map((id,index)=>rowToLeaf({
    id:{value:id},a:{value:null},b:{value:'%null%'},
    set:{value:index===0}
  },encoding,index+1));
  const {roots,leafByKey}=buildHierarchy(leaves,new Set(['A']));
  assert.deepEqual(leaves[0].levels,['Ohne Zuordnung','Ohne Bezeichnung']);
  assert.equal(roots.length,1);
  assert.equal(roots[0].title,'Ohne Zuordnung');
  assert.equal(roots[0].children.length,2);
  assert.equal(roots[0].children[0].key,'l:A');
  assert.equal(roots[0].children[1].key,'l:B');
  assert.equal(leafByKey.get('l:A').selected,true);
  assert.equal(leafByKey.get('l:B').selected,false);
});

test('a missing subordinate level is removed without creating another group', () => {
  const leaf=rowToLeaf({
    id:{value:'1'},a:{value:'Vertrieb'},b:{value:null},
    c:{value:'Region Nord'},set:{value:'IN'}
  },{leaf:[{name:'id'}],level:[{name:'a'},{name:'b'},{name:'c'}],
    membership:[{name:'set'}]},1);
  assert.deepEqual(leaf.levels,['Vertrieb','Region Nord']);
});

test('a literal first-level label Null remains a valid label', () => {
  const leaf=rowToLeaf({
    id:{value:'1'},a:{value:'Null',formattedValue:'Null'},
    b:{value:'Kunde A'},set:{value:true}
  },{leaf:[{name:'id'}],level:[{name:'a'},{name:'b'}],
    membership:[{name:'set'}]},1);
  assert.deepEqual(leaf.levels,['Null','Kunde A']);
});

test('a missing hierarchy shelf remains invalid rather than fabricating a root', () => {
  const leaf=rowToLeaf({id:{value:'1'},set:{value:true}},
    {leaf:[{name:'id'}],level:[],membership:[{name:'set'}]},1);
  assert.deepEqual(leaf.levels,[]);
  assert.throws(()=>buildHierarchy([leaf]),/Hierarchiestufen fehlen/);
});

test('every hierarchy branch starts collapsed on initial load',()=>{
  const {roots}=buildHierarchy([
    {id:'a',levels:['A','B','C']},
    {id:'b',levels:['A','B','D']},
    {id:'c',levels:['X','Y']}
  ]);
  const visit=nodes=>{
    for(const node of nodes) {
      if (node.key.startsWith('p:')) assert.equal(node.expanded,false);
      visit(node.children || []);
    }
  };
  visit(roots);
});

test('explicit empty expansion state remains fully collapsed',()=>{
  const {roots}=buildHierarchy([{id:'a',levels:['A','B','C']}],
    new Set(),new Set());
  assert.equal(roots[0].expanded,false);
  assert.equal(roots[0].children[0].expanded,false);
});

test('expanded branches are restored from an in-session snapshot only',()=>{
  const leaves=[{id:'a',levels:['A','B','C']}];
  const first=buildHierarchy(leaves);
  const key=first.roots[0].key;
  const next=buildHierarchy(leaves,new Set(),new Set([key]));
  assert.equal(next.roots[0].expanded,true);
  assert.equal(next.roots[0].children[0].expanded,false);
});
