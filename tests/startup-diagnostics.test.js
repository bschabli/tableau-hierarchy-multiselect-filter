import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const script = readFileSync(new URL('../js/startup-diagnostics.js', import.meta.url), 'utf8');

function createHarness() {
  const events = new Map();
  const status = {
    textContent: '',
    error: false,
    classList: {add() {status.error = true;}}
  };
  class ScriptElement {}
  class BrowserErrorEvent {
    constructor(message) {
      this.message = message;
      this.target = null;
    }
  }
  const context = {
    document: {getElementById: id => id === 'status' ? status : null},
    window: {
      addEventListener: (name, listener) => events.set(name, listener),
      setTimeout: () => 0
    },
    HTMLScriptElement: ScriptElement,
    ErrorEvent: BrowserErrorEvent,
    URL, Date, console
  };
  runInNewContext(script, context);
  return {status, send: message => events.get('error')(new BrowserErrorEvent(message))};
}

test('intermittent Chrome ResizeObserver warning is not presented as fatal', () => {
  const app = createHarness();
  app.send('ResizeObserver loop limit exceeded');
  assert.equal(app.status.textContent, 'Lade Filter-Modul ...');
  assert.equal(app.status.error, false);
});

test('standard ResizeObserver notification warning does not replace status', () => {
  const app = createHarness();
  app.send('ResizeObserver loop completed with undelivered notifications.');
  assert.equal(app.status.error, false);
});

test('other browser errors remain visible', () => {
  const app = createHarness();
  app.send('Uncaught TypeError: missing value');
  assert.match(app.status.textContent, /TypeError: missing value/);
  assert.equal(app.status.error, true);
});

test('repeated resize warnings are surfaced as a layout issue', () => {
  const app = createHarness();
  for (let i = 0; i < 15; i++) app.send('ResizeObserver loop limit exceeded');
  assert.match(app.status.textContent, /Wiederholte ResizeObserver-Schleife/);
  assert.equal(app.status.error, true);
});
