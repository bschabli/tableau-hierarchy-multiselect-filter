import test from 'node:test';
import assert from 'node:assert/strict';
import {textParameterOption,normalizeFilterTitle,SETTINGS_KEYS} from '../js/configuration.js';
test('optional summary only: no mode parameter setting',()=>{
 assert.equal(SETTINGS_KEYS.summaryParameter,'hierarchyFilter.summaryParameter');
 assert.equal('parameter' in SETTINGS_KEYS,false);
 assert.equal(SETTINGS_KEYS.showTitle,'hierarchyFilter.showTitle');
});
test('title formatting',()=>{
 assert.equal(normalizeFilterTitle(''),'Hierarchiefilter');
 assert.equal(normalizeFilterTitle('  Kostenstellen  '),'Kostenstellen');
});
test('summary accepts unrestricted text but not lists or numbers',()=>{
 const p={name:'p.zusammenfassung',dataType:'string',currentValue:{value:'Keine'},allowableValues:{type:'all'}};
 assert.equal(textParameterOption(p).valid,true);
 assert.equal(textParameterOption({...p,allowableValues:{type:'list',allowableValues:[{value:'Alle'}]}}).valid,false);
 assert.equal(textParameterOption({...p,dataType:'int'}).valid,false);
});
