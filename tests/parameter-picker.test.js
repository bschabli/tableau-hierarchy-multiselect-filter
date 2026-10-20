import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../config.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../js/config-dialog.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');

test('both parameters use real native selects instead of WebView-sensitive datalists',()=>{
  assert.match(html,/<select id="mode-choice"/);
  assert.match(html,/<select id="summary-choice"/);
  assert.doesNotMatch(html,/<datalist/);
});

test('manual entry is available for both fields',()=>{
  assert.match(html,/<input id="mode-parameter" type="text"/);
  assert.match(html,/<input id="summary-parameter" type="text"/);
});

test('picker reports loaded counts and retrieval errors',()=>{
  assert.match(js,/returnedParameterCount/);
  assert.match(js,/parameterLookupError/);
  assert.match(app,/connector\.listParameterCandidates\(\)/);
  assert.doesNotMatch(app,/connector\.listModeParameters\(\)\.catch/);
});
