/*
  token-board.app — free online token board, tool script (ES module, no dependencies, no build).
  Design authority: docs/tool-spec.md (repo-internal). Protected facts: CLAUDE.md § Browser tool.
  Paid unlock contract: worker/README.md § 8 (browser side; § 8.4 = the offer dialog, entry points, signals).

  Boards (T16, 2026-11-18, ?v=20261118a; docs/tool-spec.md § Boards): up to 20 boards per browser in localStorage
    tb-boards (the old tb-board is migrated as the legacy board 1 and keeps a copy of the active board). A third pill
    "🗂️ Boards" opens the same panel with another body (#tb-boards-body): switch, + New board, Duplicate, Delete
    (inline confirm; never the last board). One board is free; more boards are part of the unlock. Photos per board
    (key <id>:<kind>; the legacy board keeps <kind>). Storage full: nothing is added, a clear message.
    ?v=20261118b: "🗂️ Boards" + "🎨 Style" move to a toolbar top right (#tb-tools, solid blue); only the gold
    "✨ Unlock all extras" stays under the board (#tb-actions, hidden as a whole when unlocked).
  Paid unlock (Step 5a, 2026-11-14, ?v=20261114a; Step 5b ?v=20261114b: the html class tbu-has-key follows "unlocked",
    a failed load of unlock.js shows the status pill for 4 s; 5b-fix ?v=20261114c: retry on the return from payment /
    a restore link, a line under the price card when its buttons could not load unlock.js; Step 6a ?v=20261115a: only UNLOCK_V —
    unlock.js got the 15 s time limit for real Worker calls and the restore-field attributes; go-live ?v=20261116a: only UNLOCK_V —
    the default API of unlock.js is the live API): the one-time unlock replaces the earlier trial of the extras.
    "unlocked" = localStorage tb-license holds a key that passes the key regex (read synchronously at the start,
    try/catch, in-memory fallback); it decides every lock (tiles, goal stepper + number input, photo tiles,
    setters). A saved board keeps a locked item, a photo and a goal outside 3 / 5 / 10 until the user changes it.
    Entry points: a locked tile / the locked goal stepper or number input (from "panel"), "✨ Unlock all extras"
    under the board ("toolbar") and in the celebration ("celebration") → pro-click {item, from}, then the offer
    dialog of unlock.js (loaded lazily: import('./unlock.js?v=' + UNLOCK_V) — never on first paint for a normal
    visitor). The price card #pro-card in #pricing starts the payment directly ("card", no pro-click). When the
    page becomes unlocked the lock badges pop off (reduced motion: a calm fade); nothing is applied automatically,
    no sound. The ✨ buttons and the panel hints are hidden when unlocked. Gate: on body[data-tbu-gate]
    (tool-test.html) without localStorage tb-dev = "1" there is no unlock UI at all (a locked tap only nudges).
    Signals: tool-start and board-complete carry unlocked "yes" | "no"; unlock.js sends dialog-open, unlock-click,
    unlock-success, unlock-cancel, unlock-fail, unlock-restore-attempt (never the key, the email, the device id
    or the session id). localStorage tb-tried is deleted on load.
  Panel redesign (2026-10-21): light panel; groups Board name, Token goal, Token icon, Background, Reward,
    Sound. Token goal = any whole number 3–100 (quick picks 3 / 5 / 10 + stepper + number input); goals
    over 10 fit the slot grid to the free space (fitSlots). Board name is also editable in place on the
    board. Signals unchanged (slots = exact number as text). ?v=20261021a.
  Own photo (2026-10-21): the 🖼️ photo tile is the first tile in Reward and Background, locked like the other
    extras. The photo is read and shrunk on the device only (canvas → JPEG 0.8, reward ≤ 512 px, background
    ≤ 1600 px long side) and kept in IndexedDB "tb-photos" (fallback: localStorage tb-photo-<kind> as a data
    URL). The original file is never stored and nothing is uploaded. Model flags rewardPhoto / bgPhoto. Signals:
    photo-set {kind}, photo-remove {kind}, photo-error {kind, reason} (never the image, its name or size).

  Easier to find (2026-10-23): the ⚙ corner button is gone. Under the board: "🎨 Style" (opens the panel,
    title "Style your board") and the ✨ button (see Paid unlock); the row is hidden in fullscreen. A tap on the
    reward circle opens the panel at Reward (panel body scrolls, the page does not). The board title is already
    editable in place, so it does not open the panel. Empty-board hint "Tap a circle to add a token" until the
    first slot tap (localStorage tb-hint). Signals: settings-open {from, nth, completed} once per page load
    (localStorage tb-settings {count}). ?v=20261023a.
  Title + saved line (2026-10-23, ?v=20261023b): default board title "I am working for" (was "My board"; a stored
    "My board" is shown as the new default, any other title stays). The hint line becomes "Your board is saved on
    this device" after the first slot tap and on later visits (hidden in fullscreen). Focus rings on the pills, the
    reward circle and every panel button (× too) only for keyboard use (html.tb-pointer after a mouse / touch press, removed on any key).
  Fullscreen + celebration (2026-10-23, ?v=20261023d): fullscreen shows only the board card and the exit button (H1,
    privacy line, buttons row and the line under the circles hidden); the board may grow to 960 px and the circles
    are fitted to the freed height (max 160 px for goals 3–10, 96 px above 10). Celebration: overlay .94; Hooray /
    ✨ button focus ring only after a key press.
  More locks (T15, 2026-10-25, ?v=20261025a; merged 2026-10-25):
    only the defaults are free — token ⭐, background white, reward 🎁, goals 3 / 5 / 10 (quick picks). Other icons,
    backgrounds and rewards are locked like before; the goal stepper − / + and the number input are locked too
    (read-only, ", locked" in the accessible name; a click / tap, Enter / Space, a typed key or a paste opens the
    offer, Tab focus alone does not). T15b (?v=20261025b): the lock badge only on the number input (not on − / +);
    the goal hint sits under the stepper row ("🔒 Other numbers are locked — …"). A saved board keeps a
    now-locked item or a goal outside 3 / 5 / 10. Signals: pro-click {item "goal-stepper", from "panel"};
    board-complete tried also counts such a goal.
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
  tb-feedback {ts}, tb-visits {count, first}, tb-hint ("1" = empty-board hint done), tb-settings {count} (page loads
  with a panel open), tb-license (the license key; read here, written by unlock.js). IndexedDB: tb-photos (store
  photos: reward, background).
*/

import { send, isTestMode as signalsTestMode } from './assets/tool-signals.js?v=20261114d';

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
const FREE_GOALS = [3, 5, 10]; // the quick picks; any other goal (stepper / number input) is an extra (T15)
// Catalogs (CLAUDE.md § Browser tool, T15: only the defaults are free — icon ⭐, background white; all others locked).
const ICONS = [
  ['star', '⭐', 'Star', true], ['heart', '❤️', 'Heart'], ['smile', '😊', 'Smiling face'],
  ['sun', '☀️', 'Sun'], ['moon', '🌙', 'Moon'], ['rainbow', '🌈', 'Rainbow'], ['unicorn', '🦄', 'Unicorn'],
  ['rocket', '🚀', 'Rocket'], ['robot', '🤖', 'Robot'], ['cat', '🐱', 'Cat'], ['dog', '🐶', 'Dog'],
  ['teddy', '🧸', 'Teddy bear'], ['dinosaur', '🦖', 'Dinosaur'], ['butterfly', '🦋', 'Butterfly'],
  ['ladybug', '🐞', 'Ladybug'], ['bee', '🐝', 'Bee'], ['fish', '🐟', 'Fish'], ['octopus', '🐙', 'Octopus'],
  ['car', '🚗', 'Car'], ['train', '🚂', 'Train'], ['plane', '✈️', 'Plane'], ['football', '⚽', 'Football'],
  ['basketball', '🏀', 'Basketball']
].map(([id, emoji, name, free]) => ({ id, emoji, name, free: !!free }));
const BACKGROUNDS = [
  ['white', '#FFFFFF', 'White', true], ['blue', '#D9ECFF', 'Light blue'],
  ['green', '#DFF5E3', 'Green'], ['yellow', '#FFF3C4', 'Yellow'], ['pink', '#FFE0EC', 'Pink'],
  ['purple', '#EADDFF', 'Purple'], ['grey', '#E9EAEE', 'Grey'], ['navy', '#1E2A44', 'Navy', false, true]
].map(([id, color, name, free, dark]) => ({ id, color, name, free: !!free, dark: !!dark }));
// Free rewards (T15, 2026-10-25): only the default 🎁 (2026-10-21 – T15: also 🧸 🍦 📺 🎮 🎨 📚 ⚽ 🌳 🎵). All others locked.
const FREE_REWARDS = ['🎁'];
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
const isFreeLook = () => !!(FREE_GOALS.includes(model.slots) && freeIcon(model.icon) && (bgById(model.background) || {}).free && (rewardByEmoji(model.reward) || {}).free && !model.rewardPhoto && !model.bgPhoto);
const TITLE_MAX = 40;
const DEFAULT_TITLE = 'I am working for'; // 2026-10-23; was "My board" (migrated in sanitize)

const defaults = () => ({
  slots: 10, filled: [], title: DEFAULT_TITLE, icon: '⭐', reward: DEFAULT_REWARD, background: 'white',
  rewardPhoto: false, bgPhoto: false // true = show the own photo (kept in IndexedDB) instead of reward / background
});

/* ---- Boards (T16, 2026-11-18; docs/tool-spec.md § Boards): up to 20 boards per browser, one is active.
   localStorage tb-boards = {v: 1, active, sound, boards: [{id, slots, filled, title, icon, reward, background,
   rewardPhoto, bgPhoto, legacy?}]}. model = the ACTIVE board (an object inside boards). Sound is one setting for
   the browser. The board migrated from tb-board has legacy: true and keeps the photo keys "reward" / "background"
   (no photo is moved); every other board uses "<id>:reward" / "<id>:background". tb-board keeps a copy of the
   active board (old format + id / legacy): a rollback to the old tool still shows a board, and a broken
   tb-boards is rebuilt from it. The id is local only and never sent. ---- */
const BOARDS_KEY = 'tb-boards';
const BOARDS_MAX = 20;
const ID_RE = /^[a-z0-9]{8}$/;
let model = Object.assign(defaults(), { id: 'board001' });
let boards = [model];
let soundOn = true;
let storageBlocked = false; // localStorage cannot be used at all (some private windows): work in memory, silently

function newId() {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  for (;;) {
    let s = '';
    let r = null;
    try { r = crypto.getRandomValues(new Uint8Array(8)); } catch (e) { r = null; }
    for (let i = 0; i < 8; i++) s += abc[(r ? r[i] : Math.floor(Math.random() * 256)) % abc.length];
    if (!boards.some(b => b.id === s)) return s;
  }
}
/** A stored board (or anything) → a valid board with an id; legacy only when stored as legacy. */
function sanitizeBoard(raw) {
  const m = sanitize(raw);
  m.id = raw && typeof raw.id === 'string' && ID_RE.test(raw.id) ? raw.id : '';
  if (raw && raw.legacy === true) m.legacy = true;
  return m;
}

function sanitize(raw) {
  const m = defaults();
  if (!raw || typeof raw !== 'object') return m;
  if (isGoal(raw.slots)) m.slots = raw.slots;
  if (typeof raw.title === 'string') m.title = raw.title.trim().slice(0, TITLE_MAX);
  if (m.title === 'My board') m.title = DEFAULT_TITLE; // the old default; a title the user typed stays
  // Any catalog item and any goal 3–100 is restored, also a locked one: a board in use (e.g. in class) keeps an
  // item that was tried for a day, or that was free before 2026-10-21 / T15, until the user picks something else.
  if (typeof raw.icon === 'string' && iconByEmoji(raw.icon)) m.icon = raw.icon;
  if (raw.reward === '🛝') raw.reward = '🎠'; // removed 2026-10-21 (new emoji, missing on older systems): closest = carousel
  if (typeof raw.reward === 'string' && rewardByEmoji(raw.reward)) m.reward = raw.reward;
  if (typeof raw.background === 'string' && bgById(raw.background)) m.background = raw.background;
  if (typeof raw.rewardPhoto === 'boolean') m.rewardPhoto = raw.rewardPhoto; // a board in use keeps its photo
  if (typeof raw.bgPhoto === 'boolean') m.bgPhoto = raw.bgPhoto;
  if (Array.isArray(raw.filled)) {
    m.filled = [...new Set(raw.filled.filter(i => Number.isInteger(i) && i >= 0 && i < m.slots))].sort((a, b) => a - b);
  }
  return m;
}

function readJSON(k) {
  try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}

/** Restore the boards. Order: tb-boards; else (none, or broken) migrate tb-board as board 1; else one default board.
    Never an empty list, never an active id outside the list. */
function load() {
  try { localStorage.getItem(BOARDS_KEY); } catch (e) { storageBlocked = true; }
  const st = readJSON(BOARDS_KEY);
  const list = [];
  if (st && typeof st === 'object' && Array.isArray(st.boards)) {
    for (const raw of st.boards) {
      if (list.length >= BOARDS_MAX) break;
      if (!raw || typeof raw !== 'object') continue;
      const b = sanitizeBoard(raw);
      boards = list; // newId() checks the ids taken so far
      if (!b.id || list.some(x => x.id === b.id)) b.id = newId();
      list.push(b);
    }
  }
  if (list.length) {
    boards = list;
    soundOn = typeof st.sound === 'boolean' ? st.sound : true;
    model = boards.find(b => b.id === st.active) || boards[0];
    return;
  }
  const old = readJSON(STORAGE_KEY);
  const has = !!old && typeof old === 'object';
  boards = [];
  const b = sanitizeBoard(has ? old : null);
  if (!b.id) b.id = newId();
  // A board from before T16 (no id) owns the photos under "reward" / "background": it becomes the legacy board.
  if (has && (old.legacy === true || !(typeof old.id === 'string' && ID_RE.test(old.id)))) b.legacy = true;
  soundOn = has && typeof old.sound === 'boolean' ? old.sound : true;
  boards = [b];
  model = b;
  if (has) save(); // the new format from now on (tb-board itself is kept, see above)
}

/** Write the boards. Returns "ok", "quota" (storage full: the caller undoes its change) or "blocked". */
function saveBoards() {
  if (storageBlocked) return 'blocked';
  try {
    localStorage.setItem(BOARDS_KEY, JSON.stringify({ v: 1, active: model.id, sound: soundOn, boards }));
  } catch (e) { return isQuota(e) ? 'quota' : 'blocked'; }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.assign({}, model, { sound: soundOn }))); } catch (e) { /* the copy is a spare */ }
  return 'ok';
}
function save() { saveBoards(); /* a failed write: the board still works in memory for this page load */ }

/* ---------------- Web Audio (lazy, tap-only, never when sound is off) ---------------- */
let audioCtx = null;
function audio() {
  if (!soundOn) return null;
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
const celebrateExtrasBtn = stage && stage.querySelector('[data-tb="celebrate-extras"]');
let completedThisLoad = false; // settings-open {completed}: a board was completed in this page load
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
  if (rewardEl) rewardEl.setAttribute('aria-label', (rPhoto ? 'Reward: your photo' : `Reward: ${((rewardByEmoji(model.reward) || {}).name || model.reward).toLowerCase()}`) + '. Tap to change');
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
  const full = isFullscreen();
  const fit = many || full || stage.classList.contains('is-settings'); // fullscreen: the board grows into the freed space
  stage.classList.toggle('is-many', many);
  slotsEl.classList.toggle('is-fit', fit);
  if (!fit) { ['--cols', '--s', '--gap'].forEach(p => slotsEl.style.removeProperty(p)); return; }
  const W = slotsEl.clientWidth;
  if (!W) return;
  const gap = n > 40 ? 6 : n > 10 || window.innerWidth < 480 ? 8 : 12;
  const max = full ? (many ? 96 : 160) : many ? 64 : 96; // 3–10: about the size the 5-column CSS gives on a full-width board
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

const isFullscreen = () => !!stage && (document.fullscreenElement === stage || document.webkitFullscreenElement === stage || stage.classList.contains('is-expanded'));

/** Height left for the slot grid: stage height minus its padding, the heading and the board chrome. */
function slotHeightBudget() {
  const px = (el, ...props) => { if (!el) return 0; const cs = getComputedStyle(el); return props.reduce((t, p) => t + (parseFloat(cs[p]) || 0), 0); };
  const isFull = isFullscreen();
  const headerH = isFull ? 0 : ((document.querySelector('.tb-header') || {}).offsetHeight || 0);
  const stageH = isFull ? stage.clientHeight : Math.max(480, window.innerHeight - headerH);
  const heading = stage.querySelector('.tb-heading');
  const board = document.getElementById('tb-board');
  const top = board && board.querySelector('.tb-board-top');
  const shown = el => el && el.offsetParent ? el.offsetHeight + px(el, 'marginTop', 'marginBottom') : 0; // 0 while hidden
  return stageH - px(stage, 'paddingTop', 'paddingBottom')
    - (heading && heading.offsetParent ? heading.offsetHeight + px(heading, 'marginBottom') : 0) // hidden on phones while the sheet is open
    - px(board, 'paddingTop', 'paddingBottom')
    - (top ? top.offsetHeight + px(top, 'marginBottom') : 0)
    - shown(document.getElementById('tb-empty-hint'))
    - shown(document.getElementById('tb-actions')) - 8; // hidden in fullscreen
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
    signal('tool-start', { slots: String(model.slots), icon: freeIcon(model.icon) ? 'free' : 'locked', background: photoShown('background') ? 'photo' : model.background, os: osName(), lang: langTag(), unlocked: unlocked ? 'yes' : 'no', boards: boardsBucket() });
  }
}

function tapSlot(i) {
  noteTap();
  hintDone();
  if (model.filled.includes(i)) unfill(i); else fill(i);
}

/* ---------------- line under the circles: "Tap a circle to add a token" until the first slot tap in this
   browser, then "Your board is saved on this device" (rest of the page load and every later visit) ---------------- */
const HINT_KEY = 'tb-hint';
const HINT_TEXT = 'Tap a circle to add a token', SAVED_TEXT = 'Your board is saved on this device';
const hintEl = document.getElementById('tb-empty-hint');
function showHint() {
  if (!hintEl) return;
  let done = false;
  try { done = localStorage.getItem(HINT_KEY) === '1'; } catch (e) { /* storage blocked: the hint until the first tap */ }
  hintEl.hidden = false;
  hintEl.textContent = done || model.filled.length > 0 ? SAVED_TEXT : HINT_TEXT;
}
function hintDone() {
  try { localStorage.setItem(HINT_KEY, '1'); } catch (e) { /* ignore */ }
  if (hintEl) hintEl.textContent = SAVED_TEXT; // same line, same height: no refit needed
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
  completedThisLoad = true;
  if (celebrateExtrasBtn) celebrateExtrasBtn.hidden = unlocked || !unlockUi; // only while locked
  stage.classList.add('is-complete');
  if (overlay) overlay.setAttribute('aria-hidden', 'false');
  celebrationTone();
  if (hoorayBtn) hoorayBtn.focus();
  signal('board-complete', { slots: String(model.slots), tried: isFreeLook() ? 'no' : 'yes', unlocked: unlocked ? 'yes' : 'no' });
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
/** The active board + the sound setting (tests, tool-test.html). */
export function getModel() { return JSON.parse(JSON.stringify(Object.assign({}, model, { sound: soundOn }))); }

/** Token goal 3–100 (clamped). Earned tokens are kept; if the new goal is smaller, the count is clamped to it.
    While locked only the quick picks 3 / 5 / 10 can be set (T15). */
export function setSlots(n) {
  n = Math.round(Number(n));
  if (!Number.isFinite(n)) { syncPanel(); return; }
  n = Math.min(GOAL_MAX, Math.max(GOAL_MIN, n));
  if (n === model.slots || !(FREE_GOALS.includes(n) || unlocked)) { syncPanel(); return; }
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
  if (!i || !(i.free || unlocked)) return; // locked icons cannot be selected
  model.icon = e; save(); render();
}
export function setReward(e) {
  const r = rewardByEmoji(e);
  if (!r || !(r.free || unlocked)) return; // locked rewards cannot be selected
  model.reward = e; model.rewardPhoto = false; save(); render();
}
export function setTitle(s) {
  model.title = String(s == null ? '' : s).trim().slice(0, TITLE_MAX); save(); render();
}
export function setBackground(id) {
  const b = bgById(id);
  if (!b || !(b.free || unlocked)) return; // locked / unknown backgrounds cannot be selected
  model.background = id; model.bgPhoto = false; save(); render();
}
/** Show / stop showing the own photo (kind "reward" | "background"). Turning it on needs a stored photo and the
    unlock, or a board that already uses it. */
export function setPhotoOn(kind, on) {
  const key = kind === 'reward' ? 'rewardPhoto' : 'bgPhoto';
  if (on && !(curPhoto(kind) && (unlocked || model[key]))) return;
  model[key] = !!on; save(); render();
}
export function setSound(on) {
  soundOn = !!on; save(); syncPanel();
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

/* settings-open {from, nth, completed}: once per page load (the first open); nth = page loads in this browser in
   which the panel was opened (localStorage tb-settings {count}); completed = a board was completed before it. */
const SETTINGS_KEY = 'tb-settings';
let settingsOpenSent = false;
function noteSettingsOpen(from) {
  if (settingsOpenSent) return;
  settingsOpenSent = true;
  let v = null;
  try { v = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); } catch (e) { v = null; }
  const count = (v && Number.isInteger(v.count) && v.count >= 0 ? v.count : 0) + 1;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ count })); } catch (e) { /* ignore */ }
  signal('settings-open', { from, nth: String(count), completed: completedThisLoad ? 'yes' : 'no' });
}

/** Scroll the panel body (never the page) so a group is at the top, and focus its selected tile. */
function showSection(name) {
  const grid = panelBody && document.getElementById(name === 'reward' ? 'tb-rewards' : `tb-${name}`);
  const sec = grid && grid.closest('.tb-set');
  if (!sec) return;
  const x = window.scrollX || 0, y = window.scrollY || 0;
  const tile = grid.querySelector('.tb-thumb[aria-pressed="true"]') || grid.querySelector('.tb-thumb');
  if (tile) { try { tile.focus({ preventScroll: true }); } catch (e) { tile.focus(); } }
  panelBody.scrollTop += sec.getBoundingClientRect().top - panelBody.getBoundingClientRect().top - 8;
  if ((window.scrollX || 0) !== x || (window.scrollY || 0) !== y) window.scrollTo(x, y); // old browsers ignore preventScroll
}

/** opts: mode "style" (default) | "boards" (T16: the same panel, other body); from "button" | "reward" | "title"
    (settings-open, style only), section "reward" = open at that group. Opening the other mode while the panel is
    open switches its body. */
export function openPanel(opts) {
  const o = opts || {};
  const mode = o.mode === 'boards' ? 'boards' : 'style';
  if (!stage || !panel) return;
  const wasOpen = stage.classList.contains('is-settings');
  if (wasOpen && mode === panelMode) { if (o.section) showSection(o.section); return; }
  if (mode === 'boards' && isFullscreen()) return; // no board switcher in fullscreen
  if (!wasOpen) {
    lastFocus = document.activeElement;
    stage.classList.add('is-settings');
    panel.setAttribute('aria-hidden', 'false');
    // Phone: the panel is a full-stage sheet, so it is a modal dialog; desktop: a side panel next to the board.
    if (isPhone()) { panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); }
    else { panel.removeAttribute('role'); panel.removeAttribute('aria-modal'); }
  }
  setPanelMode(mode);
  if (mode === 'boards') {
    syncPanel();
    loadUnlock(); // a fast first tap on a locked "+ New board"
    fitSlots();
    renderBoards();
    loadBoardThumbs();
    const cur = boardsBody && boardsBody.querySelector('.tb-brow.is-active .tb-bpick');
    if (cur) cur.focus();
    return;
  }
  maybeShowFeedback();
  syncPanel();
  loadUnlock(); // the panel line (unlocked) and a fast first tap on a locked tile
  fitSlots();
  noteSettingsOpen(o.from || 'button');
  if (o.section) { showSection(o.section); return; }
  if (panelBody) panelBody.scrollTop = 0;
  const first = panel.querySelector(FOCUSABLE);
  if (first) first.focus();
}

export function closePanel() {
  if (!stage || !panel || !stage.classList.contains('is-settings')) return;
  stage.classList.remove('is-settings');
  panel.setAttribute('aria-hidden', 'true');
  panel.removeAttribute('role'); panel.removeAttribute('aria-modal');
  const back0 = panelMode === 'boards' ? boardsBtn : settingsBtn;
  // both pills aria-expanded false; the header text stays while the panel slides out (the next open sets its mode)
  [settingsBtn, boardsBtn].forEach(b => { if (b) b.setAttribute('aria-expanded', 'false'); });
  closeConfirm(false);
  if (unlockCtl) unlockCtl.panelClosed(); // "Show" (the key) lasts until the panel closes
  fitSlots();
  const back = (lastFocus && document.contains(lastFocus)) ? lastFocus : back0;
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
   Boards panel (T16, 2026-11-18; docs/tool-spec.md § Boards): list, switch, + New board, Duplicate, Delete.
   Titles are user text: always textContent, never in a signal.
   ===================================================================== */
const boardsBody = document.getElementById('tb-boards-body');
const boardsBtn = stage && stage.querySelector('[data-tb="boards"]');
let panelMode = 'style';
let boardsBusy = false; // a Duplicate is copying its photos
const COPY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>';
const TRASH_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
const BOARDS_TEXT = {
  hint: '🔒 More boards are locked — tap to unlock all extras.',
  max: `${BOARDS_MAX} boards is the most for this browser. Delete one to add a new one.`,
  note: 'Boards are saved in this browser only.',
  full: 'Storage is full — no new board was added. Delete a board or a photo to make room.',
  failed: 'Something went wrong — no new board was added. Please try again.'
};
const boardName = b => b.title || `Board ${boards.indexOf(b) + 1}`;

function setPanelMode(mode) {
  panelMode = mode;
  const isBoards = mode === 'boards';
  if (panelBody) panelBody.hidden = isBoards;
  if (boardsBody) boardsBody.hidden = !isBoards;
  const title = isBoards ? 'Your boards' : 'Style your board';
  const head = document.getElementById('tb-panel-title');
  if (head) head.textContent = title;
  if (panel) panel.setAttribute('aria-label', title);
  const x = panel && panel.querySelector('.tb-panel-head [data-tb="close"]');
  if (x) x.setAttribute('aria-label', isBoards ? 'Close the boards panel' : 'Close the style panel');
  const open = !!stage && stage.classList.contains('is-settings');
  if (settingsBtn) settingsBtn.setAttribute('aria-expanded', open && !isBoards ? 'true' : 'false');
  if (boardsBtn) boardsBtn.setAttribute('aria-expanded', open && isBoards ? 'true' : 'false');
}
const boardsOpen = () => !!stage && stage.classList.contains('is-settings') && panelMode === 'boards';

/** The list. Keeps the focus on the same control (by role + board id) when it is rebuilt. */
function renderBoards() {
  if (!boardsBody) return;
  const a = document.activeElement;
  const keep = a && boardsBody.contains(a) ? [['bpick', 'bdup', 'bdel', 'bnew'].find(k => a.dataset && k in a.dataset), a.dataset && (a.dataset.bpick || a.dataset.bdup || a.dataset.bdel)] : null;
  const canAdd = boards.length < BOARDS_MAX;
  const hint = document.createElement('p');
  hint.className = 'tb-hint';
  hint.textContent = BOARDS_TEXT.hint;
  const list = document.createElement('ul');
  list.className = 'tb-blist';
  list.setAttribute('aria-label', 'Your boards');
  boards.forEach(b => {
    const name = boardName(b);
    const active = b === model;
    const li = document.createElement('li');
    li.className = 'tb-brow' + (active ? ' is-active' : '');
    li.dataset.id = b.id;
    const pick = unlockApi.button('tb-bpick', `${name}, ${b.filled.length} of ${b.slots} tokens${active ? ', current board' : ''}`);
    pick.dataset.bpick = b.id;
    if (active) pick.setAttribute('aria-current', 'true');
    const rw = document.createElement('span');
    rw.className = 'tb-brew';
    rw.setAttribute('aria-hidden', 'true');
    const photo = b.rewardPhoto ? photoCache.get(photoKey(b, 'reward')) : '';
    if (photo) rw.style.backgroundImage = `url("${photo}")`; else rw.textContent = b.reward;
    const nm = document.createElement('span');
    nm.className = 'tb-bname';
    nm.textContent = name;
    const cnt = document.createElement('span');
    cnt.className = 'tb-bcount';
    cnt.setAttribute('aria-hidden', 'true');
    cnt.textContent = `${b.filled.length} / ${b.slots}`;
    pick.append(rw, nm, cnt);
    const dup = unlockApi.button('tb-bicon', `Duplicate ${name}`);
    dup.dataset.bdup = b.id;
    dup.dataset.label = `Duplicate ${name}`;
    dup.innerHTML = COPY_SVG + LOCK_SVG;
    dup.disabled = !canAdd;
    const del = unlockApi.button('tb-bicon', `Delete ${name}`);
    del.dataset.bdel = b.id;
    del.innerHTML = TRASH_SVG;
    del.hidden = boards.length <= 1; // the last board can never be deleted
    li.append(pick, dup, del);
    list.appendChild(li);
  });
  const add = unlockApi.button('tb-bnew', '', '+ New board');
  add.dataset.bnew = '';
  add.dataset.label = 'New board';
  add.insertAdjacentHTML('beforeend', LOCK_SVG);
  add.disabled = !canAdd;
  const max = document.createElement('p');
  max.className = 'tb-bmax';
  max.textContent = BOARDS_TEXT.max;
  max.hidden = canAdd;
  const note = document.createElement('p');
  note.className = 'tb-photo-note';
  note.textContent = BOARDS_TEXT.note;
  boardsBody.replaceChildren(hint, list, add, max, note);
  syncBoardLocks();
  if (keep && keep[0]) {
    const el = keep[0] === 'bnew' ? add : boardsBody.querySelector(`[data-${keep[0]}="${keep[1]}"]`);
    if (el && !el.disabled && !el.hidden) el.focus();
  }
}
/** One board is free; more boards are an extra (T16): "+ New board" and Duplicate carry the lock while locked.
    A browser that already has several boards keeps them (switch, rename, delete work). */
function syncBoardLocks() {
  if (!boardsBody) return;
  const locked = !unlocked;
  const h = boardsBody.querySelector('.tb-hint');
  if (h) h.hidden = !locked;
  boardsBody.querySelectorAll('[data-bdup],[data-bnew]').forEach(b => { b.classList.toggle('is-locked', locked); lockLabel(b, locked); });
}
/** A locked "+ New board" / Duplicate: pro-click {item, from "boards"}, nudge, the offer dialog. Adds nothing. */
function onBoardLocked(btn, item) {
  if (unlockUi) signal('pro-click', { item, from: 'boards' });
  nudge(btn);
  if (unlockUi) openOffer('boards', btn);
}
/** Board count as a bucket for signals (never an id, a title or a position). */
const boardsBucket = (n = boards.length) => n <= 1 ? '1' : n === 2 ? '2' : n <= 5 ? '3-5' : n <= 10 ? '6-10' : '11-20';

/** Reward photos of the other boards, for the list (read once, then from memory). */
async function loadBoardThumbs() {
  let changed = false;
  for (const b of boards.slice()) {
    const key = photoKey(b, 'reward');
    if (!b.rewardPhoto || photoCache.has(key)) continue;
    setPhotoUrl(key, await photoGet(key));
    changed = true;
  }
  if (changed && boardsOpen() && !boardsBody.querySelector('.tb-bconfirm')) renderBoards();
}

/** Show board b (the panel closes). The status pill names it. */
function switchBoard(id) {
  const b = boards.find(x => x.id === id);
  if (!b) return;
  const changed = b !== model;
  if (changed) {
    model = b;
    completing = false; clearTimeout(completeTimer);
    save(); render(); showHint(); loadPhotos();
    signal('board-switch', { boards: boardsBucket() });
  }
  closePanel();
  if (changed) showStatus(`Board: ${boardName(b)}`);
}

/** Put the caret in the board title on the board, text selected (after + New board / Duplicate). */
function editTitle() {
  if (!titleEl) return;
  try { titleEl.focus({ preventScroll: true }); } catch (e) { titleEl.focus(); }
  try { const r = document.createRange(); r.selectNodeContents(titleEl); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } catch (e) { /* ignore */ }
}

/** Ask the browser to keep this site's storage (Chrome / Edge decide without a prompt, Safari supports it).
    Not on Firefox: it can show a permission prompt, which would confuse a child. Once per page load. */
let persistAsked = false;
function requestPersist() {
  if (persistAsked || boards.length < 2) return;
  persistAsked = true;
  try {
    if (/Firefox\//.test(navigator.userAgent || '')) return;
    const st = navigator.storage;
    if (st && typeof st.persist === 'function') { const r = st.persist(); if (r && r.catch) r.catch(() => {}); }
  } catch (e) { /* ignore */ }
}

/** + New board (src = null: the defaults) or Duplicate (src = a board: same style and photos in use, 0 tokens).
    Saved first; storage full = nothing added (also no copied photo left behind). */
async function addBoard(src) {
  if (boardsBusy || boards.length >= BOARDS_MAX || !unlocked) return; // more boards = an extra
  const b = Object.assign(defaults(), src ? JSON.parse(JSON.stringify(src)) : {}, { filled: [] });
  delete b.legacy;
  b.id = newId();
  boardsBusy = true;
  const copied = [];
  const dropCopies = () => Promise.all(copied.map(k => photoDelete(k)));
  try {
    if (src) {
      for (const kind of ['reward', 'background']) {
        const flag = kind === 'reward' ? 'rewardPhoto' : 'bgPhoto';
        if (!src[flag]) continue; // only the photos the board shows
        const to = photoKey(b, kind);
        if (await photoCopy(photoKey(src, kind), to)) copied.push(to); else b[flag] = false;
      }
    }
  } catch (e) {
    await dropCopies();
    boardsBusy = false;
    showStatus(e && e.reason === 'quota' ? BOARDS_TEXT.full : BOARDS_TEXT.failed, 4000);
    return;
  }
  const at = src ? boards.indexOf(src) + 1 : boards.length;
  const prev = model;
  boards.splice(at, 0, b);
  model = b;
  if (saveBoards() === 'quota') {
    boards.splice(boards.indexOf(b), 1);
    model = prev;
    await dropCopies();
    boardsBusy = false;
    if (boardsOpen()) renderBoards();
    showStatus(BOARDS_TEXT.full, 4000);
    return;
  }
  boardsBusy = false;
  signal('board-add', { via: src ? 'duplicate' : 'new', boards: boardsBucket() });
  completing = false; clearTimeout(completeTimer);
  closePanel();
  render(); showHint(); loadPhotos();
  requestPersist();
  editTitle();
}

/** Delete with the inline confirm. The last board is never deleted; the active one hands over to the row above. */
function askDelete(id) {
  closeConfirm(false);
  const row = boardsBody && boardsBody.querySelector(`.tb-brow[data-id="${id}"]`);
  const b = boards.find(x => x.id === id);
  if (!row || !b || boards.length <= 1) return;
  const box = document.createElement('div');
  box.className = 'tb-bconfirm';
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', 'Delete board');
  const q = document.createElement('p');
  q.textContent = `Delete “${boardName(b)}”? Its tokens and photos are removed from this browser.`;
  const yes = unlockApi.button('tb-bbtn tb-bbtn-del', '', 'Delete');
  yes.dataset.bconfirmDel = id;
  const no = unlockApi.button('tb-bbtn', '', 'Cancel');
  no.dataset.bconfirmCancel = id;
  box.append(q, yes, no);
  row.appendChild(box);
  no.focus();
}
/** Close the inline confirm; refocus = back to its Delete button. True when one was open. */
function closeConfirm(refocus) {
  const box = boardsBody && boardsBody.querySelector('.tb-bconfirm');
  if (!box) return false;
  const id = box.querySelector('[data-bconfirm-cancel]').dataset.bconfirmCancel;
  box.remove();
  if (refocus) { const d = boardsBody.querySelector(`[data-bdel="${id}"]`); if (d) d.focus(); }
  return true;
}
async function deleteBoard(id) {
  const at = boards.findIndex(x => x.id === id);
  if (at < 0 || boards.length <= 1) return;
  const b = boards[at];
  const wasActive = b === model;
  const prev = model;
  boards.splice(at, 1);
  if (wasActive) model = boards[Math.max(0, at - 1)];
  if (saveBoards() === 'quota') { boards.splice(at, 0, b); model = prev; showStatus(BOARDS_TEXT.failed.replace('no new board was added', 'the board was not deleted'), 4000); renderBoards(); return; }
  for (const kind of ['reward', 'background']) {
    const key = photoKey(b, kind);
    setPhotoUrl(key, '');
    photoCache.delete(key);
    photoDelete(key); // after the save: a failed save never loses a photo
  }
  signal('board-delete', { boards: boardsBucket() });
  if (wasActive) { completing = false; clearTimeout(completeTimer); render(); showHint(); loadPhotos(); }
  renderBoards();
  const next = boardsBody.querySelector(`[data-bpick="${boards[Math.max(0, at - 1)].id}"]`);
  if (next) next.focus();
}

function wireBoards() {
  if (!boardsBody) return;
  boardsBody.addEventListener('click', ev => {
    const t = ev.target && ev.target.closest ? ev.target.closest('button') : null;
    if (!t || !boardsBody.contains(t) || t.disabled) return;
    const d = t.dataset;
    if ('bpick' in d) { switchBoard(d.bpick); return; }
    if ('bconfirmDel' in d) { deleteBoard(d.bconfirmDel); return; }
    if ('bconfirmCancel' in d) { closeConfirm(true); return; }
    if ('bdel' in d) { askDelete(d.bdel); return; }
    if ('bdup' in d) {
      if (t.classList.contains('is-locked')) { onBoardLocked(t, 'board-duplicate'); return; }
      const src = boards.find(x => x.id === d.bdup); if (src) addBoard(src); return;
    }
    if ('bnew' in d) { if (t.classList.contains('is-locked')) onBoardLocked(t, 'board-new'); else addBoard(null); }
  });
}

/* =====================================================================
   Settings panel content (T3): grids, controls, locked items, feedback
   ===================================================================== */
const panelBody = document.getElementById('tb-panel-body');
const LOCK_SVG = '<span class="tb-lock" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zm-7-2a2 2 0 0 1 4 0v2h-4V7z"/></svg></span>';
let settingSignal = what => signal('setting-change', { what });
// The stepper can change the goal many times in a row: one setting-change {what:'slots'} after 1 s of quiet.
let goalSignalTimer = 0;
const goalSignal = () => { clearTimeout(goalSignalTimer); goalSignalTimer = setTimeout(() => settingSignal('slots'), 1000); };

/* ---- paid unlock (one-time; worker/README.md § 8.4): ONE source of truth = a valid license key in localStorage
   "tb-license". It is read synchronously here (try/catch, in-memory fallback, R26); no network call decides it.
   unlock.js (the offer dialog, the payment, restore) is loaded lazily and calls unlockApi.setUnlocked(). ---- */
const LICENSE_KEY = 'tb-license';
// the key regex of worker/README.md § 7.1 (unlock.js has the same one; tests/unlock.mjs compares them)
const KEY_RE = /^TB-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;
const lsMem = {}; // in-memory fallback when storage is blocked (private window): lasts until reload
function lsGet(k) {
  try { const v = localStorage.getItem(k); if (v !== null) return v; } catch (e) { /* storage blocked */ }
  return Object.prototype.hasOwnProperty.call(lsMem, k) ? lsMem[k] : null;
}
function lsSet(k, v) {
  lsMem[k] = String(v);
  try { localStorage.setItem(k, String(v)); } catch (e) { /* storage blocked: this page only */ }
}
const readUnlocked = () => KEY_RE.test(lsGet(LICENSE_KEY) || '');
let unlocked = readUnlocked();
try { localStorage.removeItem('tb-tried'); } catch (e) { /* ignore */ } // data of the earlier trial of the extras (removed 2026-11-14): an active trial ends here
// Gate (tool-test.html = body[data-tbu-gate]): without localStorage tb-dev = "1" there is no unlock UI at all
// (the ✨ buttons and the pricing section are hidden, a locked tap only nudges, unlock.js is never loaded).
const unlockUi = !(document.body && document.body.hasAttribute('data-tbu-gate')) || lsGet('tb-dev') === '1';
// = pro-click item: token-<id> | bg-<id> | reward-<id> | photo-reward | photo-bg
const itemKey = (kind, id) => kind.startsWith('photo-') ? kind : `${kind === 'bg' ? 'bg' : kind === 'icon' ? 'token' : 'reward'}-${id}`;

/** Coarse OS from the user agent (no fingerprinting): sent as os in tool-start.
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
    still uses it (saved before it was locked, or while another browser state had it unlocked). */
function syncPanel() {
  syncUnlockButtons();
  if (!panelBody) return;
  const input = document.getElementById('tb-title-input');
  if (input && document.activeElement !== input) input.value = model.title;
  const iconId = (iconByEmoji(model.icon) || ICONS[0]).id;
  const rewardId = photoShown('reward') ? 'photo' : (rewardByEmoji(model.reward) || {}).id;
  const bgId = photoShown('background') ? 'photo' : model.background;
  const active = unlocked; // every extra is usable
  syncPhotoTiles(active);
  panelBody.querySelectorAll('.tb-hint').forEach(h => { h.hidden = active; });
  panelBody.querySelectorAll('.tb-thumb').forEach(b => {
    const locked = !b.dataset.free && !active;
    b.classList.toggle('is-locked', locked);
    b.setAttribute('aria-label', locked ? `${b.dataset.label}, locked` : b.dataset.label);
    const k = b.dataset.kind;
    const current = k === 'icon' ? iconId : (k === 'bg' || k === 'photo-bg') ? bgId : rewardId;
    b.setAttribute('aria-pressed', b.dataset.id === current ? 'true' : 'false');
  });
  panelBody.querySelectorAll('input[name="tb-slots"]').forEach(r => { r.checked = Number(r.value) === model.slots; });
  // Goal stepper + number input: an extra (T15); locked = read-only, ", locked" in the name, lock badges (CSS).
  const stepper = panelBody.querySelector('.tb-stepper');
  if (stepper) stepper.classList.toggle('is-locked', !active);
  const goal = document.getElementById('tb-goal-input');
  if (goal) {
    if (document.activeElement !== goal) goal.value = String(model.slots);
    goal.readOnly = !active;
    lockLabel(goal, !active);
  }
  panelBody.querySelectorAll('[data-goal]').forEach(b => {
    b.disabled = Number(b.dataset.goal) < 0 ? model.slots <= GOAL_MIN : model.slots >= GOAL_MAX;
    lockLabel(b, !active);
  });
  const sound = document.getElementById('tb-sound');
  if (sound) { sound.checked = soundOn; sound.setAttribute('aria-checked', soundOn ? 'true' : 'false'); }
}

/** Accessible name with ", locked" while locked (base name kept in data-label, like the tiles). */
function lockLabel(el, locked) {
  if (!el.dataset.label) el.dataset.label = el.getAttribute('aria-label') || '';
  el.setAttribute('aria-label', locked ? `${el.dataset.label}, locked` : el.dataset.label);
}

function nudge(btn) {
  btn.classList.add('is-nudge');
  setTimeout(() => btn.classList.remove('is-nudge'), 700);
}

/** Apply a tile that may be used (free, or unlocked); one setting-change when the value changes. */
function selectTile(t) {
  if (t.dataset.kind === 'photo-reward' || t.dataset.kind === 'photo-bg') { selectPhotoTile(t); return; }
  const id = t.dataset.id;
  let changed = false;
  if (t.dataset.kind === 'icon') { const i = ICONS.find(x => x.id === id); if (i && i.emoji !== model.icon) { setIcon(i.emoji); changed = model.icon === i.emoji; if (changed) settingSignal('icon'); } }
  else if (t.dataset.kind === 'bg') { if (id !== model.background || model.bgPhoto) { setBackground(id); changed = model.background === id; if (changed) settingSignal('background'); } }
  else if (t.dataset.kind === 'reward') { const r = REWARDS.find(x => x.id === id); if (r && (r.emoji !== model.reward || model.rewardPhoto)) { setReward(r.emoji); changed = model.reward === r.emoji && !model.rewardPhoto; if (changed) settingSignal('reward'); } }
}
/** One step of − / +. */
function stepGoal(b) {
  const before = model.slots;
  setSlots(model.slots + Number(b.dataset.goal));
  if (model.slots !== before) goalSignal();
  if (b.disabled) { const goal = document.getElementById('tb-goal-input'); if (goal) goal.focus(); } // keep focus in the panel at 3 / 100
}
const goalLocked = () => !unlocked;

/* =====================================================================
   Own photo (reward + background): read and shrunk on the device, kept in this browser only
   ===================================================================== */
const PHOTO_MAX = { reward: 512, background: 1600 };    // long side in px after shrinking
const PHOTO_FILE_MAX = 30 * 1024 * 1024;                 // bigger files are refused before decoding
const PHOTO_DB = 'tb-photos', PHOTO_STORE = 'photos';
// T16: photos are stored per board. Key = "<kind>" for the legacy board (migrated from tb-board), else "<id>:<kind>".
const photoKey = (b, kind) => b.legacy ? kind : `${b.id}:${kind}`;
const photoCache = new Map();                            // photo key → object / data URL ('' = checked, none); memory only
const curPhoto = kind => photoCache.get(photoKey(model, kind)) || '';
const photoShown = kind => (kind === 'reward' ? model.rewardPhoto : model.bgPhoto) && curPhoto(kind) ? curPhoto(kind) : '';
const PHOTO_TEXT = {
  'too-large': 'This photo is too large. Please pick a smaller one.',
  'not-image': 'That file is not a photo. Please pick a JPG or PNG image.',
  decode: 'This photo can\'t be opened in this browser (HEIC?). Please pick a JPG or PNG.',
  quota: 'Storage is full — the photo was not saved. Remove a photo or delete a board to make room.',
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
async function photoPut(key, blob) {
  const bytes = await blob.arrayBuffer();
  try { await idbDo('readwrite', s => s.put({ type: 'image/jpeg', bytes }, key)); try { localStorage.removeItem('tb-photo-' + key); } catch (e) { /* ignore */ } return; }
  catch (e) { if (isQuota(e)) throw new PhotoError('quota'); } // other IndexedDB failure (private window, old browser): fallback
  try { localStorage.setItem('tb-photo-' + key, await blobToDataUrl(blob)); }
  catch (e) { throw new PhotoError(isQuota(e) ? 'quota' : 'other'); }
}
/** Copy a stored photo to another key (Duplicate). false = nothing stored under from. Throws PhotoError on failure. */
async function photoCopy(from, to) {
  let rec = null;
  try { rec = await idbDo('readonly', s => s.get(from)); } catch (e) { rec = null; }
  if (rec && rec.bytes) {
    try { await idbDo('readwrite', s => s.put(rec, to)); return true; }
    catch (e) { throw new PhotoError(isQuota(e) ? 'quota' : 'other'); }
  }
  let d = null;
  try { d = localStorage.getItem('tb-photo-' + from); } catch (e) { d = null; }
  if (!d) return false;
  try { localStorage.setItem('tb-photo-' + to, d); return true; }
  catch (e) { throw new PhotoError(isQuota(e) ? 'quota' : 'other'); }
}
/** URL for a stored photo, or '' (nothing stored / storage blocked). */
async function photoGet(key) {
  try {
    const v = await idbDo('readonly', s => s.get(key));
    if (v && v.bytes) return URL.createObjectURL(new Blob([v.bytes], { type: v.type || 'image/jpeg' }));
  } catch (e) { /* fall through */ }
  try { const d = localStorage.getItem('tb-photo-' + key); if (d && d.startsWith('data:image/')) return d; } catch (e) { /* ignore */ }
  return '';
}
async function photoDelete(key) {
  try { await idbDo('readwrite', s => s.delete(key)); } catch (e) { /* ignore */ }
  try { localStorage.removeItem('tb-photo-' + key); } catch (e) { /* ignore */ }
}
function setPhotoUrl(key, url) {
  const old = photoCache.get(key);
  if (old && old.startsWith('blob:') && old !== url) { try { URL.revokeObjectURL(old); } catch (e) { /* ignore */ } }
  photoCache.set(key, url || '');
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
/** Thumbnail, label, remove button and the "saved" hint (photo kept in this browser, but locked). */
function syncPhotoTiles(active) {
  ['reward', 'background'].forEach(kind => {
    const tile = panelBody.querySelector(`.tb-thumb[data-kind="${kind === 'reward' ? 'photo-reward' : 'photo-bg'}"]`);
    if (!tile) return;
    const url = curPhoto(kind);
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
    el.textContent = url && !active && !photoShown(kind) ? 'Your photo is saved in this browser. Unlock all extras to use it again.' : '';
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
  if (!curPhoto(kind) || photoShown(kind)) { pickPhoto(kind, t); return; }
  setPhotoOn(kind, true);
  if (photoShown(kind)) settingSignal(kind);
}
async function onPhotoPicked(input) {
  const file = input.files && input.files[0];
  const job = pickFor;
  pickFor = null;
  input.value = ''; // the same file can be picked again; the File object itself is dropped after this
  if (!file || !job) return;
  const { kind, tile } = job;
  const board = model, key = photoKey(model, kind); // the board the photo was picked for (a switch may follow)
  photoMsg(kind, 'Preparing your photo…', 15000);
  try {
    const blob = await preparePhoto(file, kind);
    await photoPut(key, blob); // a failed write keeps the photo stored before under this key
    setPhotoUrl(key, URL.createObjectURL(blob));
    photoMsg(kind, '', 0);
    if (kind === 'reward') board.rewardPhoto = true; else board.bgPhoto = true;
    save(); render();
    signal('photo-set', { kind });
    settingSignal(kind);
  } catch (e) {
    const reason = e instanceof PhotoError ? e.reason : isQuota(e) ? 'quota' : 'other';
    photoMsg(kind, PHOTO_TEXT[reason] || PHOTO_TEXT.other);
    signal('photo-error', { kind, reason });
    syncPanel();
  }
  if (tile && document.contains(tile)) tile.focus();
}
async function removePhoto(kind) {
  const board = model, key = photoKey(model, kind);
  await photoDelete(key);
  setPhotoUrl(key, '');
  if (kind === 'reward') board.rewardPhoto = false; else board.bgPhoto = false; // back to the emoji / colour
  save(); render();
  signal('photo-remove', { kind });
  const tile = panelBody && panelBody.querySelector(`.tb-thumb[data-kind="${kind === 'reward' ? 'photo-reward' : 'photo-bg'}"]`);
  if (tile) tile.focus();
}
/** On load: read stored photos (also when not in use, for the tile thumbnails). Missing / blocked = no photo. */
async function loadPhotos() {
  const b = model;
  for (const kind of ['reward', 'background']) {
    const key = photoKey(b, kind);
    if (!photoCache.has(key)) setPhotoUrl(key, await photoGet(key));
  }
  if (b === model) render(); // the board may have changed while reading
}

/* =====================================================================
   Paid unlock: entry points + the bridge to unlock.js (worker/README.md § 8.4)
   ===================================================================== */
const UNLOCK_V = '20261118a'; // bump with every change to unlock.js (which also bumps tool.js's own ?v=)
const importUnlock = () => import('./unlock.js?v=' + UNLOCK_V);
let unlockCtl = null;     // the controller returned by unlock.js init(api)
let unlockLoading = null; // the one import promise
/** Load unlock.js once (never on a gated page without tb-dev). Resolves to the controller, or null. */
function loadUnlock() {
  if (!unlockUi) return Promise.resolve(null);
  if (unlockCtl) return Promise.resolve(unlockCtl);
  if (!unlockLoading) {
    unlockLoading = importUnlock()
      .then(m => { unlockCtl = m.default(unlockApi); clearCardLoadFail(); return unlockCtl; })
      .catch(() => { unlockLoading = null; return null; }); // e.g. offline: the next tap tries again
  }
  return unlockLoading;
}
/** Open the offer dialog. from = panel | toolbar | celebration; back = the element that gets the focus back. */
function openOffer(from, back) {
  // pending: the page came back from payment / a restore link and unlock.js is not in yet. Its init handles that
  // session or key itself (and opens the dialog), so this tap must not open a second view or start a second request.
  const pending = !!window.__tbUnlock;
  loadUnlock().then(c => {
    if (!c) { unlockLoadFailed(); return; }
    if (!pending) c.show(from, back || null);
  });
}
/** unlock.js could not be loaded after a tap on an entry point (offline): the status pill for 4 s. No signal;
    the next tap tries the import again (loadUnlock forgets a failed promise). */
const LOAD_FAILED_TEXT = 'Could not load the unlock — check your connection and try again.';
function unlockLoadFailed() { showStatus(LOAD_FAILED_TEXT, 4000); }
/** The same text as a small line under the price card's buttons (the pill above the board is out of view there). */
function cardLoadFailed(card) {
  let line = card.querySelector('.tbu-load-fail');
  if (!line) {
    line = document.createElement('p');
    line.className = 'tbu-msg is-error tbu-load-fail';
    line.setAttribute('role', 'status');
    const after = card.querySelector('[data-tbu-restore]');
    if (after && after.parentNode) after.parentNode.insertBefore(line, after.nextSibling);
    else (card.querySelector('[data-tbu-actions]') || card).appendChild(line);
  }
  line.textContent = LOAD_FAILED_TEXT;
}
function clearCardLoadFail() { document.querySelectorAll('.tbu-load-fail').forEach(n => n.remove()); }
/** The page came back from payment or was opened by a restore link (window.__tbUnlock) and unlock.js does not load:
    retry up to 3 times, 2 s apart; then the status pill for 6 s. No signal. window.__tbUnlock stays as it is (only
    unlock.js clears it), so a later load — the next tap, the next panel open, the "online" event — handles it. */
const RETURN_RETRIES = 3, RETURN_RETRY_MS = 2000;
function loadForReturn(attempt) {
  loadUnlock().then(c => {
    if (c || !window.__tbUnlock) return; // loaded (also by a tap in the meantime)
    if (attempt < RETURN_RETRIES) { setTimeout(() => loadForReturn(attempt + 1), RETURN_RETRY_MS); return; }
    showStatus(LOAD_FAILED_TEXT, 6000);
  });
}
/** Locked tile: pro-click as before, nudge, then the offer dialog. Gated page without tb-dev: only the nudge. */
function onLockedTap(btn) {
  if (unlockUi) signal('pro-click', { item: btn.dataset.item, from: 'panel' });
  nudge(btn);
  if (unlockUi) openOffer('panel', btn);
}
/** Locked goal stepper / number input (T15): pro-click {item "goal-stepper"}, then the offer dialog. */
function onGoalLocked(el) {
  if (!unlockUi) { nudge(el); return; }
  signal('pro-click', { item: 'goal-stepper', from: 'panel' });
  openOffer('panel', el);
}
/** The ✨ buttons (under the board, celebration): pro-click {item "extras", from}, then the offer dialog. */
function openExtras(from, back) {
  if (!unlockUi || unlocked) return;
  signal('pro-click', { item: 'extras', from });
  openOffer(from, back);
}

/** The page became unlocked (unlock.js stored the key): flip the flag, pop the lock badges, re-sync the panel and
    the buttons. Nothing is applied automatically (no tapped tile, no stepper step). */
function setUnlocked() {
  const was = unlocked;
  unlocked = readUnlocked();
  if (unlocked && !was) celebrateUnlock(panelBody ? Array.from(panelBody.querySelectorAll('.tb-thumb.is-locked')) : []);
  syncPanel(); // also the ✨ buttons
  syncBoardLocks(); // nothing is added automatically
}
/** Unlock animation: the lock badges pop off one after another (< 1 s in total) with a sparkle. Reduced motion:
    only a calm fade. No sound, no confetti here. Purely visual: the classes are added before syncPanel() removes
    .is-locked and cleared after 1.3 s; the panel stays usable all the time. */
function celebrateUnlock(tiles) {
  const calm = reducedMotion();
  const step = tiles.length > 1 ? Math.min(40, 550 / (tiles.length - 1)) : 0; // last pop starts by 550 ms
  tiles.forEach((t, n) => {
    t.style.setProperty('--d', `${Math.round(n * step)}ms`);
    t.classList.add(calm ? 'is-fading' : 'is-unlocking');
  });
  setTimeout(() => {
    tiles.forEach(t => { t.classList.remove('is-unlocking', 'is-fading'); t.style.removeProperty('--d'); });
  }, 1300);
}

/** The bridge object for unlock.js init(api) — worker/README.md § 8.4.4. */
const unlockApi = {
  signal,
  el(tag, cls) { const n = document.createElement(tag); if (cls) n.className = cls; return n; },
  button(cls, label, text) {
    const b = document.createElement('button');
    b.type = 'button';
    if (cls) b.className = cls;
    if (label) b.setAttribute('aria-label', label);
    if (text) b.textContent = text;
    return b;
  },
  lsGet, lsSet,
  get reducedMotion() { return reducedMotion(); },
  isFullscreen: () => isFullscreen(),
  // the stage while it is in NATIVE fullscreen (the dialog is attached inside it then), else null
  fullscreenHost: () => (stage && (document.fullscreenElement === stage || document.webkitFullscreenElement === stage) ? stage : null),
  isTestMode: () => { try { return signalsTestMode(); } catch (e) { return false; } },
  /** Just before the redirect to Stripe (R30): leave native fullscreen and the expanded mode. */
  pauseForRedirect() {
    try { if (nativeActive()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { /* ignore */ }
    try { if (expanded) exitExpanded(true); } catch (e) { /* ignore */ } // true: no history.back() right before a navigation
  },
  setUnlocked,
  openPanel: () => openPanel({ from: 'button' }),
  /** "Style your board →": the panel at its top, focus on its first control. Closes nothing itself. */
  showStyle() {
    if (!stage || !panel) return;
    if (!stage.classList.contains('is-settings') || panelMode !== 'style') { openPanel({ from: 'button' }); return; }
    if (panelBody) panelBody.scrollTop = 0;
    const first = panel.querySelector(FOCUSABLE);
    if (first) first.focus();
  },
  mount: () => ({ line: document.getElementById('tbu-line'), card: document.getElementById('tbu-card') })
};

function wirePanel() {
  if (!panelBody) return;
  buildPanel();
  panelBody.addEventListener('click', ev => {
    const t = ev.target && ev.target.closest ? ev.target.closest('.tb-thumb, [data-fb], [data-photo-remove]') : null;
    if (!t) return;
    if (t.hasAttribute('data-photo-remove')) { removePhoto(t.dataset.photoRemove); return; }
    if (t.hasAttribute('data-fb')) { onFeedback(t.getAttribute('data-fb')); return; }
    if (t.classList.contains('is-locked')) { onLockedTap(t); return; }
    selectTile(t);
  });
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
    if (goalLocked()) { onGoalLocked(b); return; } // Enter / Space on the button arrive here as click
    stepGoal(b);
  }));
  const goal = document.getElementById('tb-goal-input');
  if (goal) {
    goal.addEventListener('change', () => { // Enter or leaving the field; typing alone never re-renders the board
      const before = model.slots;
      setSlots(goal.value);
      goal.value = String(model.slots); // shows the clamped value (e.g. 250 → 100, 1 → 3); a locked goal stays
      if (model.slots !== before) goalSignal();
    });
    // Locked (T15): a click / tap, Enter / Space, a typed key or a paste opens the offer; Tab focus alone
    // does not, and shortcuts (Cmd / Ctrl / Alt), Tab, Escape and the arrow keys left / right pass through.
    const EDIT_KEYS = ['Enter', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'];
    goal.addEventListener('click', () => { if (goalLocked()) onGoalLocked(goal); });
    goal.addEventListener('keydown', ev => {
      const typed = !ev.ctrlKey && !ev.metaKey && !ev.altKey && (ev.key.length === 1 || EDIT_KEYS.includes(ev.key));
      if (typed && goalLocked()) { ev.preventDefault(); onGoalLocked(goal); return; }
      if (ev.key === 'Enter') { ev.preventDefault(); goal.blur(); goal.focus(); }
    });
    goal.addEventListener('paste', ev => { if (goalLocked()) { ev.preventDefault(); onGoalLocked(goal); } });
    goal.addEventListener('beforeinput', ev => { if (goal.readOnly) ev.preventDefault(); }); // drop, IME: never a change
  }
  const sound = document.getElementById('tb-sound');
  if (sound) sound.addEventListener('change', () => {
    setSound(sound.checked);
    showStatus(soundOn ? 'Sound on' : 'Sound off');
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

/* ---- the ✨ buttons + the pricing section (#pricing → price card #pro-card) + pro-view ---- */
/** The ✨ button under the board and the celebration button are hidden when unlocked; on a gated page without
    tb-dev they and the pricing section are hidden. */
function syncUnlockButtons() {
  const show = unlockUi && !unlocked;
  // html.tbu-has-key (set by the inline head script from a stored key, before this module runs) follows the state
  try { document.documentElement.classList.toggle('tbu-has-key', unlocked); } catch (e) { /* ignore */ }
  const bar = stage && stage.querySelector('[data-tb="extras"]');
  if (bar) { bar.hidden = !show; bar.style.display = show ? '' : 'none'; } // inline too: tool.css loads after the critical CSS
  const row = document.getElementById('tb-actions'); // T16: only the ✨ button is left in the row under the board
  if (row) row.hidden = !show;
  if (celebrateExtrasBtn && !show) celebrateExtrasBtn.hidden = true;
  const pricing = document.getElementById('pricing');
  if (pricing && !unlockUi) pricing.hidden = true;
}
/** Price card: the main button starts the payment directly, the second one opens the dialog in restore mode
    (both in unlock.js: cardAction). unlock.js is loaded on the first pointer / focus on the card. */
function wireProCard() {
  syncUnlockButtons();
  const card = document.getElementById('pro-card');
  if (!card) return;
  if (unlockUi) {
    card.addEventListener('click', ev => {
      const t = ev.target && ev.target.closest ? ev.target.closest('[data-tbu-unlock],[data-tbu-restore]') : null;
      if (!t || !card.contains(t)) return;
      const pending = !!window.__tbUnlock; // see openOffer
      loadUnlock().then(c => { if (!c) cardLoadFailed(card); else if (!pending) c.cardAction(t); });
    });
    const warm = () => { loadUnlock(); };
    card.addEventListener('pointerdown', warm, { once: true });
    card.addEventListener('focusin', warm, { once: true });
  }
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
  if (boardsOpen()) closePanel(); // no board switcher in fullscreen
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
  showHint(); // before the first render, so fitSlots() counts its line
  // Focus rings only for keyboard use: a mouse / touch press marks html.tb-pointer, any key clears it (tool.css).
  const root = document.documentElement;
  document.addEventListener('pointerdown', () => root.classList.add('tb-pointer'), true);
  document.addEventListener('keydown', () => root.classList.remove('tb-pointer'), true);
  wirePanel();
  wireBoards();
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
  // unlock.js now (not on first paint for a normal visitor): the Stripe return / a ?k= link (window.__tbUnlock, set
  // by the inline head script), a stored key (panel line, price card), or the dev hook ?dev-thanks=1.
  if (unlockUi && window.__tbUnlock) loadForReturn(0); // with retries: the visitor has just paid or opened their link
  else if (unlocked || /[?&]dev-thanks=1(&|$)/.test(location.search)) loadUnlock();
  window.addEventListener('online', () => { if (window.__tbUnlock && !unlockCtl) loadUnlock(); });
  sendVisit();
  requestPersist(); // a browser that already has several boards
  // Another tab changed the boards: take its list (a stale tab must never write back over a board added or
  // deleted there). This tab keeps showing its own board while it still exists.
  window.addEventListener('storage', ev => {
    if (ev.key !== BOARDS_KEY && ev.key !== null) return;
    const keep = model.id;
    load();
    const b = boards.find(x => x.id === keep);
    if (b) model = b;
    completing = false; clearTimeout(completeTimer);
    render(); showHint(); loadPhotos();
    if (boardsOpen()) renderBoards();
  });
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
  if (celebrateExtrasBtn) celebrateExtrasBtn.addEventListener('click', () => {
    openExtras('celebration', celebrateExtrasBtn); // the dialog sits over the celebration; focus comes back here
  });

  // Settings panel: "🎨 Style" under the board (toggles), the reward circle (opens at Reward)
  if (settingsBtn) settingsBtn.addEventListener('click', () => {
    if (stage.classList.contains('is-settings') && panelMode === 'style') closePanel(); else openPanel({ from: 'button' });
  });
  if (boardsBtn) boardsBtn.addEventListener('click', () => {
    if (boardsOpen()) closePanel(); else openPanel({ mode: 'boards' });
  });
  if (rewardEl) {
    rewardEl.addEventListener('click', () => openPanel({ from: 'reward', section: 'reward' }));
    rewardEl.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') { ev.preventDefault(); openPanel({ from: 'reward', section: 'reward' }); }
    });
  }
  const extrasBtn = stage.querySelector('[data-tb="extras"]');
  if (extrasBtn) extrasBtn.addEventListener('click', () => openExtras('toolbar', extrasBtn));
  stage.querySelectorAll('[data-tb="close"]').forEach(btn => btn.addEventListener('click', closePanel));
  // Desktop: tapping the stage outside the panel closes it (phone: full-stage sheet, Done / × only).
  stage.addEventListener('click', ev => {
    if (!stage.classList.contains('is-settings') || isPhone()) return;
    if (!document.contains(ev.target)) return; // a control that re-rendered itself on this tap (Show / Hide in the unlocked line)
    if (panel.contains(ev.target) || (settingsBtn && settingsBtn.contains(ev.target)) || (boardsBtn && boardsBtn.contains(ev.target))) return;
    if ((rewardEl && rewardEl.contains(ev.target)) || ev.target.closest('.tb-actions, .tb-tools')) return; // reward = jump to Reward
    if (ev.target.closest('.tbu-dialog')) return; // the offer dialog (inside the stage while in native fullscreen)
    if (ev.target && ev.target.id === 'tb-photo-input') return; // the file picker's click is not a tap outside
    closePanel();
  });
  document.addEventListener('keydown', ev => {
    if (document.querySelector('dialog.tbu-dialog[open]')) return; // the offer dialog handles its own keys (Escape, Tab)
    if (stage.classList.contains('is-complete')) {
      // Celebration dialog: Hooray (+ the ✨ button while locked). Tab stays inside, Escape = Hooray.
      if (ev.key === 'Escape') { ev.preventDefault(); hooray(); return; }
      if (ev.key === 'Tab') {
        ev.preventDefault();
        const extra = celebrateExtrasBtn && !celebrateExtrasBtn.hidden ? celebrateExtrasBtn : null;
        (extra && document.activeElement === hoorayBtn ? extra : hoorayBtn || extra).focus();
        return;
      }
    }
    if (ev.key === 'Escape') {
      if (boardsOpen() && closeConfirm(true)) { ev.preventDefault(); return; } // the inline Delete confirm first
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
        try { [STORAGE_KEY, BOARDS_KEY, 'tb-fs-hint', 'tb-tried', HINT_KEY, SETTINGS_KEY, LICENSE_KEY, 'tb-device', 'tb-mock'].forEach(k => { delete lsMem[k]; localStorage.removeItem(k); }); } catch (e) { /* ignore */ }
        Promise.all(boards.flatMap(b => [photoDelete(photoKey(b, 'reward')), photoDelete(photoKey(b, 'background')), photoDelete('reward'), photoDelete('background')])).finally(() => {
          try { location.reload(); } catch (e) { /* not available in some test runners */ }
        });
      },
      slots3() { setSlots(3); }, slots5() { setSlots(5); }, slots10() { setSlots(10); },
      soundToggle() { setSound(!soundOn); showStatus(soundOn ? 'Sound on' : 'Sound off'); },
      setTitlePrompt() {
        let v = null;
        try { v = window.prompt(`Board title (max ${TITLE_MAX} characters)`, model.title); } catch (e) { v = null; }
        if (v !== null) setTitle(v);
      },
      bgBlue() { setBackground('blue'); }, bgWhite() { setBackground('white'); },
      // paid unlock without a payment: store the mock key / remove the key, then reload
      unlockMock() { lsSet(LICENSE_KEY, 'TB-TEST-TEST-TEST'); try { location.reload(); } catch (e) { /* not available in some test runners */ } },
      lockAgain() { delete lsMem[LICENSE_KEY]; try { localStorage.removeItem(LICENSE_KEY); } catch (e) { /* ignore */ } try { location.reload(); } catch (e) { /* ignore */ } },
      // empty-board hint + settings-open again, as in a fresh browser (also in this page load)
      resetHintSettings() {
        try { localStorage.removeItem(HINT_KEY); localStorage.removeItem(SETTINGS_KEY); } catch (e) { /* ignore */ }
        settingsOpenSent = false; showHint(); fitSlots(); showStatus('Hint + settings-open reset');
      },
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
