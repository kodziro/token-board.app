/*
  TelemetryDeck sender for the free online token board (token-board.app). ES module, no build.
  Same SDK and mechanism as appstore-click.js (which stays self-contained because app.html and
  the 8 guides load it on their own; the small helpers are duplicated on purpose, not shared).

  - Loads @telemetrydeck/sdk 2.0.4 from jsDelivr at runtime, lazily: after the window load event in
    an idle slot (2 s at most), so it never competes with first paint. If it fails, nothing is sent
    and the tool keeps working. Signals sent before the SDK is ready wait in a short queue.
  - send(name, payload): one signal, payload + { page, source, path, referrer }. Values are short
    bucketed strings. The board title is never sent (tool.js only passes what:'title').
  - Cookieless: clientUser is a random value per page load, never stored.
  - Test mode (signals flagged as test data in TelemetryDeck AND echoed to window.__tbLog):
    ?test=1 in the URL, body[data-td-test="1"], localhost / 127.x / file:.
*/
const APP_ID = 'C2A6027C-00E1-4CC9-9FD5-C7A238880FF4';
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@telemetrydeck/sdk@2.0.4/dist/telemetrydeck.js';
const QUEUE_MAX = 50;

export function pageSlug() {
  const explicit = document.body && document.body.getAttribute('data-td-page');
  if (explicit) return explicit;
  const path = location.pathname.replace(/\/index\.html$/, '/');
  if (path === '' || path === '/') return 'home';
  const guide = path.match(/\/guides\/([^/]+)\.html$/);
  if (guide) return 'guide-' + guide[1];
  const name = path.replace(/^.*\//, '').replace(/\.html$/, '');
  return name || 'home';
}

export function referrerHost() {
  try { return document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) { return ''; }
}

export function source() {
  let utm = '';
  try { utm = new URLSearchParams(location.search).get('utm_source') || ''; } catch (e) { /* ignore */ }
  if (utm) return utm.toLowerCase().slice(0, 100);
  const host = referrerHost();
  if (host && host !== location.hostname) return host;
  return 'none';
}

function randomId() {
  try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* ignore */ }
  return String(Date.now()) + '-' + Math.random().toString(36).slice(2);
}

export function isTestMode() {
  try { if (new URLSearchParams(location.search).get('test') === '1') return true; } catch (e) { /* ignore */ }
  try { if (document.body && document.body.getAttribute('data-td-test') === '1') return true; } catch (e) { /* ignore */ }
  return /^localhost$|^127(\.\d+){0,2}\.\d+$|^\[::1?]$/.test(location.hostname) || location.protocol === 'file:';
}

let td = null;
let failed = false;
const pending = [];

function post(name, data) {
  try { td.signal(name, data).catch(() => {}); } catch (e) { /* never break the tool */ }
}

function loadSdk() {
  try {
  import(SDK_URL).then(mod => {
    const TelemetryDeck = mod.default;
    const instance = new TelemetryDeck({ appID: APP_ID, clientUser: randomId(), testMode: isTestMode() });
    // Same request as the SDK's own _post (pinned 2.0.4), plus keepalive so a signal sent on
    // pagehide still completes while the page unloads.
    instance._post = function (body) {
      return fetch(instance.target, {
        method: 'POST', mode: 'cors', keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    };
    td = instance;
    while (pending.length) { const [n, d] = pending.shift(); post(n, d); }
  }).catch(() => { failed = true; pending.length = 0; });
  } catch (e) { failed = true; }
}

/* Lazy (T7): the SDK never competes with first paint. It loads after the window load event, in an
   idle slot (requestIdleCallback, at most 2 s later); signals sent before that wait in the queue. */
function scheduleSdk() {
  const run = () => (typeof requestIdleCallback === 'function' ? requestIdleCallback(loadSdk, { timeout: 2000 }) : setTimeout(loadSdk, 1));
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}
scheduleSdk();

/** Send one signal. Returns nothing; never throws. */
export function send(name, payload) {
  const data = Object.assign({}, payload || {}, {
    page: pageSlug(), source: source(), path: location.pathname, referrer: referrerHost() || 'none'
  });
  if (isTestMode()) {
    try { if (typeof window.__tbLog === 'function') window.__tbLog(name, data); } catch (e) { /* ignore */ }
  }
  if (td) post(name, data);
  else if (!failed && pending.length < QUEUE_MAX) pending.push([name, data]);
}
