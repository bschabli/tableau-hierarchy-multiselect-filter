// Classic script intentionally runs independently of the ES module.
// Makes import/syntax/load failures visible instead of leaving the startup label unchanged.
(() => {
  function show(message) {
    const status = document.getElementById('status');
    if (!status) return;
    status.textContent = message;
    status.classList.add('error');
  }

  window.addEventListener('error', event => {
    const script = event.target instanceof HTMLScriptElement ? event.target : null;
    if (script) {
      show('Ladefehler: ' + new URL(script.src).pathname);
      return;
    }
    if (event instanceof ErrorEvent && event.message) {
      show('JavaScript-Fehler: ' + event.message);
    }
  }, true);

  window.addEventListener('unhandledrejection', event => {
    show('JavaScript-Fehler: ' + (event.reason?.message || String(event.reason)));
  });

  window.setTimeout(() => {
    if (!window.__hierarchyAppStarted) {
      show('Filter-Modul konnte nicht starten. Bitte GitHub-Pages-Skripte und Tableau-Webview prüfen.');
    }
  }, 10000);

  document.getElementById('status').textContent = 'Lade Filter-Modul ...';
})();
