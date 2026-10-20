import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../config.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../js/config-dialog.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
test('only optional summary has native picker and manual entry',()=>{
 assert.match(html,/<select id="summary-choice"/);
 assert.match(html,/<input id="summary-parameter" type="text"/);
 assert.doesNotMatch(html,/id="mode-parameter"|id="mode-choice"|<datalist/);
});
test('picker reports returned counts and retrieval errors',()=>{
 assert.match(js,/returnedParameterCount/);
 assert.match(js,/parameterLookupError/);
 assert.match(app,/connector\.listParameterCandidates\(\)/);
});
