import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeFilterSelection} from '../js/filter-summary.js';

const leaves=[
  {id:'1',levels:['Produktion','Montage','Berlin']},
  {id:'2',levels:['Produktion','Montage','Leipzig']},
  {id:'3',levels:['Vertrieb','Nord']},
  {id:'4',levels:['Vertrieb','Süd']},
  {id:'5',levels:['Verwaltung','Einkauf']}
];

test('special cases: complete and empty sets',()=>{
  assert.equal(summarizeFilterSelection(leaves,new Set()),'Keine');
  assert.equal(summarizeFilterSelection(leaves,new Set(leaves.map(l=>l.id))),'Alle');
});

test('fully selected branches collapse to one readable name',()=>{
  assert.equal(summarizeFilterSelection(leaves,new Set(['1','2','3'])),
    'Produktion, Vertrieb › Nord');
});

test('partial selection keeps parent path for disambiguation',()=>{
  assert.equal(summarizeFilterSelection(leaves,new Set(['1','4'])),
    'Produktion › Montage › Berlin, Vertrieb › Süd');
});

test('literal same-name siblings remain selected by distinct IDs',()=>{
  const duplicate=[{id:'a',levels:['A','Berlin']},{id:'b',levels:['B','Berlin']}];
  assert.equal(summarizeFilterSelection(duplicate,new Set(['b'])),'B');
});

test('text is bounded and reports omitted groups',()=>{
  const broad=Array.from({length:100},(_,i)=>({
    id:String(i),levels:['Bereich'+String(i).padStart(3,'0')]
  }));
  const result=summarizeFilterSelection(broad,
    new Set(broad.slice(0,75).map(l=>l.id)),100);
  assert.ok(result.length<=100,'string length '+result.length);
  assert.match(result,/weitere/);
});
