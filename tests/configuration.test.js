import test from 'node:test';
import assert from 'node:assert/strict';
import {parameterOption,normalizeFilterTitle,SETTINGS_KEYS} from '../js/configuration.js';

const modeParameter={
  name:'p.guV_modus',dataType:'string',
  currentValue:{value:'AUSWAHL'},
  allowableValues:{type:'list',allowableValues:[
    {value:'ALLE'},{value:'AUSWAHL'},{value:'KEINE'}
  ]}
};

test('accepts Tableau string mode parameter with all three modes',()=>{
  assert.deepEqual(parameterOption(modeParameter),{
    name:'p.guV_modus',valid:true,reason:''
  });
});

test('rejects mode parameter missing KEINE',()=>{
  const invalid={...modeParameter,allowableValues:{
    type:'list',allowableValues:[{value:'ALLE'},{value:'AUSWAHL'}]
  }};
  assert.equal(parameterOption(invalid).valid,false);
  assert.match(parameterOption(invalid).reason,/KEINE/);
});

test('rejects numeric Tableau parameter',()=>{
  assert.equal(parameterOption({
    name:'p.zahl',dataType:'int',currentValue:{value:1}
  }).valid,false);
});

test('can recognize mode aliases in allowable values',()=>{
  const aliases={...modeParameter,allowableValues:{
    type:'list',allowableValues:[
      {value:'A',formattedValue:'ALLE'},
      {value:'B',formattedValue:'AUSWAHL'},
      {value:'C',formattedValue:'KEINE'}
    ]
  }};
  assert.equal(parameterOption(aliases).valid,true);
});

test('optional title has a separate persisted setting',()=>{
  assert.equal(SETTINGS_KEYS.showTitle,'hierarchyFilter.showTitle');
  assert.equal(normalizeFilterTitle(''), 'Hierarchiefilter');
  assert.equal(normalizeFilterTitle('  Kostenstellen  '), 'Kostenstellen');
});
