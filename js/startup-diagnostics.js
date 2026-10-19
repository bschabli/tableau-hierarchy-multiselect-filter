// Classic script intentionally runs independently of the ES module.
// Makes import/syntax/load failures visible instead of leaving the startup label unchanged.
(() => {
  function show(message) {
    const status = document.getElementById('status');
    if (!status) return;
    status.textContent = message;
    status.classList.add('error');
  }

  // Browsers report deferred ResizeObserver notifications as ErrorEvents.
  // A sporadic warning is not a fatal JS exception; don't replace the UI status.
  // However, repeated warnings can signal a real layout loop, so keep those visible.
  let resizeWarningWindowStart = 0;
  let resizeWarningCount = 0;
  const resizeWarningPattern =
    /^ResizeObserver loop (?:limit exceeded|completed with undelivered notifications\.?)$/i;

  window.addEventListener('error', event => {
    const script = event.target instanceof HTMLScriptElement ? event.target : null;
    if (script) {
      show('Ladefehler: ' + new URL(script.src).pathname);
      return;
    }
    if (event instanceof ErrorEvent && event.message) {
      if (resizeWarningPattern.test(event.message.trim())) {
        const now = Date.now();
        if (now - resizeWarningWindowStart > 5000) {
          resizeWarningWindowStart = now;
          resizeWarningCount = 0;
        }
        resizeWarningCount++;
        if (resizeWarningCount === 1) {
          console.debug('[Hierarchy Filter] Non-fatal ResizeObserver warning:', event.message);
        }
        if (resizeWarningCount >= 15) {
          show('Layout-Warnung: Wiederholte ResizeObserver-Schleife. Bitte Fenstergröße und Baumdarstellung prüfen.');
        }
        return;
      }
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
