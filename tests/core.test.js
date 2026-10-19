import test from 'node:test';import assert from 'node:assert/strict';
import {membership,rowToLeaf,readLeafSelection,validateLeaves} from '../js/core.js';
import {buildHierarchy} from '../js/hierarchy.js';
test('set membership',()=>{assert.equal(membership('IN'),true);assert.equal(membership('OUT'),false);});
test('ragged leaf',()=>{const x=rowToLeaf({id:{value:'X'},a:{value:'A'},b:{value:null},set:{value:true}},{leaf:[{name:'id'}],level:[{name:'a'},{name:'b'}],membership:[{name:'set'}]},1);assert.deepEqual(x.levels,['A']);});
test('selection',()=>{assert.deepEqual([...readLeafSelection([{id:'A',inSet:true},{id:'B',inSet:false}])],['A']);});
test('duplicate leaves rejected',()=>{assert.throws(()=>validateLeaves([{id:'a'},{id:'a'}]));});
test('ragged siblings and parent + direct leaf',()=>{const leaves=[{id:'1',levels:['A']},{id:'2',levels:['A','B']},{id:'3',levels:['A','B']}];const {roots}=buildHierarchy(leaves,new Set(['2']));assert.equal(roots.length,1);assert.equal(roots[0].children.length,2);assert.equal(roots[0].children[1].children[0].selected,true);});
test('identical labels with different parent paths',()=>{const {roots}=buildHierarchy([{id:'x',levels:['A','X']},{id:'y',levels:['B','X']}]);assert.notEqual(roots[0].children[0].key,roots[1].children[0].key);});
