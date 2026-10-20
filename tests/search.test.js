import test from 'node:test';
import assert from 'node:assert/strict';
import {buildHierarchy} from '../js/hierarchy.js';
import {findSearchBranches, searchDisplayMode} from '../js/tree-search.js';

const leaves = [
  {id:'111', levels:['Produktion','Montage','Kostenstelle Berlin']},
  {id:'112', levels:['Produktion','Montage','Kostenstelle Leipzig']},
  {id:'211', levels:['Vertrieb','Regional','Berlin']},
  {id:'222', levels:['Vertrieb','Regional','München']}
];

test('search expands every parent with a matching descendant across branches', () => {
  const {roots} = buildHierarchy(leaves);
  const result = findSearchBranches(roots, 'berlin');
  assert.equal(result.count, 2);
  const titles = [];
  function collect(nodes) { for (const node of nodes) {
    if (result.expandKeys.has(node.key)) titles.push(node.title);
    collect(node.children || []);
  }}
  collect(roots);
  assert.deepEqual(titles, ['Produktion', 'Montage', 'Vertrieb', 'Regional']);
});

test('matching parent is itself expanded', () => {
  const {roots} = buildHierarchy(leaves);
  const result = findSearchBranches(roots, 'MONTAGE');
  assert.equal(result.count, 1);
  assert.equal(result.expandKeys.has(roots[0].key), true);
  assert.equal(result.expandKeys.has(roots[0].children[0].key), true);
});

test('matches use visible labels, not technical IDs', () => {
  const {roots} = buildHierarchy(leaves);
  const result = findSearchBranches(roots, '111');
  assert.equal(result.count, 0);
  assert.equal(result.expandKeys.size, 0);
});

test('search does not alter the checkbox state', () => {
  const {roots} = buildHierarchy(leaves, new Set(['112']));
  findSearchBranches(roots, 'Berlin');
  const montage = roots[0].children[0];
  assert.equal(montage.children[0].selected, false);
  assert.equal(montage.children[1].selected, true);
});

test('case-insensitive substring matching and empty search', () => {
  const {roots} = buildHierarchy(leaves);
  assert.equal(findSearchBranches(roots, 'STELLE').count, 2);
  assert.equal(findSearchBranches(roots, '   ').count, 0);
  assert.equal(findSearchBranches(roots, '   ').expandKeys.size, 0);
});

test('search visibility toggle uses Wunderbaum mark/hide modes', () => {
  assert.equal(searchDisplayMode(false), 'mark');
  assert.equal(searchDisplayMode(true), 'hide');
});

test('switching search visibility does not change which branches match', () => {
  const {roots} = buildHierarchy(leaves, new Set(['112']));
  const before = findSearchBranches(roots, 'berlin');
  const mode = searchDisplayMode(true);
  const after = findSearchBranches(roots, 'berlin');
  assert.equal(mode, 'hide');
  assert.deepEqual(after.expandKeys, before.expandKeys);
  assert.equal(after.count, before.count);
  assert.equal(roots[0].children[0].children[1].selected, true);
});
