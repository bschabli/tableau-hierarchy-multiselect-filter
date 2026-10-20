import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html', import.meta.url),'utf8');
const js=readFileSync(new URL('../js/app.js', import.meta.url),'utf8');
const css=readFileSync(new URL('../css/filter.css', import.meta.url),'utf8');

test('three mode buttons and a textual Apply button remain usable',()=>{
  for(const mode of ['ALLE','AUSWAHL','KEINE']) {
    assert.match(html,new RegExp('data-mode="'+mode+'"'));
  }
  assert.match(html, /id="apply"[^>]*>Anwenden<\/button>/);
});

test('search-only, expand, collapse and reload use labeled inline icons',()=>{
  for(const id of ['reload','search-only','expand-all','collapse-all']) {
    const element=html.match(new RegExp('<button\\b(?=[^>]*id="'+id+'")[^>]*>[\\s\\S]*?<\\/button>'));
    assert.ok(element,'missing icon button '+id);
    assert.match(element[0],/aria-label="[^"]+"/);
    assert.match(element[0],/title="[^"]+"/);
    assert.match(element[0],/<svg\b/);
  }
});

test('replacement icons remain when reload hint changes',()=>{
  assert.doesNotMatch(js,/\$\('reload'\)\.textContent/);
  assert.match(js,/\$\('reload'\)\.setAttribute\('aria-label', reloadHint\)/);
});

test('Wunderbaum row CSS and virtualized row height match',()=>{
  assert.match(js,/rowHeightPx: 26/);
  assert.match(css,/--wb-icon-outer-height: 20px/);
  assert.match(css,/height: 20px/);
  assert.match(css,/--wb-row-outer-height: 26px/);
});

test('search and tree tool controls are on one compact row',()=>{
  assert.match(html,/<div class="search-bar">[\s\S]*class="search-controls"/);
  assert.doesNotMatch(html,/class="tree-actions"/);
  assert.doesNotMatch(js,/\$\('pending'\)/);
});

test('simple tree removes persistent frame and row separators',()=>{
  assert.match(css,/div\.wunderbaum:focus-within/);
  assert.match(css,/border: 0/);
  assert.match(css,/div\.wunderbaum div\.wb-node-list div\.wb-row/);
  assert.match(css,/outline: 1px solid #b3cce5/);
});

test('explicit reload resets expansion; passive updates preserve it',()=>{
  assert.match(js,/function createTree\(resetExpansion = false\)/);
  assert.match(js,/const expandedKeys = resetExpansion/);
  assert.match(js,/createTree\(force\)/);
});
