// ===== CONFIG =====
const CONFIG = {
  palette: ["red", "blue", "green", "yellow", "purple", "orange"],
  requiredPopsBase: 18,
  requiredPopsIncrement: 4,
  spawnIntervalBase: 900,
  spawnIntervalFactor: 0.84,
  ballLifetime: 6.2,
  ballSpeedRange: [130, 220],
  comboWindowMs: 3000,
  comboTarget: 5,
  bombRadius: 120,
  maxLives: 5,
  fireStartLevel: 2,
  fireChanceBase: 0.06,
  fireChanceGrowth: 0.04,
  wrongColorPenalty: 0,
  highScoresMax: 10,
};

// ===== SOUND MANAGER =====
class SoundManager {
  constructor() { this.ctx = null; this.muted = false; this.gain = null; }
  ensureContext() { if (this.ctx) return; this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.gain = this.ctx.createGain(); this.gain.gain.value = 0.14; this.gain.connect(this.ctx.destination); }
  toggleMute() { this.muted = !this.muted; if (!this.ctx || !this.gain) return; const now = this.ctx.currentTime; const target = this.muted ? 0 : 0.14; this.gain.gain.cancelScheduledValues(now); const current = this.gain.gain.value; this.gain.gain.setValueAtTime(current, now); this.gain.gain.linearRampToValueAtTime(target, now + 0.18); }
  tone({ freq = 440, duration = 0.12, type = "sine", volume = 0.9, attack = 0.01, release = 0.06 }) {
    if (this.muted) return; this.ensureContext(); const osc = this.ctx.createOscillator(); const g = this.ctx.createGain(); osc.type = type; osc.frequency.value = freq; g.gain.value = 0; const now = this.ctx.currentTime; const end = now + duration; g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(volume, now + attack); g.gain.linearRampToValueAtTime(0.0001, end + release); osc.connect(g); g.connect(this.gain); osc.start(now); osc.stop(end + release); }
  popGood() { this.tone({ freq: 780, duration: 0.08, type: "square", volume: 0.7 }); this.tone({ freq: 1100, duration: 0.06, type: "sine", volume: 0.5 }); }
  popWrong() { this.tone({ freq: 280, duration: 0.10, type: "sawtooth", volume: 0.6 }); }
  fireHit() { this.tone({ freq: 160, duration: 0.25, type: "triangle", volume: 0.9 }); this.tone({ freq: 120, duration: 0.20, type: "sine", volume: 0.6 }); }
  bombReady() { this.tone({ freq: 520, duration: 0.10, type: "square", volume: 0.7 }); this.tone({ freq: 880, duration: 0.10, type: "square", volume: 0.7 }); }
  bombDetonate() { for (let i = 0; i < 8; i++) { this.tone({ freq: 600 - i * 60, duration: 0.06, type: "sawtooth", volume: 0.7 }); } }
  levelUp() { this.tone({ freq: 620, duration: 0.10, type: "square", volume: 0.8 }); this.tone({ freq: 840, duration: 0.12, type: "square", volume: 0.8 }); this.tone({ freq: 1040, duration: 0.14, type: "square", volume: 0.7 }); }
  gameOver() { this.tone({ freq: 220, duration: 0.25, type: "sine", volume: 0.8 }); this.tone({ freq: 180, duration: 0.25, type: "sine", volume: 0.7 }); this.tone({ freq: 140, duration: 0.25, type: "sine", volume: 0.6 }); }
}
const SND = new SoundManager();

// ===== MUSIC MANAGER =====
class MusicManager {
  constructor() { this.ctx = null; this.master = null; this.muted = false; this.playing = false; this.nodes = { bass: null, arp: null, pad: null }; }
  ensureContext() { if (this.ctx) return; this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.master = this.ctx.createGain(); this.master.gain.value = 0.08; this.master.connect(this.ctx.destination); }
  resumeContext() { if (!this.ctx) return; if (this.ctx.state === "suspended") this.ctx.resume(); }
  toggleMute() { this.muted = !this.muted; if (!this.master) return; this.master.gain.value = this.muted ? 0 : 0.08; }
  duck(amount = 0.35, timeMs = 500) { if (!this.master || this.muted) return; const now = this.ctx.currentTime; const original = 0.08; this.master.gain.cancelScheduledValues(now); this.master.gain.setValueAtTime(original, now); this.master.gain.linearRampToValueAtTime(original * (1 - amount), now + 0.05); this.master.gain.linearRampToValueAtTime(original, now + timeMs / 1000); }
  fadeTo(target = 0.08, ms = 500) { if (!this.master || !this.ctx) return; const now = this.ctx.currentTime; this.master.gain.cancelScheduledValues(now); const current = this.master.gain.value; this.master.gain.setValueAtTime(current, now); this.master.gain.linearRampToValueAtTime(target, now + ms / 1000); }
  fadeIn(ms = 700) { this.fadeTo(0.08, ms); }
  fadeOut(ms = 700) { this.fadeTo(0.0, ms); }
  start() {
    if (this.playing) return; this.ensureContext();
    const bass = this.ctx.createOscillator(); bass.type = "triangle"; const bassGain = this.ctx.createGain(); bassGain.gain.value = 0.07; bass.connect(bassGain); bassGain.connect(this.master);
    const bassNotes = [110, 82.41, 98, 73.42]; let bassStep = 0; this._bassTimer = setInterval(() => { if (!this.playing || this.muted) return; bass.frequency.setValueAtTime(bassNotes[bassStep % bassNotes.length], this.ctx.currentTime); bassStep++; }, 1600);
    const arp = this.ctx.createOscillator(); arp.type = "square"; const arpGain = this.ctx.createGain(); arpGain.gain.value = 0.03; arp.connect(arpGain); arpGain.connect(this.master);
    const arpNotes = [440, 523.25, 659.25, 523.25, 440, 392]; let arpIdx = 0; this._arpTimer = setInterval(() => { if (!this.playing || this.muted) return; arp.frequency.setValueAtTime(arpNotes[arpIdx % arpNotes.length], this.ctx.currentTime); arpIdx++; }, 300);
    const pad = this.ctx.createOscillator(); pad.type = "sine"; const padGain = this.ctx.createGain(); padGain.gain.value = 0.02; pad.connect(padGain); padGain.connect(this.master); let up = true; this._padTimer = setInterval(() => { if (!this.playing || this.muted) return; const now = this.ctx.currentTime; const base = 220; const detune = up ? 2 : -2; pad.frequency.linearRampToValueAtTime(base + detune, now + 1.5); up = !up; }, 1500);
    const now = this.ctx.currentTime; bass.start(now); arp.start(now); pad.start(now);
    this.nodes.bass = bass; this.nodes.arp = arp; this.nodes.pad = pad; this.playing = true;
  }
  stop() { if (!this.playing) return; this.toggleMute(); this.playing = false; }
}
const MUSIC = new MusicManager();

const state = {
  running: false,
  placingBomb: false,
  bombsAvailable: 0,
  targetColor: null,
  level: 1,
  score: 0,
  lives: CONFIG.maxLives,
  progress: 0,
  requiredPops: CONFIG.requiredPopsBase,
  spawnInterval: CONFIG.spawnIntervalBase,
  comboTimes: [],
  balls: new Map(),
  nextBallId: 1,
  lastTick: performance.now(),
  spawnTimer: null,
  raf: null,
  playerName: "Player",
};

// ===== DOM =====
const gameEl = document.getElementById("game");
const startOverlay = document.getElementById("startOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const bombOverlay = document.getElementById("bombOverlay");
const toastEl = document.getElementById("toast");

const colorGrid = document.getElementById("colorGrid");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const cancelBombBtn = document.getElementById("cancelBombBtn");
const shareBtn = document.getElementById("shareBtn");

const targetSwatch = document.getElementById("targetSwatch");
const progressFill = document.getElementById("progressFill");
const levelText = document.getElementById("levelText");
const scoreText = document.getElementById("scoreText");
const livesContainer = document.getElementById("livesContainer");
const bombButton = document.getElementById("bombButton");
const finalScoreText = document.getElementById("finalScoreText");
const muteButton = document.getElementById("muteButton");
const musicButton = document.getElementById("musicButton");
const cbToggle = document.getElementById("cbToggle");
const playerNameInput = document.getElementById("playerName");
const highScoresList = document.getElementById("highScoresList");
const highScoresListGame = document.getElementById("highScoresListGame");
const clearScoresBtn = document.getElementById("clearScoresBtn");
const themeSelect = document.getElementById("themeSelect");
const themeSelectStart = document.getElementById("themeSelectStart");

// ===== Color selection =====
CONFIG.palette.forEach(color => {
  const btn = document.createElement("button");
  btn.className = "color-btn";
  btn.style.background = getColorGradient(color);
  btn.title = color[0].toUpperCase() + color.slice(1);
  btn.addEventListener("click", () => {
    [...colorGrid.children].forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    state.targetColor = color;
    targetSwatch.style.background = getColorGradient(color);
    startBtn.disabled = false;
    showToast(`🎯 Target color: ${color.toUpperCase()}`);
  });
  colorGrid.appendChild(btn);
});

// ===== Event listeners =====
startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", () => {
  restartBtn.classList.remove("show");
  restartBtn.classList.remove("pulse");
  restartBtn.disabled = true;
  hideOverlay(gameOverOverlay);
  resetGame();
  showOverlay(startOverlay);
  renderHighScores();
  setTimeout(() => { restartBtn.disabled = false; }, 260);
});

cancelBombBtn.addEventListener("click", () => { state.placingBomb = false; hideOverlay(bombOverlay); });

bombButton.addEventListener("click", () => {
  if (state.bombsAvailable > 0 && state.running) { state.placingBomb = true; showOverlay(bombOverlay); }
});

muteButton.addEventListener("click", () => {
  SND.toggleMute();
  muteButton.classList.toggle("off", SND.muted);
  muteButton.textContent = SND.muted ? "🔇 Sound: Off" : "🔈 Sound: On";
});

musicButton.addEventListener("click", () => {
  MUSIC.ensureContext();
  MUSIC.resumeContext();
  if (!MUSIC.playing && !MUSIC.muted) { MUSIC.start(); MUSIC.fadeIn(600); }
  else { if (MUSIC.muted) { MUSIC.toggleMute(); MUSIC.fadeIn(400); } else { MUSIC.fadeOut(400); setTimeout(() => MUSIC.toggleMute(), 420); } }
  const off = MUSIC.muted || !MUSIC.playing;
  musicButton.classList.toggle("off", off);
  musicButton.textContent = `🎵 Music: ${off ? "Off" : "On"}`;
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) { if (MUSIC.master) MUSIC.master.gain.value = 0; }
  else { if (!MUSIC.muted && MUSIC.master) MUSIC.master.gain.value = 0.08; MUSIC.resumeContext(); }
});

// Color-blind toggle (persist)
cbToggle.addEventListener("change", () => { applyCBMode(cbToggle.checked); });

clearScoresBtn.addEventListener("click", () => { try { localStorage.removeItem('colorPopcornHighScores'); } catch (e) {} renderHighScores(); showToast("🧹 Scores cleared"); });

shareBtn.addEventListener("click", async () => {
  const text = `${state.playerName} scored ${state.score} points at Level ${state.level} in Color Popcorn!`;
  try { await navigator.clipboard.writeText(text); showToast("📋 Copied! Share it with friends."); } catch (e) { showToast("⚠️ Copy failed. Select and copy manually."); }
});

// Theme select (HUD & Start)
function applyTheme(theme) {
  document.body.classList.remove("theme-neon","theme-sunset","theme-forest","theme-midnight");
  document.body.classList.add(`theme-${theme}`);
  try { localStorage.setItem('colorPopcornTheme', theme); } catch (e) {}
}
themeSelect.addEventListener("change", () => { applyTheme(themeSelect.value); });
themeSelectStart.addEventListener("change", () => { applyTheme(themeSelectStart.value); themeSelect.value = themeSelectStart.value; });

// Bomb placement: click anywhere in game area to detonate
gameEl.addEventListener("pointerdown", (ev) => {
  if (!state.placingBomb) return;
  state.placingBomb = false;
  hideOverlay(bombOverlay);
  detonateBomb(ev);
});

// ===== Init persisted settings & scores =====
(function init() {
  const cb = (typeof localStorage !== 'undefined' && localStorage.getItem('colorPopcornCBMode') === '1');
  cbToggle.checked = cb; applyCBMode(cb);
  const theme = (typeof localStorage !== 'undefined' && localStorage.getItem('colorPopcornTheme')) || 'neon';
  themeSelect.value = theme; themeSelectStart.value = theme; applyTheme(theme);
  renderHighScores();
})();

// ===== Game lifecycle =====
function startGame() {
  if (!state.targetColor) return;
  SND.ensureContext();
  MUSIC.ensureContext();
  MUSIC.resumeContext();
  if (!MUSIC.playing && !MUSIC.muted) { MUSIC.start(); MUSIC.fadeIn(600); }
  state.playerName = (playerNameInput.value || '').trim() || 'Player';
  hideOverlay(startOverlay);
  resetGame();
  state.running = true;
  updateHUD();
  showToast("👾 Good luck! Build combos and watch for 🔥");
  state.spawnTimer = setInterval(spawnBall, state.spawnInterval);
  state.lastTick = performance.now();
  state.raf = requestAnimationFrame(tick);
}

function resetGame() {
  for (const { el } of state.balls.values()) { el.remove(); }
  state.balls.clear();
  if (state.spawnTimer) clearInterval(state.spawnTimer);
  if (state.raf) cancelAnimationFrame(state.raf);
  state.running = false; state.placingBomb = false; state.bombsAvailable = 0;
  state.level = 1; state.score = 0; state.lives = CONFIG.maxLives; state.progress = 0;
  state.requiredPops = CONFIG.requiredPopsBase; state.spawnInterval = CONFIG.spawnIntervalBase; state.comboTimes = [];
  updateHUD(); bombButton.disabled = true; bombButton.textContent = "💣 Bomb (0)"; bombButton.classList.remove("ready");
  progressFill.style.background = getProgressFillGradient(state.targetColor || "blue");
}

function gameOver() {
  SND.gameOver(); MUSIC.fadeOut(800);
  state.running = false; clearInterval(state.spawnTimer); cancelAnimationFrame(state.raf);
  finalScoreText.textContent = String(state.score);
  showOverlay(gameOverOverlay);

  // Save score and update lists
  const entry = { name: state.playerName, score: state.score, level: state.level, date: new Date().toISOString() };
  saveHighScore(entry); renderHighScores(); renderHighScores(highScoresListGame);

  // Celebration confetti
  fireConfetti({ count: 40, area: gameEl });

  // Fade-in Restart button
  const restartBtnEl = document.getElementById("restartBtn");
  restartBtnEl.classList.remove("show", "pulse");
  setTimeout(() => { restartBtnEl.classList.add("show", "pulse"); setTimeout(() => restartBtnEl.classList.remove("pulse"), 300); restartBtnEl.focus({ preventScroll: true }); }, 160);
}

// ===== HUD updates =====
function updateHUD() {
  levelText.textContent = String(state.level);
  scoreText.textContent = String(state.score);
  livesContainer.innerHTML = "";
  for (let i = 0; i < CONFIG.maxLives; i++) { const heart = document.createElement("div"); heart.className = "heart"; if (i >= state.lives) heart.style.filter = "grayscale(100%) brightness(0.6)"; livesContainer.appendChild(heart); }
  const pct = Math.min(100, Math.round((state.progress / state.requiredPops) * 100));
  progressFill.style.width = pct + "%";
  progressFill.style.background = getProgressFillGradient(state.targetColor || "blue");
  bombButton.disabled = state.bombsAvailable <= 0 || !state.running;
  bombButton.textContent = `💣 Bomb (${state.bombsAvailable})`;
  if (state.bombsAvailable > 0) bombButton.classList.add("ready"); else bombButton.classList.remove("ready");
}

// ===== Ball spawning & animation =====
const SYMBOLS = { red: 'R', blue: 'B', green: 'G', yellow: 'Y', purple: 'P', orange: 'O' };

function spawnBall() {
  if (!state.running) return;
  const id = state.nextBallId++;
  const rect = gameEl.getBoundingClientRect();
  const size = 48; const margin = 30;
  const x = Math.random() * (rect.width - margin * 2) + margin;
  const y = rect.height - margin;
  const speed = randBetween(CONFIG.ballSpeedRange[0], CONFIG.ballSpeedRange[1]);
  let type = "normal"; let color = CONFIG.palette[Math.floor(Math.random() * CONFIG.palette.length)];
  if (state.level >= CONFIG.fireStartLevel) { const chance = CONFIG.fireChanceBase + (state.level - CONFIG.fireStartLevel) * CONFIG.fireChanceGrowth; if (Math.random() < Math.min(0.35, chance)) type = "fire"; }
  const el = document.createElement("div"); el.className = `ball ${type === "fire" ? "fire" : color}`; el.style.left = `${x}px`; el.style.top = `${y}px`; if (type !== 'fire') el.setAttribute('data-symbol', SYMBOLS[color]);
  gameEl.appendChild(el); requestAnimationFrame(() => el.classList.add("spawned"));
  el.addEventListener("pointerdown", (ev) => { ev.stopPropagation(); handleBallClick(id, ev.clientX, ev.clientY); });
  state.balls.set(id, { el, x, y, speed, color, type, bornAt: performance.now(), size });
}

function tick(now) {
  if (!state.running) return;
  const dt = (now - state.lastTick) / 1000; state.lastTick = now;
  for (const [id, ball] of state.balls.entries()) {
    ball.y -= ball.speed * dt; ball.el.style.top = `${ball.y}px`;
    if (ball.y < -ball.size || (now - ball.bornAt) / 1000 > CONFIG.ballLifetime) {
      ball.el.classList.add("fadeout"); setTimeout(() => { ball.el.remove(); }, 240); state.balls.delete(id);
    }
  }
  state.raf = requestAnimationFrame(tick);
}

// ===== Click handling =====
function handleBallClick(id, clientX, clientY) {
  const ball = state.balls.get(id); if (!ball || !state.running) return; ball.el.classList.add("pop");
  // floating score
  spawnFloat(`+${ball.type === 'fire' ? '💔' : '10'}`, clientX, clientY);
  if (ball.type === "fire") {
    SND.fireHit(); state.lives = Math.max(0, state.lives - 1);
    if (state.lives === 0) { updateHUD(); setTimeout(() => gameOver(), 220); } else { updateHUD(); showToast("🔥 Careful! You lost a life."); }
    setTimeout(() => ball.el.classList.add("fadeout"), 10); setTimeout(() => ball.el.remove(), 220); state.balls.delete(id); return;
  }
  if (ball.color === state.targetColor) {
    SND.popGood(); state.score += 10; state.progress += 1; progressFill.classList.add("pulse"); setTimeout(() => progressFill.classList.remove("pulse"), 220);
    const now = performance.now(); state.comboTimes.push(now); state.comboTimes = state.comboTimes.filter(t => now - t <= CONFIG.comboWindowMs);
    if (state.level >= 3 && state.comboTimes.length >= CONFIG.comboTarget) { state.comboTimes = []; state.bombsAvailable += 1; SND.bombReady(); showToast("💣 Bomb ready! Tap to place."); }
    if (state.progress >= state.requiredPops) { winLevel(); }
  } else {
    SND.popWrong(); state.score = Math.max(0, state.score - CONFIG.wrongColorPenalty); showToast("⛔ Wrong color – aim for your target!");
  }
  updateHUD(); setTimeout(() => ball.el.classList.add("fadeout"), 10); setTimeout(() => ball.el.remove(), 220); state.balls.delete(id);
}

// ===== Level progression =====
function winLevel() {
  SND.levelUp(); progressFill.classList.add("pulse"); setTimeout(() => progressFill.classList.remove("pulse"), 420);
  fireConfetti({ count: 24, area: gameEl }); showToast(`🏆 Level ${state.level + 1}, let's go!`);
  state.level += 1; state.progress = 0; state.requiredPops += CONFIG.requiredPopsIncrement;
  state.spawnInterval = Math.max(240, Math.round(state.spawnInterval * CONFIG.spawnIntervalFactor));
  clearInterval(state.spawnTimer); state.spawnTimer = setInterval(spawnBall, state.spawnInterval);
  state.score += 150; updateHUD();
}

// ===== Bomb mechanics =====
function detonateBomb(ev) {
  if (state.bombsAvailable <= 0) return;
  SND.bombDetonate(); MUSIC.duck(0.5, 800);
  const rect = gameEl.getBoundingClientRect(); const x = ev.clientX - rect.left; const y = ev.clientY - rect.top;
  const boom = document.createElement("div"); boom.className = "explosion"; boom.style.left = `${x}px`; boom.style.top = `${y}px`; gameEl.appendChild(boom); setTimeout(() => boom.remove(), 460);
  for (const [id, ball] of state.balls.entries()) { const dx = ball.x - x; const dy = ball.y - y; const dist = Math.hypot(dx, dy); if (dist <= CONFIG.bombRadius) { ball.el.classList.add("pop"); setTimeout(() => ball.el.classList.add("fadeout"), 10); setTimeout(() => ball.el.remove(), 200); state.balls.delete(id); } }
  state.bombsAvailable -= 1; updateHUD();
}

// ===== High Scores (localStorage) =====
function loadHighScores() { try { const raw = localStorage.getItem('colorPopcornHighScores'); return raw ? JSON.parse(raw) : []; } catch (e) { return []; } }
function saveHighScore(entry) { let list = loadHighScores(); list.push(entry); list.sort((a, b) => b.score - a.score); if (list.length > CONFIG.highScoresMax) list = list.slice(0, CONFIG.highScoresMax); try { localStorage.setItem('colorPopcornHighScores', JSON.stringify(list)); } catch (e) {} return list; }
function renderHighScores(target = highScoresList) { const list = loadHighScores(); if (!list.length) { target.innerHTML = '<li class="hint">No high scores yet. Be the first!</li>'; return; } target.innerHTML = list.map((h, i) => { const date = new Date(h.date || Date.now()); const dt = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); return `<li><span class="name">${i + 1}. ${escapeHtml(h.name || 'Player')}</span><span class="score">${h.score}</span><span class="meta">Lvl ${h.level || 1} • ${dt}</span></li>`; }).join(''); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }

// ===== Helpers =====
function randBetween(a, b) { return a + Math.random() * (b - a); }
function showOverlay(el) { el.classList.add("show"); }
function hideOverlay(el) { el.classList.remove("show"); }
function applyCBMode(enabled) { if (enabled) gameEl.classList.add('cb'); else gameEl.classList.remove('cb'); try { localStorage.setItem('colorPopcornCBMode', enabled ? '1' : '0'); } catch (e) {} }
function getColorGradient(color) { switch (color) { case "red": return "radial-gradient(circle at 30% 30%, #ff9c9c, #d91f1f)"; case "blue": return "radial-gradient(circle at 30% 30%, #9cc8ff, #1f58d9)"; case "green": return "radial-gradient(circle at 30% 30%, #a5f3b2, #1f9d4a)"; case "yellow": return "radial-gradient(circle at 30% 30%, #fff3a1, #d9a31f)"; case "purple": return "radial-gradient(circle at 30% 30%, #d8a9ff, #6d1fd9)"; case "orange": return "radial-gradient(circle at 30% 30%, #ffd1a1, #d96a1f)"; default: return "linear-gradient(180deg, #3a6dfd, #3057d6)"; } }
function getProgressFillGradient(color) { switch (color) { case "red": return "linear-gradient(180deg, #ff8181, #c21818)"; case "blue": return "linear-gradient(180deg, #6aa8ff, #184ac2)"; case "green": return "linear-gradient(180deg, #77e79a, #187a3a)"; case "yellow": return "linear-gradient(180deg, #ffe46c, #b8810e)"; case "purple": return "linear-gradient(180deg, #c68bff, #5312b3)"; case "orange": return "linear-gradient(180deg, #ffb46d, #b44a0c)"; default: return "linear-gradient(180deg, #6c8cff, #3057d6)"; } }

function showToast(msg, ms = 1400) { toastEl.textContent = msg; toastEl.classList.add("show"); setTimeout(() => toastEl.classList.remove("show"), ms); }
function spawnFloat(text, clientX, clientY) { const rect = gameEl.getBoundingClientRect(); const x = clientX - rect.left; const y = clientY - rect.top; const el = document.createElement('div'); el.className = 'float'; el.style.left = x + 'px'; el.style.top = y + 'px'; el.textContent = text; gameEl.appendChild(el); setTimeout(() => el.remove(), 620); }
function fireConfetti({ count = 20, area = gameEl }) { const rect = area.getBoundingClientRect(); for (let i = 0; i < count; i++) { const c = document.createElement('div'); c.className = 'confetti'; const x = Math.random() * rect.width; const y = Math.random() * rect.height * 0.2 + rect.height * 0.1; c.style.left = x + 'px'; c.style.top = y + 'px'; c.style.background = ['#ff477e','#ffd166','#06d6a0','#4cc9f0','#f72585'][Math.floor(Math.random()*5)]; c.style.transform = `rotate(${Math.random()*360}deg)`; area.appendChild(c); setTimeout(() => c.remove(), 1000); } }
