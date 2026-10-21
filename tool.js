/*
  token-board.app — free online token board, tool script (ES module, no dependencies, no build).
  Design authority: docs/tool-spec.md (repo-internal). Protected facts: CLAUDE.md § Browser tool.

  Panel redesign (2026-10-21): light panel; groups Board name, Token goal, Token icon, Background, Reward,
    Sound. Token goal = any whole number 3–100 (quick picks 3 / 5 / 10 + stepper + number input); goals
    over 10 fit the slot grid to the free space (fitSlots). Board name is also editable in place on the
    board. Signals unchanged (slots = exact number as text). ?v=20261021a.
  Free day (2026-10-21): 3 token icons, 2 backgrounds and 10 rewards are free; the rest is locked. A tap on a
    locked item opens the unlock modal: "Unlock free for today" unlocks ALL extras until local midnight
    (FREE_DAYS), free and renewable without limit (localStorage tb-tried {until, nth, used, asked}). A board
    keeps a locked item until the user changes it (never break a board in use). From the 2nd free day on, the
    panel asks once per free day "would you pay…?" (Yes / No / ×). Signals: try-today {item, group, nth},
    try-use {item, group}, try-skip {item}, would-pay {answer, nth, os, answerNo, lang}, appstore-click
    {position:"interest-modal"} (appstore-click.js), board-complete {slots, tried}.
  Own photo (2026-10-21): the 🖼️ photo tile is the first tile in Reward and Background, locked like the other
    extras. The photo is read and shrunk on the device only (canvas → JPEG 0.8, reward ≤ 512 px, background
    ≤ 1600 px long side) and kept in IndexedDB "tb-photos" (fallback: localStorage tb-photo-<kind> as a data
    URL). The original file is never stored and nothing is uploaded. Model flags rewardPhoto / bgPhoto. Signals:
    photo-set {kind}, photo-remove {kind}, photo-error {kind, reason} (never the image, its name or size).

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
  tb-feedback {ts}, tb-visits {count, first}, tb-tried {until, nth, used, asked}. IndexedDB: tb-photos (store photos: reward, background).
*/

import { send } from './assets/tool-signals.js?v=20261019i';

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
const GOAL_MIN = 3, GOAL_MAX = 100; // token goal: any whole number (quick picks 3 / 5 / 10 in the panel)
const isGoal = n => Number.isInteger(n) && n >= GOAL_MIN && n <= GOAL_MAX;
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
// Free rewards (2026-10-21): one per type, at most one food item; all Emoji 13 or older. All others locked.
const FREE_REWARDS = ['🎁', '🧸', '🍦', '📺', '🎮', '🎨', '📚', '⚽', '🌳', '🎵'];
const DEFAULT_REWARD = '🎁'; // new board, cleared storage, and the fallback for a missing / invalid saved reward (2026-10-21; was 🧸)
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const REWARDS = [
  ['🎁', 'Gift'], ['🍦', 'Ice cream'], ['🍪', 'Cookie'], ['🍬', 'Candy'], ['🍫', 'Chocolate'], ['🧁', 'Cupcake'],
  ['🍩', 'Donut'], ['🍭', 'Lollipop'], ['🍿', 'Popcorn'], ['🍎', 'Apple'], ['🧸', 'Teddy bear'], ['🧩', 'Puzzle'],
  ['🤖', 'Robot'], ['🏠', 'Home'], ['🚗', 'Car ride'], ['📱', 'Phone'], ['📺', 'TV'], ['🎮', 'Video game'],
  ['🕹️', 'Joystick'], ['🖥️', 'Computer'], ['▶️', 'Play video'], ['🎬', 'Movie'], ['🎵', 'Music'],
  ['🚲', 'Bike'], ['🛴', 'Scooter'], ['🌳', 'Park'], ['🦁', 'Zoo'], ['⚽', 'Football'], ['🏊', 'Swimming'],
  ['🛹', 'Skateboard'], ['🐶', 'Dog'], ['🐱', 'Cat'], ['🐹', 'Hamster'], ['🐠', 'Fish'], ['🎾', 'Tennis'],
  ['🎨', 'Painting'], ['📚', 'Books'], ['🎈', 'Balloon'], ['🎉', 'Party'], ['🧃', 'Juice'], ['🍕', 'Pizza'],
  ['🍓', 'Strawberry'], ['🍌', 'Banana'], ['🥤', 'Drink'], ['🎧', 'Headphones'], ['🎹', 'Piano'], ['🥁', 'Drums'],
  ['🪁', 'Kite'], ['🏖️', 'Beach'], ['🎠', 'Carousel'], ['🎢', 'Roller coaster'], ['🚂', 'Train'], ['✈️', 'Plane'],
  ['🚀', 'Rocket'], ['🦄', 'Unicorn'], ['🐢', 'Turtle'], ['🐰', 'Rabbit'], ['🦊', 'Fox'], ['🐻', 'Bear']
].map(([emoji, name]) => ({ id: slug(name), emoji, name, free: FREE_REWARDS.includes(emoji) }));
const freeIcon = e => ICONS.some(i => i.emoji === e && i.free);
const iconByEmoji = e => ICONS.find(i => i.emoji === e);
const bgById = id => BACKGROUNDS.find(b => b.id === id);
const rewardByEmoji = e => REWARDS.find(r => r.emoji === e);
const isFreeLook = () => !!(freeIcon(model.icon) && (bgById(model.background) || {}).free && (rewardByEmoji(model.reward) || {}).free && !model.rewardPhoto && !model.bgPhoto);
const TITLE_MAX = 40;

const defaults = () => ({
  slots: 10, filled: [], title: 'My board', icon: '⭐', reward: DEFAULT_REWARD, background: 'white', sound: true,
  rewardPhoto: false, bgPhoto: false // true = show the own photo (kept in IndexedDB) instead of reward / background
});
let model = defaults();

function sanitize(raw) {
  const m = defaults();
  if (!raw || typeof raw !== 'object') return m;
  if (isGoal(raw.slots)) m.slots = raw.slots;
  if (typeof raw.title === 'string') m.title = raw.title.trim().slice(0, TITLE_MAX);
  // Any catalog item is restored, also a locked one: a board in use (e.g. in class) keeps an item that was
  // tried for a day, or that was free before 2026-10-21, until the user picks something else.
  if (typeof raw.icon === 'string' && iconByEmoji(raw.icon)) m.icon = raw.icon;
  if (raw.reward === '🛝') raw.reward = '🎠'; // removed 2026-10-21 (new emoji, missing on older systems): closest = carousel
  if (typeof raw.reward === 'string' && rewardByEmoji(raw.reward)) m.reward = raw.reward;
  if (typeof raw.background === 'string' && bgById(raw.background)) m.background = raw.background;
  if (typeof raw.sound === 'boolean') m.sound = raw.sound;
  if (typeof raw.rewardPhoto === 'boolean') m.rewardPhoto = raw.rewardPhoto; // a board in use keeps its photo
  if (typeof raw.bgPhoto === 'boolean') m.bgPhoto = raw.bgPhoto;
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
const unlockChime = () => { tone(1318.51, 0.12, 0, 0.16); tone(1567.98, 0.12, 0.08, 0.16); tone(2093.0, 0.28, 0.16, 0.14); }; // only if Sound is on (audio())
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
  if (titleEl && document.activeElement !== titleEl) titleEl.textContent = model.title; // never while editing in place
  const rPhoto = photoShown('reward');
  [rewardEl, document.getElementById('tb-complete-reward')].forEach(el => {
    if (!el) return;
    el.classList.toggle('has-photo', !!rPhoto);
    el.style.backgroundImage = rPhoto ? `url("${rPhoto}")` : '';
    el.textContent = rPhoto ? '' : model.reward;
  });
  if (rewardEl) rewardEl.setAttribute('aria-label', rPhoto ? 'Reward: your photo' : `Reward: ${((rewardByEmoji(model.reward) || {}).name || model.reward).toLowerCase()}`);
  if (stage) {
    const bPhoto = photoShown('background');
    const bg = bgById(model.background) || bgById('white');
    stage.setAttribute('data-bg', bPhoto ? 'photo' : bg.id);
    stage.classList.toggle('is-dark', !bPhoto && !!bg.dark);
    if (bPhoto) stage.style.setProperty('--tb-photo', `url("${bPhoto}")`); else stage.style.removeProperty('--tb-photo');
  }
  renderSlots();
  fitSlots();
  syncPanel();
}

/* Goals over 10, and any goal while the panel is open (the board then has less room): pick the column
   count that gives the biggest circles that fit the free width AND height (in fullscreen the stage does
   not scroll, so everything must fit). Goals 3–10 with the panel closed keep the 5-column CSS. */
function fitSlots() {
  if (!slotsEl || !stage) return;
  const n = model.slots;
  const many = n > 10;
  const fit = many || stage.classList.contains('is-settings');
  stage.classList.toggle('is-many', many);
  slotsEl.classList.toggle('is-fit', fit);
  if (!fit) { ['--cols', '--s', '--gap'].forEach(p => slotsEl.style.removeProperty(p)); return; }
  const W = slotsEl.clientWidth;
  if (!W) return;
  const gap = n > 40 ? 6 : n > 10 || window.innerWidth < 480 ? 8 : 12;
  const max = many ? 64 : 96; // 3–10: about the size the 5-column CSS gives on a full-width board
  const H = Math.max(80, slotHeightBudget());
  let best = null;
  for (let c = 5; c <= Math.max(5, Math.min(n, 20)); c++) { // never fewer than 5 columns (same look as the CSS for 3 / 5)
    const r = Math.ceil(n / c);
    const s = Math.min((W - (c - 1) * gap) / c, (H - (r - 1) * gap) / r, max);
    if (!best || s > best.s + 0.5) best = { c, s };
  }
  slotsEl.style.setProperty('--cols', String(best.c));
  slotsEl.style.setProperty('--s', `${Math.max(18, Math.floor(best.s))}px`);
  slotsEl.style.setProperty('--gap', `${gap}px`);
}

/** Height left for the slot grid: stage height minus its padding, the heading and the board chrome. */
function slotHeightBudget() {
  const px = (el, ...props) => { if (!el) return 0; const cs = getComputedStyle(el); return props.reduce((t, p) => t + (parseFloat(cs[p]) || 0), 0); };
  const isFull = document.fullscreenElement === stage || document.webkitFullscreenElement === stage || stage.classList.contains('is-expanded');
  const headerH = isFull ? 0 : ((document.querySelector('.tb-header') || {}).offsetHeight || 0);
  const stageH = isFull ? stage.clientHeight : Math.max(480, window.innerHeight - headerH);
  const heading = stage.querySelector('.tb-heading');
  const board = document.getElementById('tb-board');
  const top = board && board.querySelector('.tb-board-top');
  return stageH - px(stage, 'paddingTop', 'paddingBottom')
    - (heading && heading.offsetParent ? heading.offsetHeight + px(heading, 'marginBottom') : 0) // hidden on phones while the sheet is open
    - px(board, 'paddingTop', 'paddingBottom')
    - (top ? top.offsetHeight + px(top, 'marginBottom') : 0) - 8;
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
    signal('tool-start', { slots: String(model.slots), icon: freeIcon(model.icon) ? 'free' : 'locked', background: photoShown('background') ? 'photo' : model.background, os: osName(), lang: langTag() });
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
const CONFETTI_COLORS = ['#4DA3FF', '#7ED957', '#FFC443', '#FF7BAC', '#FFFFFF', '#FF8C42'];

/** Small confetti burst from the centre of the screen (free-day unlock): 28 pieces, ~1.5 s; the goal-reached
    celebration (60 falling pieces, overlay) stays the big one. Nothing under prefers-reduced-motion. */
function burstConfetti() {
  if (!stage || reducedMotion()) return;
  const box = document.createElement('div');
  box.className = 'tb-burst';
  box.setAttribute('aria-hidden', 'true');
  for (let n = 0; n < 28; n++) {
    const p = document.createElement('i');
    const a = Math.random() * Math.PI * 2;
    const dist = 110 + Math.random() * 160;
    p.style.setProperty('--dx', `${Math.round(Math.cos(a) * dist)}px`);
    p.style.setProperty('--dy', `${Math.round(Math.sin(a) * dist + 50)}px`); // a little gravity
    p.style.setProperty('--r', `${Math.round(Math.random() * 540 - 270)}deg`);
    p.style.setProperty('--d', `${(1.1 + Math.random() * 0.4).toFixed(2)}s`);
    p.style.setProperty('--c', CONFETTI_COLORS[n % CONFETTI_COLORS.length]);
    box.appendChild(p);
  }
  stage.appendChild(box); // inside the stage, so it also shows in fullscreen
  setTimeout(() => box.remove(), 1700);
}

function buildConfetti() {
  const box = overlay && overlay.querySelector('.tb-confetti');
  if (!box) return;
  box.replaceChildren();
  if (reducedMotion()) return;
  const colors = CONFETTI_COLORS;
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
  signal('board-complete', { slots: String(model.slots), tried: isFreeLook() ? 'no' : 'yes' });
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

/** Token goal 3–100 (clamped). Earned tokens are kept; if the new goal is smaller, the count is clamped to it. */
export function setSlots(n) {
  n = Math.round(Number(n));
  if (!Number.isFinite(n)) { syncPanel(); return; }
  n = Math.min(GOAL_MAX, Math.max(GOAL_MIN, n));
  if (n === model.slots) { syncPanel(); return; }
  const earned = Math.min(model.filled.length, n);
  const kept = model.filled.filter(i => i < n);
  for (let i = 0; kept.length < earned && i < n; i++) if (!kept.includes(i)) kept.push(i);
  model.slots = n;
  model.filled = kept.sort((a, b) => a - b);
  completing = false; clearTimeout(completeTimer);
  save(); render();
}
export function setIcon(e) {
  const i = iconByEmoji(e);
  if (!i || !(i.free || freeDayActive())) return; // locked icons cannot be selected
  model.icon = e; save(); render();
}
export function setReward(e) {
  const r = rewardByEmoji(e);
  if (!r || !(r.free || freeDayActive())) return; // locked rewards cannot be selected
  model.reward = e; model.rewardPhoto = false; save(); render();
}
export function setTitle(s) {
  model.title = String(s == null ? '' : s).trim().slice(0, TITLE_MAX); save(); render();
}
export function setBackground(id) {
  const b = bgById(id);
  if (!b || !(b.free || freeDayActive())) return; // locked / unknown backgrounds cannot be selected
  model.background = id; model.bgPhoto = false; save(); render();
}
/** Show / stop showing the own photo (kind "reward" | "background"). Turning it on needs a stored photo and a
    free day, or a board that already uses it. */
export function setPhotoOn(kind, on) {
  const key = kind === 'reward' ? 'rewardPhoto' : 'bgPhoto';
  if (on && !(photoUrl[kind] && (freeDayActive() || model[key]))) return;
  model[key] = !!on; save(); render();
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
  syncPanel(); // locks may have changed since the last render (local midnight)
  fitSlots();
  const first = panel.querySelector(FOCUSABLE);
  if (first) first.focus();
}

export function closePanel() {
  if (!stage || !panel || !stage.classList.contains('is-settings')) return;
  stage.classList.remove('is-settings');
  panel.setAttribute('aria-hidden', 'true');
  panel.removeAttribute('role'); panel.removeAttribute('aria-modal');
  if (settingsBtn) settingsBtn.setAttribute('aria-expanded', 'false');
  if (askThanks) { askThanks = false; syncAsk(freeDayActive()); }
  fitSlots();
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
// The stepper can change the goal many times in a row: one setting-change {what:'slots'} after 1 s of quiet.
let goalSignalTimer = 0;
const goalSignal = () => { clearTimeout(goalSignalTimer); goalSignalTimer = setTimeout(() => settingSignal('slots'), 1000); };

/* ---- free day: one tap unlocks ALL extras until local midnight; free, renewable any time, no limit ---- */
const FREE_DAYS = 1; // length of one free unlock in days; 1 = until tonight's local midnight
const TRIED_KEY = 'tb-tried'; // {until: last free day "YYYY-MM-DD" (local), nth: free days used, used: items tried in this free day,
                              //  asked: nth of the free day in which the would-pay question was answered or closed,
                              //  answers: would-pay answers given in this browser (× does not count)}
const GROUP = { icon: 'token', bg: 'background', reward: 'reward', 'photo-reward': 'photo-reward', 'photo-bg': 'photo-bg' };
// = pro-click item: token-<id> | bg-<id> | reward-<id> | photo-reward | photo-bg
const itemKey = (kind, id) => kind.startsWith('photo-') ? kind : `${kind === 'bg' ? 'bg' : kind === 'icon' ? 'token' : 'reward'}-${id}`;
const dateStr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
let triedMem = null; // also works when storage is blocked (private window): then it lasts until reload
function tried() {
  if (triedMem) return triedMem;
  let v = null;
  try { v = JSON.parse(localStorage.getItem(TRIED_KEY) || 'null'); } catch (e) { v = null; }
  triedMem = { until: '', nth: 0, used: [], asked: 0, answers: 0 };
  if (v && typeof v === 'object') {
    if (typeof v.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.until)) triedMem.until = v.until;
    if (Number.isInteger(v.nth) && v.nth >= 0) triedMem.nth = v.nth;
    if (Array.isArray(v.used)) triedMem.used = v.used.filter(x => typeof x === 'string').slice(0, 200);
    if (Number.isInteger(v.asked) && v.asked >= 0) triedMem.asked = v.asked;
    if (Number.isInteger(v.answers) && v.answers >= 0) triedMem.answers = v.answers;
  }
  return triedMem;
}
function saveTried() {
  try { localStorage.setItem(TRIED_KEY, JSON.stringify(tried())); } catch (e) { /* storage blocked: this page only */ }
}
const freeDayActive = () => { const u = tried().until; return !!u && dateStr(new Date()) <= u; };
function startFreeDay() {
  const t = tried();
  const end = new Date();
  end.setDate(end.getDate() + FREE_DAYS - 1);
  t.until = dateStr(end); t.nth += 1; t.used = [];
  saveTried();
}

/** Coarse OS from the user agent (no fingerprinting): shows the App Store link; sent as os in tool-start / would-pay.
    (Named os, not platform: TelemetryDeck's page views already fill a platform column with its own values.) */
function osName() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPod/.test(ua)) return 'ios';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ipados';
  if (/Macintosh|Mac OS X/.test(ua)) return 'mac';
  if (/CrOS/.test(ua)) return 'chromeos';
  if (/Android/.test(ua)) return 'android';
  if (/Windows/.test(ua)) return 'windows';
  if (/Linux/.test(ua)) return 'linux';
  return 'other';
}
const isApple = () => ['ios', 'ipados', 'mac'].includes(osName());
/** Browser language setting (e.g. "en-US"), not a location; "other" when empty or longer than 10 characters. */
const langTag = () => { const l = String((navigator && navigator.language) || '').trim(); return l && l.length <= 10 ? l : 'other'; };

function thumb({ kind, id, label, free, emoji, color }) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tb-thumb' + (kind === 'bg' ? ' tb-thumb-bg' : '');
  b.dataset.kind = kind; b.dataset.id = id; b.dataset.item = itemKey(kind, id); b.dataset.label = label;
  if (free) b.dataset.free = '1';
  b.setAttribute('aria-pressed', 'false');
  b.setAttribute('aria-label', label);
  if (kind === 'bg') { b.innerHTML = '<span class="tb-thumb-img"></span>'; b.firstChild.style.setProperty('--c', color); }
  else b.innerHTML = `<span class="tb-thumb-img">${emoji}</span>`;
  if (!free) b.insertAdjacentHTML('beforeend', LOCK_SVG); // the badge shows only while .is-locked
  return b;
}

function buildPanel() {
  if (!panelBody) return;
  const icons = document.getElementById('tb-icons');
  const bgs = document.getElementById('tb-bgs');
  const rewards = document.getElementById('tb-rewards');
  if (icons) icons.replaceChildren(...ICONS.map(i => thumb({ kind: 'icon', id: i.id, label: i.name, free: i.free, emoji: i.emoji })));
  if (bgs) bgs.replaceChildren(photoCell('background'), ...BACKGROUNDS.map(b => thumb({ kind: 'bg', id: b.id, label: b.name, free: b.free, color: b.color })));
  // Rewards: the photo tile, then the default (🎁 Gift), then the other free ones, then the locked ones.
  const ordered = [...REWARDS.filter(r => r.emoji === DEFAULT_REWARD), ...REWARDS.filter(r => r.free && r.emoji !== DEFAULT_REWARD), ...REWARDS.filter(r => !r.free)];
  if (rewards) rewards.replaceChildren(photoCell('reward'), ...ordered.map(r => thumb({ kind: 'reward', id: r.id, label: r.name, free: r.free, emoji: r.emoji })));
}

/** Panel controls reflect the model (called by render()). A locked item is shown selected only when the board
    still uses it (tried on an earlier day, or saved before it was locked). */
function syncPanel() {
  syncProCard();
  if (!panelBody) return;
  const input = document.getElementById('tb-title-input');
  if (input && document.activeElement !== input) input.value = model.title;
  const iconId = (iconByEmoji(model.icon) || ICONS[0]).id;
  const rewardId = photoShown('reward') ? 'photo' : (rewardByEmoji(model.reward) || {}).id;
  const bgId = photoShown('background') ? 'photo' : model.background;
  const active = freeDayActive();
  syncPhotoTiles(active);
  const line = document.getElementById('tb-freeday');
  if (line) line.hidden = !active;
  panelBody.querySelectorAll('.tb-hint').forEach(h => { h.hidden = active; });
  syncAsk(active);
  panelBody.querySelectorAll('.tb-thumb').forEach(b => {
    const locked = !b.dataset.free && !active;
    b.classList.toggle('is-locked', locked);
    b.setAttribute('aria-label', locked ? `${b.dataset.label}, locked` : b.dataset.label);
    const k = b.dataset.kind;
    const current = k === 'icon' ? iconId : (k === 'bg' || k === 'photo-bg') ? bgId : rewardId;
    b.setAttribute('aria-pressed', b.dataset.id === current ? 'true' : 'false');
  });
  panelBody.querySelectorAll('input[name="tb-slots"]').forEach(r => { r.checked = Number(r.value) === model.slots; });
  const goal = document.getElementById('tb-goal-input');
  if (goal && document.activeElement !== goal) goal.value = String(model.slots);
  panelBody.querySelectorAll('[data-goal]').forEach(b => {
    b.disabled = Number(b.dataset.goal) < 0 ? model.slots <= GOAL_MIN : model.slots >= GOAL_MAX;
  });
  const sound = document.getElementById('tb-sound');
  if (sound) { sound.checked = !!model.sound; sound.setAttribute('aria-checked', model.sound ? 'true' : 'false'); }
}

function nudge(btn) {
  btn.classList.add('is-nudge');
  setTimeout(() => btn.classList.remove('is-nudge'), 700);
}

/** Apply a tile that may be used (free, or during a free day); one setting-change when the value changes,
    plus try-use the first time a locked item is chosen in this free day. */
function selectTile(t) {
  if (t.dataset.kind === 'photo-reward' || t.dataset.kind === 'photo-bg') { selectPhotoTile(t); return; }
  const id = t.dataset.id;
  let changed = false;
  if (t.dataset.kind === 'icon') { const i = ICONS.find(x => x.id === id); if (i && i.emoji !== model.icon) { setIcon(i.emoji); changed = model.icon === i.emoji; if (changed) settingSignal('icon'); } }
  else if (t.dataset.kind === 'bg') { if (id !== model.background || model.bgPhoto) { setBackground(id); changed = model.background === id; if (changed) settingSignal('background'); } }
  else if (t.dataset.kind === 'reward') { const r = REWARDS.find(x => x.id === id); if (r && (r.emoji !== model.reward || model.rewardPhoto)) { setReward(r.emoji); changed = model.reward === r.emoji && !model.rewardPhoto; if (changed) settingSignal('reward'); } }
  if (t.dataset.kind === 'bg') changed = changed && !model.bgPhoto;
  if (changed) noteTryUse(t);
}
/** try-use: the first time a locked item is chosen during the current free day. */
function noteTryUse(t) {
  if (!t || t.dataset.free || !freeDayActive()) return;
  const tr = tried();
  if (tr.used.includes(t.dataset.item)) return;
  tr.used.push(t.dataset.item); saveTried();
  signal('try-use', { item: t.dataset.item, group: GROUP[t.dataset.kind] });
}

/* =====================================================================
   Own photo (reward + background): read and shrunk on the device, kept in this browser only
   ===================================================================== */
const PHOTO_MAX = { reward: 512, background: 1600 };    // long side in px after shrinking
const PHOTO_FILE_MAX = 30 * 1024 * 1024;                 // bigger files are refused before decoding
const PHOTO_DB = 'tb-photos', PHOTO_STORE = 'photos';
const photoUrl = { reward: '', background: '' };         // object / data URL of the stored photo (memory only)
const photoShown = kind => (kind === 'reward' ? model.rewardPhoto : model.bgPhoto) && photoUrl[kind] ? photoUrl[kind] : '';
const PHOTO_TEXT = {
  'too-large': 'This photo is too large. Please pick a smaller one.',
  'not-image': 'That file is not a photo. Please pick a JPG or PNG image.',
  decode: 'This photo can\'t be opened in this browser (HEIC?). Please pick a JPG or PNG.',
  quota: 'There is not enough space in this browser to save the photo.',
  other: 'Something went wrong with this photo. Please try another one.'
};
class PhotoError extends Error { constructor(reason) { super(reason); this.reason = reason; } }
const isQuota = e => !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22);

function idbOpen() {
  return new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(PHOTO_DB, 1); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => { req.result.createObjectStore(PHOTO_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked'));
  });
}
async function idbDo(mode, fn) {
  const db = await idbOpen();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, mode);
      const req = fn(tx.objectStore(PHOTO_STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error || (req && req.error));
      tx.onabort = () => reject(tx.error || new Error('abort'));
    });
  } finally { db.close(); }
}
const blobToDataUrl = blob => new Promise((resolve, reject) => {
  const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); r.readAsDataURL(blob);
});

/** Store the shrunk JPEG: IndexedDB (as bytes; old Safari cannot store Blobs), else localStorage as a data URL. */
async function photoPut(kind, blob) {
  const bytes = await blob.arrayBuffer();
  try { await idbDo('readwrite', s => s.put({ type: 'image/jpeg', bytes }, kind)); try { localStorage.removeItem('tb-photo-' + kind); } catch (e) { /* ignore */ } return; }
  catch (e) { if (isQuota(e)) throw new PhotoError('quota'); } // other IndexedDB failure (private window, old browser): fallback
  try { localStorage.setItem('tb-photo-' + kind, await blobToDataUrl(blob)); }
  catch (e) { throw new PhotoError(isQuota(e) ? 'quota' : 'other'); }
}
/** URL for a stored photo, or '' (nothing stored / storage blocked). */
async function photoGet(kind) {
  try {
    const v = await idbDo('readonly', s => s.get(kind));
    if (v && v.bytes) return URL.createObjectURL(new Blob([v.bytes], { type: v.type || 'image/jpeg' }));
  } catch (e) { /* fall through */ }
  try { const d = localStorage.getItem('tb-photo-' + kind); if (d && d.startsWith('data:image/')) return d; } catch (e) { /* ignore */ }
  return '';
}
async function photoDelete(kind) {
  try { await idbDo('readwrite', s => s.delete(kind)); } catch (e) { /* ignore */ }
  try { localStorage.removeItem('tb-photo-' + kind); } catch (e) { /* ignore */ }
}
function setPhotoUrl(kind, url) {
  const old = photoUrl[kind];
  if (old && old.startsWith('blob:') && old !== url) URL.revokeObjectURL(old);
  photoUrl[kind] = url || '';
}

/** Decode on the device (createImageBitmap, else <img> from a local blob: URL), never over the network. */
async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* try <img> */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new PhotoError('decode')); };
    img.src = url;
  });
}
/** File → shrunk JPEG Blob (white behind transparent PNGs). The file name is only used here, never stored or sent. */
async function preparePhoto(file, kind) {
  const looksImage = /^image\//.test(file.type || '') || /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp)$/i.test(file.name || '');
  if (!looksImage) throw new PhotoError('not-image');
  if (file.size > PHOTO_FILE_MAX) throw new PhotoError('too-large');
  let img;
  try { img = await decodeImage(file); } catch (e) { throw new PhotoError('decode'); }
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  if (!w || !h) throw new PhotoError('decode');
  const scale = Math.min(1, PHOTO_MAX[kind] / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new PhotoError('other');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  if (img.close) img.close();
  const blob = await new Promise(resolve => { try { canvas.toBlob(resolve, 'image/jpeg', 0.8); } catch (e) { resolve(null); } });
  if (!blob) throw new PhotoError('other');
  return blob;
}

/* ---- photo tiles in the panel (square like the others, first in Reward + Background) ---- */
const PHOTO_EMOJI = '🖼️';
const PLUS_BADGE = '<span class="tb-photo-plus" aria-hidden="true">+</span>'; // empty + not locked (the lock takes that corner)
const PENCIL_SVG = '<span class="tb-photo-edit" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg></span>';
function photoCell(kind) {
  const cell = document.createElement('div');
  cell.className = 'tb-photo-cell';
  const b = thumb({ kind: kind === 'reward' ? 'photo-reward' : 'photo-bg', id: 'photo', label: 'Add your own photo', free: false, emoji: PHOTO_EMOJI });
  b.classList.add('tb-thumb-photo');
  b.title = 'Your photo';
  b.insertAdjacentHTML('beforeend', PLUS_BADGE + PENCIL_SVG); // "+" while empty, pencil once a photo is set
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'tb-photo-remove';
  x.dataset.photoRemove = kind;
  x.setAttribute('aria-label', kind === 'reward' ? 'Remove the reward photo' : 'Remove the background photo');
  x.textContent = '×';
  x.hidden = true;
  cell.append(b, x);
  return cell;
}
const photoMsgUntil = { reward: 0, background: 0 }; // an error or progress text wins over the "saved" hint
function photoMsg(kind, text, ms = 6000) {
  const el = document.getElementById(`tb-photo-msg-${kind}`);
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('is-error', !!text && ms > 0);
  photoMsgUntil[kind] = text ? Date.now() + ms : 0;
  if (text && ms > 0) setTimeout(() => { if (Date.now() >= photoMsgUntil[kind]) { photoMsgUntil[kind] = 0; syncPanel(); } }, ms + 50);
}
/** Thumbnail, label, remove button and the "saved" hint (photo kept, but the free day is over). */
function syncPhotoTiles(active) {
  ['reward', 'background'].forEach(kind => {
    const tile = panelBody.querySelector(`.tb-thumb[data-kind="${kind === 'reward' ? 'photo-reward' : 'photo-bg'}"]`);
    if (!tile) return;
    const url = photoUrl[kind];
    const img = tile.querySelector('.tb-thumb-img');
    tile.classList.toggle('has-photo', !!url);
    if (img) {
      if (url) { img.textContent = ''; img.style.backgroundImage = `url("${url}")`; }
      else { img.style.backgroundImage = ''; img.textContent = PHOTO_EMOJI; }
    }
    tile.dataset.label = url ? 'Change your photo' : 'Add your own photo';
    const x = tile.parentElement && tile.parentElement.querySelector('.tb-photo-remove');
    if (x) x.hidden = !url; // deleting your own photo is always allowed, also when it is locked
    if (photoMsgUntil[kind] && Date.now() < photoMsgUntil[kind]) return;
    const el = document.getElementById(`tb-photo-msg-${kind}`);
    if (!el) return;
    el.classList.remove('is-error');
    el.textContent = url && !active && !photoShown(kind) ? 'Your photo is saved in this browser. Tap to use it again.' : '';
  });
}

/* ---- picking: one hidden <input type=file accept=image/*> (phones also offer the camera) ---- */
let pickFor = null;
function pickPhoto(kind, tile) {
  const input = document.getElementById('tb-photo-input');
  if (!input) return;
  pickFor = { kind, tile };
  input.value = '';
  try { input.click(); } catch (e) { pickFor = null; }
}
/** Photo tile while usable: no photo yet (or tapped while in use) → pick one; otherwise show the stored one. */
function selectPhotoTile(t) {
  const kind = t.dataset.kind === 'photo-reward' ? 'reward' : 'background';
  if (!photoUrl[kind] || photoShown(kind)) { pickPhoto(kind, t); return; }
  setPhotoOn(kind, true);
  if (photoShown(kind)) { settingSignal(kind); noteTryUse(t); }
}
async function onPhotoPicked(input) {
  const file = input.files && input.files[0];
  const job = pickFor;
  pickFor = null;
  input.value = ''; // the same file can be picked again; the File object itself is dropped after this
  if (!file || !job) return;
  const { kind, tile } = job;
  photoMsg(kind, 'Preparing your photo…', 15000);
  try {
    const blob = await preparePhoto(file, kind);
    await photoPut(kind, blob);
    setPhotoUrl(kind, URL.createObjectURL(blob));
    photoMsg(kind, '', 0);
    if (kind === 'reward') model.rewardPhoto = true; else model.bgPhoto = true;
    save(); render();
    signal('photo-set', { kind });
    settingSignal(kind);
    noteTryUse(tile);
  } catch (e) {
    const reason = e instanceof PhotoError ? e.reason : isQuota(e) ? 'quota' : 'other';
    photoMsg(kind, PHOTO_TEXT[reason] || PHOTO_TEXT.other);
    signal('photo-error', { kind, reason });
    syncPanel();
  }
  if (tile && document.contains(tile)) tile.focus();
}
async function removePhoto(kind) {
  await photoDelete(kind);
  setPhotoUrl(kind, '');
  if (kind === 'reward') model.rewardPhoto = false; else model.bgPhoto = false; // back to the emoji / colour
  save(); render();
  signal('photo-remove', { kind });
  const tile = panelBody && panelBody.querySelector(`.tb-thumb[data-kind="${kind === 'reward' ? 'photo-reward' : 'photo-bg'}"]`);
  if (tile) tile.focus();
}
/** On load: read stored photos (also when not in use, for the tile thumbnails). Missing / blocked = no photo. */
async function loadPhotos() {
  for (const kind of ['reward', 'background']) setPhotoUrl(kind, await photoGet(kind));
  render();
}

/** Locked tile: pro-click as before, then the unlock modal. */
function onLockedTap(btn) {
  signal('pro-click', { item: btn.dataset.item, from: 'panel' });
  nudge(btn);
  openUnlock(btn.dataset.item, GROUP[btn.dataset.kind], btn);
}

/* ---- unlock modal (#tb-unlock): centred over the page and the phone sheet; role=dialog, focus trapped ---- */
const unlockEl = document.getElementById('tb-unlock');
let unlockFor = { item: '', group: '', tile: null, back: null };
const unlockOpen = () => !!(unlockEl && !unlockEl.hidden);
function openUnlock(item, group, tile, back) {
  if (!unlockEl) return;
  unlockFor = { item, group, tile: tile || null, back: back || tile || document.activeElement };
  const app = unlockEl.querySelector('[data-unlock="app"]');
  if (app) app.hidden = !isApple();
  unlockEl.hidden = false;
  const go = unlockEl.querySelector('[data-unlock="go"]');
  if (go) go.focus();
}
function closeUnlock() {
  if (!unlockOpen()) return;
  unlockEl.hidden = true;
  const back = unlockFor.back;
  if (back && document.contains(back) && typeof back.focus === 'function') back.focus();
}
let unlockBusy = false; // between "Unlock" and the modal closing (preview bounce)
function onUnlockAction(action) {
  if (unlockBusy) return;
  const { item, group, tile } = unlockFor;
  if (action === 'go') {
    startFreeDay();
    signal('try-today', { item, group, nth: String(tried().nth) });
    if (!reducedMotion()) { // the preview emoji bounce once with the confetti, then the modal closes
      unlockBusy = true;
      burstConfetti();
      unlockEl.classList.add('is-bouncing');
      setTimeout(() => { unlockEl.classList.remove('is-bouncing'); unlockBusy = false; finishUnlock(tile, false); }, 450);
      return;
    }
    finishUnlock(tile, true);
  } else if (action === 'skip') {
    signal('try-skip', { item });
    closeUnlock();
  } // "app" is a plain App Store link: appstore-click.js sends appstore-click {position:"interest-modal"}
}
function finishUnlock(tile, withBurst) {
  const wasLocked = panelBody ? Array.from(panelBody.querySelectorAll('.tb-thumb.is-locked')) : [];
  closeUnlock(); // focus goes back to the tapped tile (or the #pro-card button)
  celebrateUnlock(wasLocked, withBurst);
  syncPanel();
  if (tile && document.contains(tile)) selectTile(tile); // apply the tapped item (it stays focused, now selected)
}
/** Unlock celebration: confetti burst, chime (Sound on only), lock badges pop off one after another (< 1 s in
    total) with a sparkle, the "✨ unlocked" line fades in with a glow. Reduced motion: only a calm fade.
    Purely visual: classes are added before syncPanel() removes .is-locked and cleared after 1.2 s; the
    panel stays usable all the time. */
function celebrateUnlock(tiles, withBurst) {
  if (withBurst) burstConfetti(); // (already started with the modal bounce otherwise)
  unlockChime();
  const calm = reducedMotion();
  const step = tiles.length > 1 ? Math.min(40, 550 / (tiles.length - 1)) : 0; // last pop starts by 550 ms
  tiles.forEach((t, n) => {
    t.style.setProperty('--d', `${Math.round(n * step)}ms`);
    t.classList.add(calm ? 'is-fading' : 'is-unlocking');
  });
  const line = document.getElementById('tb-freeday');
  if (line) line.classList.add('is-new');
  setTimeout(() => {
    tiles.forEach(t => { t.classList.remove('is-unlocking', 'is-fading'); t.style.removeProperty('--d'); });
    if (line) line.classList.remove('is-new');
  }, 1300);
}

/* ---- would-pay question: in the panel, from the 2nd free day on, once per free day ---- */
let askThanks = false; // the thank-you line stays until the panel closes
function syncAsk(active) {
  const box = document.getElementById('tb-ask');
  if (!box) return;
  const t = tried();
  const answered = t.asked === t.nth;
  box.hidden = !(active && t.nth >= 2 && (!answered || askThanks));
  box.querySelectorAll('[data-ask]').forEach(b => { b.hidden = answered; });
  if (!answered) { const th = document.getElementById('tb-ask-thanks'); if (th) th.textContent = ''; }
}
function onAsk(action) {
  const t = tried();
  t.asked = t.nth;
  if (action === 'yes' || action === 'no') t.answers += 1; // answerNo: 1 = first answer in this browser
  saveTried();
  if (action === 'yes' || action === 'no') {
    signal('would-pay', { answer: action, nth: String(t.nth), os: osName(), answerNo: String(t.answers), lang: langTag() });
    askThanks = true;
    const th = document.getElementById('tb-ask-thanks');
    if (th) th.textContent = action === 'yes' ? 'Thanks! Paid plans are not available yet — this helps us decide.' : 'Thanks for telling us!';
  } else askThanks = false; // × closes without an answer and without a signal
  syncAsk(freeDayActive());
}

function wireUnlock() {
  if (!unlockEl) return;
  unlockEl.addEventListener('click', ev => {
    if (ev.target === unlockEl) { onUnlockAction('skip'); return; } // tap on the backdrop = Not now
    const btn = ev.target && ev.target.closest ? ev.target.closest('[data-unlock]') : null;
    if (btn && unlockEl.contains(btn)) onUnlockAction(btn.dataset.unlock);
  });
}
function trapUnlock(ev) {
  if (ev.key === 'Escape') { ev.preventDefault(); onUnlockAction('skip'); return; }
  if (ev.key !== 'Tab') return;
  const items = Array.from(unlockEl.querySelectorAll(FOCUSABLE)).filter(el => el.offsetParent !== null);
  if (!items.length) { ev.preventDefault(); return; }
  const first = items[0], last = items[items.length - 1];
  if (ev.shiftKey && (document.activeElement === first || !unlockEl.contains(document.activeElement))) { ev.preventDefault(); last.focus(); }
  else if (!ev.shiftKey && (document.activeElement === last || !unlockEl.contains(document.activeElement))) { ev.preventDefault(); first.focus(); }
}

function wirePanel() {
  if (!panelBody) return;
  buildPanel();
  panelBody.addEventListener('click', ev => {
    const t = ev.target && ev.target.closest ? ev.target.closest('.tb-thumb, [data-fb], [data-ask], [data-photo-remove]') : null;
    if (!t) return;
    if (t.hasAttribute('data-photo-remove')) { removePhoto(t.dataset.photoRemove); return; }
    if (t.hasAttribute('data-fb')) { onFeedback(t.getAttribute('data-fb')); return; }
    if (t.hasAttribute('data-ask')) { onAsk(t.dataset.ask); return; }
    syncPanel(); // re-check the locks first (the try day may have ended while the panel was open)
    if (t.classList.contains('is-locked')) { onLockedTap(t); return; }
    selectTile(t);
  });
  wireUnlock();
  const input = document.getElementById('tb-title-input');
  if (input) {
    input.addEventListener('input', () => setTitle(input.value));
    input.addEventListener('change', () => settingSignal('title')); // once per edit, never the text
  }
  panelBody.querySelectorAll('input[name="tb-slots"]').forEach(r => r.addEventListener('change', () => {
    const n = Number(r.value);
    if (r.checked && n !== model.slots) { setSlots(n); goalSignal(); }
  }));
  panelBody.querySelectorAll('[data-goal]').forEach(b => b.addEventListener('click', () => {
    const before = model.slots;
    setSlots(model.slots + Number(b.dataset.goal));
    if (model.slots !== before) goalSignal();
    if (b.disabled) { const goal = document.getElementById('tb-goal-input'); if (goal) goal.focus(); } // keep focus in the panel at 3 / 100
  }));
  const goal = document.getElementById('tb-goal-input');
  if (goal) {
    goal.addEventListener('change', () => { // Enter or leaving the field; typing alone never re-renders the board
      const before = model.slots;
      setSlots(goal.value);
      goal.value = String(model.slots); // shows the clamped value (e.g. 250 → 100, 1 → 3)
      if (model.slots !== before) goalSignal();
    });
    goal.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); goal.blur(); goal.focus(); } });
  }
  const sound = document.getElementById('tb-sound');
  if (sound) sound.addEventListener('change', () => {
    setSound(sound.checked);
    showStatus(model.sound ? 'Sound on' : 'Sound off');
    settingSignal('sound');
  });
}

/* ---- board name: editable in place on the board (same model.title as the panel field) ---- */
function wireBoardTitle() {
  if (!titleEl) return;
  titleEl.setAttribute('contenteditable', 'plaintext-only');
  if (titleEl.contentEditable !== 'plaintext-only') titleEl.setAttribute('contenteditable', 'true'); // older browsers
  titleEl.setAttribute('role', 'textbox');
  titleEl.setAttribute('aria-label', 'Board name');
  titleEl.setAttribute('spellcheck', 'false');
  let before = '';
  titleEl.addEventListener('focus', () => { before = model.title; });
  titleEl.addEventListener('input', () => {
    let text = (titleEl.textContent || '').replace(/[\r\n]+/g, ' ');
    const tooLong = text.length > TITLE_MAX;
    if (tooLong) text = text.slice(0, TITLE_MAX);
    if (tooLong || titleEl.children.length) { // pasted markup or too long: back to plain text, caret at the end
      titleEl.textContent = text;
      try { const r = document.createRange(); r.selectNodeContents(titleEl); r.collapse(false); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } catch (e) { /* ignore */ }
    }
    setTitle(text);
  });
  titleEl.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' || ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); titleEl.blur(); }
  });
  titleEl.addEventListener('blur', () => {
    titleEl.textContent = model.title;
    if (model.title !== before) settingSignal('title'); // once per edit, never the text
  });
}

/* ---- card below the fold (#pro-card): its button opens the same unlock modal (item "extras") + pro-view ---- */
function syncProCard() {
  const btn = document.querySelector('#pro-card [data-unlock-open]');
  if (!btn) return;
  const active = freeDayActive();
  btn.disabled = active;
  btn.textContent = active ? '✨ All extras unlocked until midnight' : 'Try all extras free for today';
}
function wireProCard() {
  const card = document.getElementById('pro-card');
  if (!card) return;
  const btn = card.querySelector('[data-unlock-open]');
  if (btn) btn.addEventListener('click', () => { syncProCard(); if (!btn.disabled) openUnlock('extras', 'extras', null, btn); });
  syncProCard();
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
  fitSlots();
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
  fitSlots();
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

function onFsChange() { setFsLabel(nativeActive()); requestAnimationFrame(fitSlots); }

/* =====================================================================
   Wiring
   ===================================================================== */
if (stage) {
  // Board: restore before first render; panel grids exist before render() so syncPanel() can mark them.
  load();
  wirePanel();
  wireBoardTitle();
  render();
  loadPhotos();
  const photoInput = document.getElementById('tb-photo-input');
  if (photoInput) photoInput.addEventListener('change', () => onPhotoPicked(photoInput));
  // Refit a big goal when the stage changes size (window, panel on tablets, fullscreen on / off).
  let fitFrame = 0;
  const refit = () => { cancelAnimationFrame(fitFrame); fitFrame = requestAnimationFrame(fitSlots); };
  if (typeof ResizeObserver === 'function') { try { new ResizeObserver(refit).observe(stage); } catch (e) { /* ignore */ } }
  window.addEventListener('resize', refit);
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
    if (unlockOpen() || (unlockEl && unlockEl.contains(ev.target))) return; // the modal sits over the panel
    if (ev.target && ev.target.id === 'tb-photo-input') return; // the file picker's click is not a tap outside
    closePanel();
  });
  document.addEventListener('keydown', ev => {
    if (unlockOpen()) { trapUnlock(ev); return; } // modal first: Escape = Not now, Tab stays inside
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
        try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem('tb-fs-hint'); localStorage.removeItem(TRIED_KEY); } catch (e) { /* ignore */ }
        Promise.all([photoDelete('reward'), photoDelete('background')]).finally(() => {
          try { location.reload(); } catch (e) { /* not available in some test runners */ }
        });
      },
      slots3() { setSlots(3); }, slots5() { setSlots(5); }, slots10() { setSlots(10); },
      soundToggle() { setSound(!model.sound); showStatus(model.sound ? 'Sound on' : 'Sound off'); },
      setTitlePrompt() {
        let v = null;
        try { v = window.prompt(`Board title (max ${TITLE_MAX} characters)`, model.title); } catch (e) { v = null; }
        if (v !== null) setTitle(v);
      },
      bgBlue() { setBackground('blue'); }, bgWhite() { setBackground('white'); },
      // free day without changing the clock: expire it, set nth, or forget everything
      freeDayExpired() {
        const d = new Date(); d.setDate(d.getDate() - 1);
        tried().until = dateStr(d); saveTried(); syncPanel(); showStatus('Free day → expired (yesterday)');
      },
      // nth → 3 with an active free day and the question not yet answered: the would-pay card shows in the panel
      nth3() {
        const t = tried(); t.nth = 3; t.asked = 0; t.used = [];
        if (!freeDayActive()) t.until = dateStr(new Date());
        askThanks = false; saveTried(); syncPanel(); showStatus('Free day active, nth → 3');
      },
      clearTried() { triedMem = { until: '', nth: 0, used: [], asked: 0, answers: 0 }; try { localStorage.removeItem(TRIED_KEY); } catch (e) { /* ignore */ } syncPanel(); showStatus('Free-day data cleared'); },
      sessionPlus3() { sessionStart = (sessionStart || Date.now()) - 3 * 60 * 1000; showStatus('Session start moved back 3 min'); },
      setSessionStart(ts) { sessionStart = ts; },
      simulatePagehide() { window.dispatchEvent(new Event('pagehide')); },
      simulateIdle() { endSession(); } // what the 10-min idle timer does
    });
    // Test mode only: warn in the console when the page is wider than the window, naming the widest culprits.
    const checkOverflow = () => {
      const vw = document.documentElement.clientWidth;
      if (document.documentElement.scrollWidth <= vw) return;
      // the outermost elements that stick out (their parent still fits), not every descendant
      const wide = Array.from(document.body.querySelectorAll('*')).filter(el => el.getBoundingClientRect().right > vw + 1 && el.parentElement.getBoundingClientRect().right <= vw + 1);
      console.warn('[tb] horizontal overflow', document.documentElement.scrollWidth, '>', vw, wide.slice(0, 5));
    };
    window.addEventListener('load', checkOverflow);
    window.addEventListener('resize', () => { clearTimeout(window.__tbOvf); window.__tbOvf = setTimeout(checkOverflow, 300); });
  }
}
