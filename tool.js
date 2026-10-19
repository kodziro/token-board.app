/*
  token-board.app — free online token board, tool script (ES module, no dependencies, no build).
  Design authority: docs/tool-spec.md (repo-internal). Protected facts: CLAUDE.md § Browser tool.

  T1 (2026-10-19): stage states + fullscreen + status pill + signal stub.
  T2 (2026-10-19): board core — model, slots 3/5/10, tap to earn/remove, pop + tone, celebration
    (confetti, "Hooray!" resets), Web Audio tones (lazy, only inside a tap, never when sound is off),
    localStorage persistence ("tb-board"), exports for T3/T4.
    - .tb-stage classes: is-settings (panel open), is-complete (celebration), is-expanded (iPhone
      fullscreen fallback). data-bg = background id ("white" | "blue" in T2).
    - signal(name, payload) only calls window.__tbLog until T4 connects TelemetryDeck.
    - Signals sent here: fullscreen {mode}, board-complete {slots}.
  Nothing is uploaded. localStorage keys: tb-board (the board model), tb-fs-hint (fullscreen hint shown).
*/

const stage = document.querySelector('[data-tb-stage]');

/** Signal stub: log only. T4 replaces the body with the TelemetryDeck call. */
export function signal(name, payload) {
  try {
    if (typeof window.__tbLog === 'function') window.__tbLog(name, payload || {});
  } catch (e) { /* never break the tool */ }
}

const isTestMode = () => {
  try {
    if (document.body && document.body.getAttribute('data-td-test') === '1') return true;
    return new URLSearchParams(location.search).get('test') === '1';
  } catch (e) { return false; }
};

const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
};

/* ---------------- status pill ---------------- */
let statusTimer = 0;
export function showStatus(text, ms = 2000) {
  const el = document.getElementById('tb-status');
  if (!el) return;
  el.textContent = text;
  el.classList.add('is-visible');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { el.classList.remove('is-visible'); }, ms);
}

/* =====================================================================
   Board model + persistence (T2)
   ===================================================================== */
const STORAGE_KEY = 'tb-board';
const SLOT_COUNTS = [3, 5, 10];
const BACKGROUNDS = { white: '#FFFFFF', blue: '#D9ECFF' }; // T3 adds the locked ones
const TITLE_MAX = 40;

const defaults = () => ({
  slots: 10, filled: [], title: 'My board', icon: '⭐', reward: '🧸', background: 'white', sound: true
});
let model = defaults();

function sanitize(raw) {
  const m = defaults();
  if (!raw || typeof raw !== 'object') return m;
  if (SLOT_COUNTS.includes(raw.slots)) m.slots = raw.slots;
  if (typeof raw.title === 'string') m.title = raw.title.trim().slice(0, TITLE_MAX);
  if (typeof raw.icon === 'string' && raw.icon && raw.icon.length <= 8) m.icon = raw.icon;
  if (typeof raw.reward === 'string' && raw.reward && raw.reward.length <= 8) m.reward = raw.reward;
  if (typeof raw.background === 'string' && raw.background.length <= 24) m.background = raw.background;
  if (typeof raw.sound === 'boolean') m.sound = raw.sound;
  if (Array.isArray(raw.filled)) {
    m.filled = [...new Set(raw.filled.filter(i => Number.isInteger(i) && i >= 0 && i < m.slots))].sort((a, b) => a - b);
  }
  return m;
}

function load() {
  let raw = null;
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) raw = JSON.parse(s);
  } catch (e) { raw = null; }
  model = sanitize(raw);
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(model)); } catch (e) { /* storage blocked: still works for this session */ }
}

/* ---------------- Web Audio (lazy, tap-only, never when sound is off) ---------------- */
let audioCtx = null;
function audio() {
  if (!model.sound) return null;
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { audioCtx = new AC(); } catch (e) { return null; }
  }
  try { if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume().catch(() => {}); } catch (e) { /* ignore */ }
  return audioCtx;
}

function tone(freq, dur, at = 0, vol = 0.22) {
  const c = audio();
  if (!c) return;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    const t = c.currentTime + at;
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.03);
  } catch (e) { /* audio is decoration only */ }
}

const tokenTone = () => tone(880, 0.12);
const celebrationTone = () => { tone(523.25, 0.15, 0); tone(659.25, 0.15, 0.15); tone(783.99, 0.15, 0.30); };

/* ---------------- rendering ---------------- */
const slotsEl = document.getElementById('tb-slots');
const titleEl = document.getElementById('tb-board-title');
const rewardEl = document.getElementById('tb-reward');
const overlay = document.getElementById('tb-complete');
const hoorayBtn = stage && stage.querySelector('[data-tb="hooray"]');

function slotLabel(i) { return `Token ${i + 1} of ${model.slots}`; }

function paintSlot(btn, i) {
  const filled = model.filled.includes(i);
  btn.classList.toggle('is-filled', filled);
  btn.setAttribute('aria-pressed', filled ? 'true' : 'false');
  btn.setAttribute('aria-label', slotLabel(i));
  btn.textContent = filled ? model.icon : '';
}

function renderSlots() {
  if (!slotsEl) return;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < model.slots; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tb-slot';
    btn.dataset.index = String(i);
    paintSlot(btn, i);
    frag.appendChild(btn);
  }
  slotsEl.replaceChildren(frag);
  slotsEl.setAttribute('aria-label', `Token slots, ${model.filled.length} of ${model.slots} earned`);
}

function render() {
  if (titleEl) titleEl.textContent = model.title;
  if (rewardEl) { rewardEl.textContent = model.reward; rewardEl.setAttribute('aria-label', `Reward: ${model.reward}`); }
  if (stage) stage.setAttribute('data-bg', BACKGROUNDS[model.background] ? model.background : 'white');
  renderSlots();
}

/* ---------------- tokens ---------------- */
let completeTimer = 0;
let completing = false;

function slotButton(i) { return slotsEl && slotsEl.querySelector(`.tb-slot[data-index="${i}"]`); }

function fill(i) {
  if (model.filled.includes(i) || i < 0 || i >= model.slots) return;
  model.filled = [...model.filled, i].sort((a, b) => a - b);
  save();
  const btn = slotButton(i);
  if (btn) {
    paintSlot(btn, i);
    if (!reducedMotion()) {
      btn.classList.add('is-pop');
      const done = () => btn.classList.remove('is-pop');
      btn.addEventListener('animationend', done, { once: true });
      setTimeout(done, 400); // fallback if animationend never fires
    }
  }
  if (slotsEl) slotsEl.setAttribute('aria-label', `Token slots, ${model.filled.length} of ${model.slots} earned`);
  tokenTone();
  if (model.filled.length === model.slots && !completing) {
    completing = true;
    clearTimeout(completeTimer);
    completeTimer = setTimeout(celebrate, 300); // after the pop animation
  }
}

function unfill(i) {
  if (!model.filled.includes(i)) return;
  model.filled = model.filled.filter(x => x !== i);
  save();
  const btn = slotButton(i);
  if (btn) paintSlot(btn, i);
  if (slotsEl) slotsEl.setAttribute('aria-label', `Token slots, ${model.filled.length} of ${model.slots} earned`);
  if (completing && model.filled.length < model.slots) { completing = false; clearTimeout(completeTimer); }
}

function tapSlot(i) {
  if (model.filled.includes(i)) unfill(i); else fill(i);
}

/* ---------------- celebration ---------------- */
function buildConfetti() {
  const box = overlay && overlay.querySelector('.tb-confetti');
  if (!box) return;
  box.replaceChildren();
  if (reducedMotion()) return;
  const colors = ['#4DA3FF', '#7ED957', '#FFC443', '#FF7BAC', '#FFFFFF', '#FF8C42'];
  const frag = document.createDocumentFragment();
  for (let n = 0; n < 60; n++) {
    const p = document.createElement('i');
    p.style.setProperty('--x', `${(Math.random() * 100).toFixed(1)}%`);
    p.style.setProperty('--d', `${(2.5 + Math.random() * 1.5).toFixed(2)}s`);
    p.style.setProperty('--delay', `${(Math.random() * 0.8).toFixed(2)}s`);
    p.style.setProperty('--r', `${Math.round(Math.random() * 360)}deg`);
    p.style.setProperty('--c', colors[n % colors.length]);
    frag.appendChild(p);
  }
  box.appendChild(frag);
}

function celebrate() {
  completing = false;
  if (!stage || model.filled.length !== model.slots) return;
  buildConfetti();
  stage.classList.add('is-complete');
  if (overlay) overlay.setAttribute('aria-hidden', 'false');
  celebrationTone();
  if (hoorayBtn) hoorayBtn.focus();
  signal('board-complete', { slots: String(model.slots) });
}

function closeCelebration() {
  if (!stage) return;
  stage.classList.remove('is-complete');
  if (overlay) {
    overlay.setAttribute('aria-hidden', 'true');
    const box = overlay.querySelector('.tb-confetti');
    if (box) box.replaceChildren();
  }
}

function hooray() {
  resetTokens();
  closeCelebration();
  const first = slotButton(0);
  if (first) first.focus();
  showStatus('Board reset');
}

/* ---------------- public API (used by T3 settings panel and T4) ---------------- */
export function getModel() { return JSON.parse(JSON.stringify(model)); }

export function setSlots(n) {
  if (!SLOT_COUNTS.includes(n)) return;
  model.slots = n;
  model.filled = model.filled.filter(i => i < n); // keep earned tokens that still fit
  completing = false; clearTimeout(completeTimer);
  save(); render();
}
export function setIcon(e) {
  if (typeof e !== 'string' || !e || e.length > 8) return;
  model.icon = e; save(); render();
}
export function setReward(e) {
  if (typeof e !== 'string' || !e || e.length > 8) return;
  model.reward = e; save(); render();
}
export function setTitle(s) {
  model.title = String(s == null ? '' : s).trim().slice(0, TITLE_MAX); save(); render();
}
export function setBackground(id) {
  if (!BACKGROUNDS[id]) return; // locked / unknown backgrounds are ignored until T3
  model.background = id; save(); render();
}
export function setSound(on) {
  model.sound = !!on; save();
}
export function resetTokens() {
  model.filled = [];
  completing = false; clearTimeout(completeTimer);
  save(); render();
}

/* =====================================================================
   Settings panel (T1) — content comes in T3
   ===================================================================== */
const panel = document.getElementById('tb-panel');
const settingsBtn = stage && stage.querySelector('[data-tb="settings"]');
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
let lastFocus = null;

const isPhone = () => window.matchMedia('(max-width: 699px)').matches;

export function openPanel() {
  if (!stage || !panel || stage.classList.contains('is-settings')) return;
  lastFocus = document.activeElement;
  stage.classList.add('is-settings');
  panel.setAttribute('aria-hidden', 'false');
  if (settingsBtn) settingsBtn.setAttribute('aria-expanded', 'true');
  const first = panel.querySelector(FOCUSABLE);
  if (first) first.focus();
}

export function closePanel() {
  if (!stage || !panel || !stage.classList.contains('is-settings')) return;
  stage.classList.remove('is-settings');
  panel.setAttribute('aria-hidden', 'true');
  if (settingsBtn) settingsBtn.setAttribute('aria-expanded', 'false');
  const back = (lastFocus && document.contains(lastFocus)) ? lastFocus : settingsBtn;
  if (back && typeof back.focus === 'function') back.focus();
  lastFocus = null;
}

function trapFocus(ev) {
  if (!stage || !stage.classList.contains('is-settings') || ev.key !== 'Tab') return;
  const items = Array.from(panel.querySelectorAll(FOCUSABLE)).filter(el => el.offsetParent !== null);
  if (!items.length) { ev.preventDefault(); return; }
  const first = items[0], last = items[items.length - 1];
  if (ev.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
    ev.preventDefault(); last.focus();
  } else if (!ev.shiftKey && document.activeElement === last) {
    ev.preventDefault(); first.focus();
  }
}

/* =====================================================================
   Fullscreen (native) / expanded (iPhone fallback) — T1
   ===================================================================== */
const fsBtn = stage && stage.querySelector('[data-tb="fullscreen"]');
const fsLabel = fsBtn && fsBtn.querySelector('.tb-btn-fs-label');
const fsEl = () => stage; // the stage itself goes fullscreen (CSS .tb-stage:fullscreen)

const nativeSupported = () => {
  const el = fsEl();
  return !!((document.fullscreenEnabled || document.webkitFullscreenEnabled) &&
            (el.requestFullscreen || el.webkitRequestFullscreen));
};
const nativeActive = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
let expanded = false;
let scrollYBefore = 0;

function setFsLabel(on) {
  if (!fsBtn) return;
  fsBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  if (fsLabel) fsLabel.textContent = on ? 'Exit' : 'Fullscreen';
  fsBtn.setAttribute('aria-label', on ? 'Exit fullscreen' : 'Fullscreen');
}

function enterExpanded() {
  if (expanded || !stage) return;
  expanded = true;
  scrollYBefore = window.scrollY || 0;
  document.body.classList.add('tb-scroll-lock');
  document.body.style.top = `-${scrollYBefore}px`;
  stage.classList.add('is-expanded');
  try { history.pushState({ tbExpanded: true }, ''); } catch (e) { /* ignore */ }
  setFsLabel(true);
  signal('fullscreen', { mode: 'expanded' });
  let hintShown = false;
  try { hintShown = localStorage.getItem('tb-fs-hint') === '1'; } catch (e) { /* ignore */ }
  if (!hintShown) {
    showStatus('For a true full screen, add this page to your Home Screen.', 4500);
    try { localStorage.setItem('tb-fs-hint', '1'); } catch (e) { /* ignore */ }
  }
}

function exitExpanded(fromPopstate) {
  if (!expanded || !stage) return;
  expanded = false;
  stage.classList.remove('is-expanded');
  document.body.classList.remove('tb-scroll-lock');
  document.body.style.top = '';
  window.scrollTo(0, scrollYBefore);
  setFsLabel(false);
  if (!fromPopstate) {
    try { if (history.state && history.state.tbExpanded) history.back(); } catch (e) { /* ignore */ }
  }
}

function toggleFullscreen() {
  if (nativeSupported()) {
    if (nativeActive()) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      const el = fsEl();
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      try {
        const p = req.call(el, { navigationUI: 'hide' });
        if (p && p.then) p.then(() => signal('fullscreen', { mode: 'native' })).catch(() => enterExpanded());
        else signal('fullscreen', { mode: 'native' });
      } catch (e) { enterExpanded(); }
    }
    return;
  }
  if (expanded) exitExpanded(false); else enterExpanded();
}

function onFsChange() { setFsLabel(nativeActive()); }

/* =====================================================================
   Wiring
   ===================================================================== */
if (stage) {
  // Board: restore before first render, then render from the model.
  load();
  render();

  if (slotsEl) {
    slotsEl.addEventListener('click', ev => {
      const btn = ev.target && ev.target.closest ? ev.target.closest('.tb-slot') : null;
      if (!btn || !slotsEl.contains(btn)) return;
      tapSlot(Number(btn.dataset.index)); // Enter / Space on a <button> arrive here as click
    });
  }
  if (hoorayBtn) hoorayBtn.addEventListener('click', hooray);

  // Settings panel
  if (settingsBtn) settingsBtn.addEventListener('click', openPanel);
  stage.querySelectorAll('[data-tb="close"]').forEach(btn => btn.addEventListener('click', closePanel));
  // Desktop: tapping the stage outside the panel closes it (phone: full-stage sheet, Done / × only).
  stage.addEventListener('click', ev => {
    if (!stage.classList.contains('is-settings') || isPhone()) return;
    if (panel.contains(ev.target) || (settingsBtn && settingsBtn.contains(ev.target))) return;
    closePanel();
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') {
      if (stage.classList.contains('is-settings')) { ev.preventDefault(); closePanel(); return; }
      if (expanded) { ev.preventDefault(); exitExpanded(false); }
    }
    trapFocus(ev);
  });

  // Fullscreen
  if (fsBtn) {
    const canExpanded = typeof window.matchMedia === 'function';
    if (!nativeSupported() && !canExpanded) {
      fsBtn.hidden = true;
    } else {
      fsBtn.addEventListener('click', toggleFullscreen);
      document.addEventListener('fullscreenchange', onFsChange);
      document.addEventListener('webkitfullscreenchange', onFsChange);
    }
  }
  window.addEventListener('popstate', () => { if (expanded) exitExpanded(true); });

  // Test hooks (tool-test.html or ?test=1 only)
  if (isTestMode()) {
    window.__tbTest = Object.assign(window.__tbTest || {}, {
      openPanel, closePanel, showStatus, toggleFullscreen,
      getModel, setSlots, setIcon, setReward, setTitle, setBackground, setSound, resetTokens,
      tapSlot,
      fillAll() { for (let i = 0; i < model.slots; i++) if (!model.filled.includes(i)) tapSlot(i); },
      clearStorage() {
        try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem('tb-fs-hint'); } catch (e) { /* ignore */ }
        try { location.reload(); } catch (e) { /* not available in some test runners */ }
      },
      slots3() { setSlots(3); }, slots5() { setSlots(5); }, slots10() { setSlots(10); },
      soundToggle() { setSound(!model.sound); showStatus(model.sound ? 'Sound on' : 'Sound off'); },
      setTitlePrompt() {
        let v = null;
        try { v = window.prompt(`Board title (max ${TITLE_MAX} characters)`, model.title); } catch (e) { v = null; }
        if (v !== null) setTitle(v);
      },
      bgBlue() { setBackground('blue'); }, bgWhite() { setBackground('white'); }
    });
  }
}
