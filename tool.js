/*
  token-board.app — free online token board, tool script (ES module, no dependencies, no build).
  Design authority: docs/tool-spec.md (repo-internal). Protected facts: CLAUDE.md § Browser tool.

  T1 (2026-10-19): stage states + fullscreen + status pill + signal stub.
  T7 (2026-10-19): a11y — #tb-count (visually hidden, aria-live) says "N of M earned" on every fill/remove;
    celebration overlay keeps focus on Hooray (Tab trapped) and Escape = Hooray; the settings panel is
    role=dialog aria-modal only on phones (sheet). ?v=20261019g.
  T5b (2026-10-19): panel grids use minmax(0,1fr) columns (no horizontal overflow); thumbs 1 px
    white border normally, 3 px accent when selected (CSS only, tool.css). ?v=20261019f.
  T4 (2026-10-19): analytics — signal() sends through assets/tool-signals.js (TelemetryDeck, test
    mode = ?test=1 / body[data-td-test="1"] / localhost). New: tool-start {slots, icon, background}
    once per page load on the first tap; tool-session {minutes} once per session (pagehide, tab hidden, or 10 min
    idle; a later tap starts a new session); visit {nth, daysSinceFirst} once per page load from
    localStorage tb-visits {count, first}.
  T3 (2026-10-19): settings panel content (title, token icon, background, slots, reward, sound), locked
    items with the "I'm interested" card, feedback thumbs, pro-view. Signals: setting-change {what},
    pro-click {item, from}, pro-view, feedback {vote, minutes}. localStorage: tb-feedback {ts}.
  T2 (2026-10-19): board core — model, slots 3/5/10, tap to earn/remove, pop + tone, celebration
    (confetti, "Hooray!" resets), Web Audio tones (lazy, only inside a tap, never when sound is off),
    localStorage persistence ("tb-board"), exports for T3/T4.
    - .tb-stage classes: is-settings (panel open), is-complete (celebration), is-expanded (iPhone
      fullscreen fallback). data-bg = background id ("white" | "blue" in T2).
    - signal(name, payload) only calls window.__tbLog until T4 connects TelemetryDeck.
    - Signals sent here: fullscreen {mode}, board-complete {slots}.
  Nothing personal is sent. localStorage keys: tb-board (the board model), tb-fs-hint (fullscreen hint shown),
  tb-feedback {ts}, tb-visits {count, first}.
*/

import { send } from './assets/tool-signals.js?v=20261019h';

const stage = document.querySelector('[data-tb-stage]');

/** One analytics signal (TelemetryDeck via tool-signals.js; echoed to window.__tbLog in test mode). */
export function signal(name, payload) {
  try { send(name, payload || {}); } catch (e) { /* never break the tool */ }
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
// Catalogs (CLAUDE.md § Browser tool: free icons ⭐ ❤️ 😊, free backgrounds white + light blue; all others locked).
const ICONS = [
  ['star', '⭐', 'Star', true], ['heart', '❤️', 'Heart', true], ['smile', '😊', 'Smiling face', true],
  ['sun', '☀️', 'Sun'], ['moon', '🌙', 'Moon'], ['rainbow', '🌈', 'Rainbow'], ['unicorn', '🦄', 'Unicorn'],
  ['rocket', '🚀', 'Rocket'], ['robot', '🤖', 'Robot'], ['cat', '🐱', 'Cat'], ['dog', '🐶', 'Dog'],
  ['teddy', '🧸', 'Teddy bear'], ['dinosaur', '🦖', 'Dinosaur'], ['butterfly', '🦋', 'Butterfly'],
  ['ladybug', '🐞', 'Ladybug'], ['bee', '🐝', 'Bee'], ['fish', '🐟', 'Fish'], ['octopus', '🐙', 'Octopus'],
  ['car', '🚗', 'Car'], ['train', '🚂', 'Train'], ['plane', '✈️', 'Plane'], ['football', '⚽', 'Football'],
  ['basketball', '🏀', 'Basketball']
].map(([id, emoji, name, free]) => ({ id, emoji, name, free: !!free }));
const BACKGROUNDS = [
  ['white', '#FFFFFF', 'White', true], ['blue', '#D9ECFF', 'Light blue', true],
  ['green', '#DFF5E3', 'Green'], ['yellow', '#FFF3C4', 'Yellow'], ['pink', '#FFE0EC', 'Pink'],
  ['purple', '#EADDFF', 'Purple'], ['grey', '#E9EAEE', 'Grey'], ['navy', '#1E2A44', 'Navy', false, true]
].map(([id, color, name, free, dark]) => ({ id, color, name, free: !!free, dark: !!dark }));
const REWARDS = [
  ['🎁', 'Gift'], ['🍦', 'Ice cream'], ['🍪', 'Cookie'], ['🍬', 'Candy'], ['🍫', 'Chocolate'], ['🧁', 'Cupcake'],
  ['🍩', 'Donut'], ['🍭', 'Lollipop'], ['🍿', 'Popcorn'], ['🍎', 'Apple'], ['🧸', 'Teddy bear'], ['🧩', 'Puzzle'],
  ['🤖', 'Robot'], ['🏠', 'Home'], ['🚗', 'Car ride'], ['📱', 'Phone'], ['📺', 'TV'], ['🎮', 'Video game'],
  ['🕹️', 'Joystick'], ['🖥️', 'Computer'], ['▶️', 'Play video'], ['🎬', 'Movie'], ['🎵', 'Music'], ['🛝', 'Playground slide'],
  ['🚲', 'Bike'], ['🛴', 'Scooter'], ['🌳', 'Park'], ['🦁', 'Zoo'], ['⚽', 'Football'], ['🏊', 'Swimming'],
  ['🛹', 'Skateboard'], ['🐶', 'Dog'], ['🐱', 'Cat'], ['🐹', 'Hamster'], ['🐠', 'Fish'], ['🎾', 'Tennis'],
  ['🎨', 'Painting'], ['📚', 'Books'], ['🎈', 'Balloon'], ['🎉', 'Party'], ['🧃', 'Juice'], ['🍕', 'Pizza'],
  ['🍓', 'Strawberry'], ['🍌', 'Banana'], ['🥤', 'Drink'], ['🎧', 'Headphones'], ['🎹', 'Piano'], ['🥁', 'Drums'],
  ['🪁', 'Kite'], ['🏖️', 'Beach'], ['🎠', 'Carousel'], ['🎢', 'Roller coaster'], ['🚂', 'Train'], ['✈️', 'Plane'],
  ['🚀', 'Rocket'], ['🦄', 'Unicorn'], ['🐢', 'Turtle'], ['🐰', 'Rabbit'], ['🦊', 'Fox'], ['🐻', 'Bear']
].map(([emoji, name]) => ({ emoji, name }));
const freeIcon = e => ICONS.some(i => i.emoji === e && i.free);
const bgById = id => BACKGROUNDS.find(b => b.id === id);
const freeBg = id => { const b = bgById(id); return !!(b && b.free); };
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
  if (typeof raw.icon === 'string' && freeIcon(raw.icon)) m.icon = raw.icon; // a locked icon is never restored
  if (typeof raw.reward === 'string' && raw.reward && raw.reward.length <= 8) m.reward = raw.reward;
  if (typeof raw.background === 'string' && freeBg(raw.background)) m.background = raw.background;
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
const countEl = document.getElementById('tb-count');
function announceCount() { if (countEl) countEl.textContent = `${model.filled.length} of ${model.slots} earned`; }

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
  announceCount();
}

function render() {
  if (titleEl) titleEl.textContent = model.title;
  if (rewardEl) { rewardEl.textContent = model.reward; rewardEl.setAttribute('aria-label', `Reward: ${model.reward}`); }
  if (stage) {
    const bg = freeBg(model.background) ? bgById(model.background) : bgById('white');
    stage.setAttribute('data-bg', bg.id);
    stage.classList.toggle('is-dark', !!bg.dark);
  }
  renderSlots();
  syncPanel();
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
  announceCount();
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
  announceCount();
  if (completing && model.filled.length < model.slots) { completing = false; clearTimeout(completeTimer); }
}

/* ---------------- session + tool-start (T4) ---------------- */
const IDLE_MS = 10 * 60 * 1000;
let sessionStart = 0;   // first tap of the current session (in memory only)
let lastTap = 0;
let sessionOpen = false;
let startSent = false;  // tool-start: once per page load
let idleTimer = 0;

function minutesBucket(ms) {
  const m = ms / 60000;
  return m < 1 ? '<1' : m < 5 ? '1-5' : m < 15 ? '5-15' : m < 30 ? '15-30' : '30+';
}

/** tool-session once per session: on pagehide or after 10 min without a tap. */
function endSession() {
  if (!sessionOpen) return;
  sessionOpen = false;
  clearTimeout(idleTimer);
  signal('tool-session', { minutes: minutesBucket(Math.max(0, lastTap - sessionStart)) });
}

function noteTap() {
  const now = Date.now();
  if (!sessionOpen) { sessionOpen = true; sessionStart = now; }
  lastTap = now;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(endSession, IDLE_MS);
  if (!startSent) {
    startSent = true;
    signal('tool-start', { slots: String(model.slots), icon: freeIcon(model.icon) ? 'free' : 'locked', background: model.background });
  }
}

function tapSlot(i) {
  noteTap();
  if (model.filled.includes(i)) unfill(i); else fill(i);
}

/* ---------------- visit counter (T4): once per page load ---------------- */
function sendVisit() {
  let v = null;
  try { v = JSON.parse(localStorage.getItem('tb-visits') || 'null'); } catch (e) { v = null; }
  const now = Date.now();
  const count = (v && Number.isInteger(v.count) && v.count >= 0 ? v.count : 0) + 1;
  const first = (v && typeof v.first === 'number' && v.first > 0 && v.first <= now) ? v.first : now;
  try { localStorage.setItem('tb-visits', JSON.stringify({ count, first })); } catch (e) { /* ignore */ }
  const days = Math.floor((now - first) / 86400000);
  signal('visit', {
    nth: count === 1 ? '1' : count === 2 ? '2' : count <= 5 ? '3-5' : count <= 10 ? '6-10' : '11+',
    daysSinceFirst: days < 1 ? '0' : days <= 7 ? '1-7' : days <= 30 ? '8-30' : '31+'
  });
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
  if (!freeIcon(e)) return; // locked icons cannot be selected
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
  if (!freeBg(id)) return; // locked / unknown backgrounds cannot be selected
  model.background = id; save(); render();
}
export function setSound(on) {
  model.sound = !!on; save(); syncPanel();
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
  // Phone: the panel is a full-stage sheet, so it is a modal dialog; desktop: a side panel next to the board.
  if (isPhone()) { panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); }
  else { panel.removeAttribute('role'); panel.removeAttribute('aria-modal'); }
  if (settingsBtn) settingsBtn.setAttribute('aria-expanded', 'true');
  maybeShowFeedback();
  const first = panel.querySelector(FOCUSABLE);
  if (first) first.focus();
}

export function closePanel() {
  if (!stage || !panel || !stage.classList.contains('is-settings')) return;
  stage.classList.remove('is-settings');
  panel.setAttribute('aria-hidden', 'true');
  panel.removeAttribute('role'); panel.removeAttribute('aria-modal');
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
   Settings panel content (T3): grids, controls, locked items, interest card, feedback
   ===================================================================== */
const panelBody = document.getElementById('tb-panel-body');
const LOCK_SVG = '<span class="tb-lock" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zm-7-2a2 2 0 0 1 4 0v2h-4V7z"/></svg></span>';
let settingSignal = what => signal('setting-change', { what });

function thumb({ kind, id, label, free, emoji, color }) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tb-thumb' + (kind === 'bg' ? ' tb-thumb-bg' : '') + (free ? '' : ' is-locked');
  b.dataset.kind = kind; b.dataset.id = id;
  b.setAttribute('aria-pressed', 'false');
  b.setAttribute('aria-label', free ? label : `${label}, locked`);
  if (kind === 'bg') b.style.setProperty('--c', color);
  else b.innerHTML = `<span class="tb-thumb-img">${emoji}</span>`;
  if (!free) b.insertAdjacentHTML('beforeend', LOCK_SVG);
  return b;
}

function buildPanel() {
  if (!panelBody) return;
  const icons = document.getElementById('tb-icons');
  const bgs = document.getElementById('tb-bgs');
  const rewards = document.getElementById('tb-rewards');
  if (icons) icons.replaceChildren(...ICONS.map(i => thumb({ kind: 'icon', id: i.id, label: i.name, free: i.free, emoji: i.emoji })));
  if (bgs) bgs.replaceChildren(...BACKGROUNDS.map(b => thumb({ kind: 'bg', id: b.id, label: b.name, free: b.free, color: b.color })));
  if (rewards) rewards.replaceChildren(...REWARDS.map((r, n) => thumb({ kind: 'reward', id: String(n), label: r.name, free: true, emoji: r.emoji })));
}

/** Panel controls reflect the model (called by render(); locked items are never shown selected). */
function syncPanel() {
  if (!panelBody) return;
  const input = document.getElementById('tb-title-input');
  if (input && document.activeElement !== input) input.value = model.title;
  const iconId = (ICONS.find(i => i.emoji === model.icon) || ICONS[0]).id;
  panelBody.querySelectorAll('.tb-thumb[data-kind="icon"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.id === iconId ? 'true' : 'false'));
  panelBody.querySelectorAll('.tb-thumb[data-kind="bg"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.id === model.background ? 'true' : 'false'));
  const rewardIdx = REWARDS.findIndex(r => r.emoji === model.reward);
  panelBody.querySelectorAll('.tb-thumb[data-kind="reward"]').forEach(b => b.setAttribute('aria-pressed', Number(b.dataset.id) === rewardIdx ? 'true' : 'false'));
  panelBody.querySelectorAll('input[name="tb-slots"]').forEach(r => { r.checked = Number(r.value) === model.slots; });
  const sound = document.getElementById('tb-sound');
  if (sound) { sound.checked = !!model.sound; sound.setAttribute('aria-checked', model.sound ? 'true' : 'false'); }
}

function nudge(btn) {
  btn.classList.add('is-nudge');
  setTimeout(() => btn.classList.remove('is-nudge'), 700);
}

/** Show the interest card inside the panel and scroll the PANEL (never the page) to it. */
function revealInterest() {
  const card = document.getElementById('tb-interest');
  if (!card || !panelBody) return;
  card.hidden = false;
  const top = Math.max(0, card.offsetTop - 12);
  try { panelBody.scrollTo({ top, behavior: reducedMotion() ? 'auto' : 'smooth' }); }
  catch (e) { panelBody.scrollTop = top; }
}

function onLockedTap(btn) {
  nudge(btn);
  revealInterest();
  signal('pro-click', { item: (btn.dataset.kind === 'bg' ? 'bg-' : 'token-') + btn.dataset.id, from: 'panel' });
}

function onInterest(btn) {
  if (btn.disabled) return;
  signal('pro-click', { item: 'interest', from: btn.dataset.interest === 'card' ? 'card' : 'panel' });
  btn.textContent = 'Thanks — counted!';
  btn.disabled = true;
}

function wirePanel() {
  if (!panelBody) return;
  buildPanel();
  panelBody.addEventListener('click', ev => {
    const t = ev.target && ev.target.closest ? ev.target.closest('.tb-thumb, [data-interest], [data-fb]') : null;
    if (!t) return;
    if (t.hasAttribute('data-fb')) { onFeedback(t.getAttribute('data-fb')); return; }
    if (t.hasAttribute('data-interest')) { onInterest(t); return; }
    if (t.classList.contains('is-locked')) { onLockedTap(t); return; }
    const id = t.dataset.id;
    if (t.dataset.kind === 'icon') { const i = ICONS.find(x => x.id === id); if (i && i.emoji !== model.icon) { setIcon(i.emoji); settingSignal('icon'); } }
    else if (t.dataset.kind === 'bg') { if (id !== model.background) { setBackground(id); settingSignal('background'); } }
    else if (t.dataset.kind === 'reward') { const r = REWARDS[Number(id)]; if (r && r.emoji !== model.reward) { setReward(r.emoji); settingSignal('reward'); } }
  });
  const input = document.getElementById('tb-title-input');
  if (input) {
    input.addEventListener('input', () => setTitle(input.value));
    input.addEventListener('change', () => settingSignal('title')); // once per edit, never the text
  }
  panelBody.querySelectorAll('input[name="tb-slots"]').forEach(r => r.addEventListener('change', () => {
    const n = Number(r.value);
    if (r.checked && n !== model.slots) { setSlots(n); settingSignal('slots'); }
  }));
  const sound = document.getElementById('tb-sound');
  if (sound) sound.addEventListener('change', () => {
    setSound(sound.checked);
    showStatus(model.sound ? 'Sound on' : 'Sound off');
    settingSignal('sound');
  });
}

/* ---- "I'm interested" card below the fold (#pro-card) + pro-view ---- */
function wireProCard() {
  const card = document.getElementById('pro-card');
  if (!card) return;
  const btn = card.querySelector('[data-interest]');
  if (btn) btn.addEventListener('click', () => onInterest(btn));
  if (typeof IntersectionObserver !== 'function') return;
  let seen = false; // once per page load
  try {
    const io = new IntersectionObserver(entries => {
      if (!seen && entries.some(e => e.isIntersecting && e.intersectionRatio >= 0.5)) {
        seen = true;
        io.disconnect();
        signal('pro-view', {});
      }
    }, { threshold: 0.5 });
    io.observe(card);
  } catch (e) { /* ignore */ }
}

/* ---- feedback thumbs ---- */
const FEEDBACK_KEY = 'tb-feedback';
const FEEDBACK_DAYS = 30;
const FEEDBACK_MIN_MS = 2 * 60 * 1000;
let feedbackTimer = 0;

function feedbackRecent() {
  try {
    const v = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || 'null');
    return !!(v && typeof v.ts === 'number' && Date.now() - v.ts < FEEDBACK_DAYS * 86400000);
  } catch (e) { return false; }
}
function storeFeedback() {
  try { localStorage.setItem(FEEDBACK_KEY, JSON.stringify({ ts: Date.now() })); } catch (e) { /* ignore */ }
}
function maybeShowFeedback() {
  const line = document.getElementById('tb-feedback');
  if (!line) return;
  const eligible = sessionStart && (Date.now() - sessionStart) >= FEEDBACK_MIN_MS && !feedbackRecent();
  line.hidden = !eligible;
}
function onFeedback(action) {
  const line = document.getElementById('tb-feedback');
  if (!line) return;
  if (action === 'close') { storeFeedback(); line.hidden = true; return; }
  const vote = action === 'up' ? 'up' : 'down';
  signal('feedback', { vote, minutes: minutesBucket(sessionStart ? Date.now() - sessionStart : 0) });
  storeFeedback();
  const q = document.getElementById('tb-feedback-q');
  line.querySelectorAll('[data-fb]').forEach(b => { b.hidden = true; });
  if (q) q.textContent = 'Thanks!';
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => {
    line.hidden = true;
    if (q) q.textContent = 'Was it useful today?';
    line.querySelectorAll('[data-fb]').forEach(b => { b.hidden = false; });
  }, 3000);
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
  // Board: restore before first render; panel grids exist before render() so syncPanel() can mark them.
  load();
  wirePanel();
  render();
  wireProCard();
  sendVisit();
  window.addEventListener('pagehide', endSession);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') endSession(); });

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
    if (stage.classList.contains('is-complete')) {
      // Celebration dialog: the only control is Hooray. Tab stays on it, Escape = Hooray.
      if (ev.key === 'Escape') { ev.preventDefault(); hooray(); return; }
      if (ev.key === 'Tab') { ev.preventDefault(); if (hoorayBtn) hoorayBtn.focus(); return; }
    }
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
      bgBlue() { setBackground('blue'); }, bgWhite() { setBackground('white'); },
      sessionPlus3() { sessionStart = (sessionStart || Date.now()) - 3 * 60 * 1000; showStatus('Session start moved back 3 min'); },
      setSessionStart(ts) { sessionStart = ts; },
      simulatePagehide() { window.dispatchEvent(new Event('pagehide')); },
      simulateIdle() { endSession(); } // what the 10-min idle timer does
    });
  }
}
