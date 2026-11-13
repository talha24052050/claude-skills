import {
  DX, DY, trace, isSolved, movable, getState, setState, solutions, nearest, stars,
  campaignLevel, dailyLevel, LEVEL_COUNT,
} from './core.js';

const $ = (id) => document.getElementById(id);
const COLORS = { 1: '#ff4055', 2: '#35e27f', 4: '#4a86ff', 3: '#ffd83b', 5: '#ff58e4', 6: '#3fe9ff', 7: '#ffffff' };
const TIPS = {
  1: 'Aynaya dokun, döndür. Işını halkaya ulaştır.',
  5: 'Her hedef yalnızca kendi rengindeki ışıkla yanar.',
  9: 'Renkler hedefte karışır: kırmızı + yeşil = sarı, kırmızı + mavi = mor, yeşil + mavi = camgöbeği.',
  15: 'Kesikli çizgili ayırıcı, ışını hem geçirir hem yansıtır.',
  21: 'Renkli cam filtre, ışığın yalnızca kendi rengini geçirir. Beyaz ışık üç rengin toplamıdır.',
};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- Kayıt (yalnızca bu tarayıcıda durur) ----
let save = { stars: {}, muted: false };
try { save = { ...save, ...JSON.parse(localStorage.getItem('prizma-v1')) }; } catch {}
const persist = () => { try { localStorage.setItem('prizma-v1', JSON.stringify(save)); } catch {} };
const starText = (s) => '★'.repeat(s) + '☆'.repeat(3 - s);

function today() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

// ---- Ses ----
let audio;
function tone(freq, dur = 0.12, type = 'sine', vol = 0.08, delay = 0) {
  if (save.muted) return;
  try {
    audio ||= new AudioContext();
    if (audio.state === 'suspended') audio.resume();
    const osc = audio.createOscillator(), gain = audio.createGain();
    const t = audio.currentTime + delay;
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch {}
}

// ---- Menü ----
function showMenu() {
  game = null;
  $('play').hidden = true;
  $('menu').hidden = false;
  let done = 0, total = 0;
  for (let n = 1; n <= LEVEL_COUNT; n++) {
    if (save.stars[n]) done = n;
    total += save.stars[n] || 0;
  }
  $('total').textContent = `★ ${total} / ${LEVEL_COUNT * 3}`;
  $('daily-date').textContent = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
  const ds = save.stars['d' + today()];
  $('daily-stars').textContent = ds ? starText(ds) : 'Oyna ›';
  $('levels').replaceChildren(...Array.from({ length: LEVEL_COUNT }, (_, k) => {
    const n = k + 1, s = save.stars[n];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lvl' + (s ? ' done' : '');
    b.disabled = n > done + 3; // takılınca atlayabilmek için üç bölüm ileri açık
    b.setAttribute('aria-label', `Bölüm ${n}` + (s ? `, ${s} yıldız` : b.disabled ? ', kilitli' : ''));
    b.innerHTML = `<b>${n}</b><span class="stars">${s ? starText(s) : ''}</span>`;
    b.onclick = () => openLevel(n);
    return b;
  }));
}

// ---- Oyun durumu ----
let game = null;
const canvas = $('board'), ctx = canvas.getContext('2d');
let S = 0; // hücre kenarı (CSS pikseli)

function openLevel(id) {
  const lv = typeof id === 'number' ? campaignLevel(id) : dailyLevel(today());
  game = {
    id, lv, sols: solutions(lv), start: getState(lv), tr: trace(lv),
    history: [], penalty: 0, won: false,
    hint: -1, hintUntil: 0, turned: new Map(), sparks: [],
  };
  $('menu').hidden = true;
  $('play').hidden = false;
  $('win').hidden = true;
  $('tools').hidden = $('tip').hidden = false;
  $('title').textContent = typeof id === 'number' ? `Bölüm ${id}` : 'Günün Bulmacası';
  $('tip').textContent = TIPS[id] || 'Tüm hedefleri kendi renginde yak.';
  resize();
  refresh();
}

const taps = () => game.history.length + game.penalty;

function refresh() {
  const { lv } = game, before = game.tr;
  game.tr = trace(lv);
  lv.cells.forEach((c, i) => {
    if (c && c.t === 'target' && game.tr.recv[i] === c.c && before.recv[i] !== c.c) {
      tone(660 + 110 * (i % 4), 0.3, 'sine', 0.07);
      burst(i, c.c, 10);
    }
  });
  $('count').innerHTML = `Dokunuş <b>${taps()}</b> · En az ${lv.par}`;
  $('undo').disabled = !game.history.length;
  if (!game.won && isSolved(lv, game.tr)) win();
}

function flip(i) {
  const c = game.lv.cells[i];
  c.o ^= 1;
  game.turned.set(i, performance.now());
}

function tap(i) {
  const c = game.lv.cells[i];
  if (game.won || !c || (c.t !== 'mirror' && c.t !== 'split')) return;
  flip(i);
  game.history.push(i);
  if (i === game.hint) game.hint = -1;
  tone(c.o ? 540 : 430, 0.07, 'triangle', 0.09);
  if (navigator.vibrate) navigator.vibrate(8);
  refresh();
}

function win() {
  const { id, lv } = game;
  game.won = true;
  const s = stars(taps(), lv.par);
  const key = typeof id === 'number' ? id : 'd' + today();
  save.stars[key] = Math.max(s, save.stars[key] || 0);
  persist();
  [523, 659, 784, 1047].forEach((f, k) => tone(f, 0.35, 'triangle', 0.08, 0.15 + k * 0.11));
  lv.cells.forEach((c, i) => { if (c && c.t === 'target') burst(i, c.c, 26); });
  $('win-stars').textContent = starText(s);
  $('win-text').textContent = s === 3
    ? `Kusursuz: ${taps()} dokunuş.`
    : `${taps()} dokunuşta çözdün. Üç yıldız için ${lv.par}.`;
  $('next').hidden = typeof id !== 'number' || id >= LEVEL_COUNT;
  setTimeout(() => {
    if (!game || game.lv !== lv) return;
    $('tools').hidden = $('tip').hidden = true;
    $('win').hidden = false;
    resize();
  }, 700);
}

$('undo').onclick = () => {
  if (game.won || !game.history.length) return;
  flip(game.history.pop());
  refresh();
};
$('reset').onclick = () => {
  if (game.won) return;
  const diff = getState(game.lv) ^ game.start;
  movable(game.lv).forEach((i, b) => { if ((diff >> b) & 1) flip(i); });
  game.history = [];
  refresh();
};
// İpucu, en yakın çözüme göre yanlış duran bir parçayı gösterir; bir dokunuşa mal olur.
$('hint').onclick = () => {
  if (game.won) return;
  const state = getState(game.lv);
  const diff = nearest(state, game.sols).mask ^ state;
  game.hint = movable(game.lv)[31 - Math.clz32(diff & -diff)];
  game.hintUntil = performance.now() + 4000;
  game.penalty++;
  tone(300, 0.15, 'sine', 0.06);
  refresh();
};
function soundLabel() { $('sound').textContent = save.muted ? 'Ses kapalı' : 'Ses açık'; }
$('sound').onclick = () => { save.muted = !save.muted; persist(); soundLabel(); tone(600, 0.08); };
$('back').onclick = $('win-menu').onclick = showMenu;
$('next').onclick = () => openLevel(game.id + 1);
$('daily').onclick = () => openLevel('daily');

canvas.addEventListener('pointerdown', (e) => {
  if (!game) return;
  const r = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / S), y = Math.floor((e.clientY - r.top) / S);
  if (x >= 0 && y >= 0 && x < game.lv.w && y < game.lv.h) tap(y * game.lv.w + x);
});

// ---- Çizim ----
function resize() {
  if (!game) return;
  const { w, h } = game.lv, stage = $('stage');
  canvas.style.width = canvas.style.height = '0';
  S = Math.floor(Math.min(stage.clientWidth / w, stage.clientHeight / h, 88));
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${S * w}px`;
  canvas.style.height = `${S * h}px`;
  canvas.width = S * w * dpr;
  canvas.height = S * h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize);

function burst(i, color, count) {
  if (reducedMotion) return;
  const { w } = game.lv;
  for (let k = 0; k < count; k++) {
    const a = Math.random() * 6.283, v = 0.6 + Math.random() * 1.8;
    game.sparks.push({ x: (i % w) + 0.5, y: ((i / w) | 0) + 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v, born: performance.now(), color });
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawBeams(now) {
  const { lv, tr } = game, { w, h, cells } = lv;
  ctx.globalCompositeOperation = 'lighter'; // üst üste binen ışınların renkleri toplanır
  ctx.lineCap = 'round';
  const passes = [
    // alfa toplamı 1: çekirdek tam ışın rengini verir, yalnızca kesişen ışınlar karışır
    { width: 0.3, alpha: 0.12 },
    { width: 0.14, alpha: 0.2 },
    { width: 0.06, alpha: 0.68 },
  ];
  for (let i = 0; i < w * h; i++) {
    for (let d = 0; d < 4; d++) {
      const m = tr.out[i * 4 + d];
      if (!m) continue;
      const x = i % w, y = (i / w) | 0, nx = x + DX[d], ny = y + DY[d];
      const next = nx >= 0 && ny >= 0 && nx < w && ny < h ? cells[ny * w + nx] : { t: 'wall' };
      const len = next && (next.t === 'wall' || next.t === 'emit') ? 0.5 : 1;
      const x0 = (x + 0.5) * S, y0 = (y + 0.5) * S;
      const x1 = x0 + DX[d] * len * S, y1 = y0 + DY[d] * len * S;
      ctx.strokeStyle = COLORS[m];
      for (const p of passes) {
        ctx.globalAlpha = p.alpha;
        ctx.lineWidth = S * p.width;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
      // ışının yönünü gösteren akan parıltı
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = S * 0.025;
      ctx.setLineDash([S * 0.06, S * 0.44]);
      ctx.lineDashOffset = reducedMotion ? 0 : -(now / 1000) * S * 1.5;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function drawPiece(c, i, now) {
  const { lv, tr } = game;
  const cx = ((i % lv.w) + 0.5) * S, cy = (((i / lv.w) | 0) + 0.5) * S;
  ctx.save();
  ctx.translate(cx, cy);
  if (c.t === 'wall') {
    roundRect(-S * 0.42, -S * 0.42, S * 0.84, S * 0.84, S * 0.1);
    ctx.fillStyle = '#2b3355'; ctx.fill();
    ctx.strokeStyle = '#3d476f'; ctx.lineWidth = 1.5; ctx.stroke();
  } else if (c.t === 'emit') {
    roundRect(-S * 0.34, -S * 0.34, S * 0.68, S * 0.68, S * 0.14);
    ctx.fillStyle = '#171d36'; ctx.fill();
    ctx.strokeStyle = COLORS[c.c]; ctx.lineWidth = S * 0.05; ctx.stroke();
    ctx.rotate((c.d * Math.PI) / 2);
    ctx.beginPath();
    ctx.moveTo(S * 0.2, 0); ctx.lineTo(-S * 0.1, -S * 0.17); ctx.lineTo(-S * 0.1, S * 0.17);
    ctx.closePath();
    ctx.fillStyle = COLORS[c.c]; ctx.fill();
  } else if (c.t === 'filter') {
    roundRect(-S * 0.3, -S * 0.3, S * 0.6, S * 0.6, S * 0.08);
    ctx.globalAlpha = 0.28; ctx.fillStyle = COLORS[c.c]; ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = COLORS[c.c]; ctx.lineWidth = S * 0.04; ctx.stroke();
  } else if (c.t === 'target') {
    const got = tr.recv[i], lit = got === c.c;
    const pulse = lit && !reducedMotion ? 1 + 0.06 * Math.sin(now / 180) : 1;
    if (lit) {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, S * 0.5);
      g.addColorStop(0, COLORS[c.c]); g.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.55; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, S * 0.5, 0, 6.283); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath(); ctx.arc(0, 0, S * 0.27 * pulse, 0, 6.283);
    ctx.fillStyle = '#0b0f1e'; ctx.fill();
    ctx.strokeStyle = COLORS[c.c]; ctx.lineWidth = S * 0.075; ctx.stroke();
    if (got) { // ortadaki nokta, hedefe şu an ulaşan rengi gösterir
      ctx.beginPath(); ctx.arc(0, 0, S * (lit ? 0.15 : 0.09), 0, 6.283);
      ctx.fillStyle = COLORS[got]; ctx.fill();
    }
  } else { // ayna ya da ayırıcı: yatay çizgi ∓45° döndürülür, dokununca yumuşakça döner
    const t = reducedMotion ? 1 : Math.min(1, (now - (game.turned.get(i) || 0)) / 140);
    const to = c.o ? 1 : -1;
    ctx.rotate(((to - (1 - t) * 2 * to) * Math.PI) / 4);
    ctx.lineCap = 'round';
    ctx.lineWidth = S * 0.1;
    if (c.t === 'split') {
      ctx.strokeStyle = '#8fb0ff';
      ctx.setLineDash([S * 0.13, S * 0.16]);
    } else {
      ctx.strokeStyle = '#e6ebff';
    }
    ctx.beginPath(); ctx.moveTo(-S * 0.4, 0); ctx.lineTo(S * 0.4, 0); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(0, 0, S * 0.085, 0, 6.283);
    ctx.fillStyle = '#090c17'; ctx.fill();
    ctx.lineWidth = S * 0.035; ctx.stroke();
  }
  ctx.restore();
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!game || !S) return;
  const { lv } = game, { w, h, cells } = lv;
  ctx.clearRect(0, 0, S * w, S * h);
  for (let i = 0; i < w * h; i++) {
    roundRect((i % w) * S + 1.5, ((i / w) | 0) * S + 1.5, S - 3, S - 3, S * 0.12);
    ctx.fillStyle = '#10152a';
    ctx.fill();
  }
  drawBeams(now);
  cells.forEach((c, i) => { if (c) drawPiece(c, i, now); });

  if (game.hint >= 0 && now < game.hintUntil) {
    const cx = ((game.hint % w) + 0.5) * S, cy = (((game.hint / w) | 0) + 0.5) * S;
    ctx.strokeStyle = '#ffd83b';
    ctx.lineWidth = 3;
    ctx.globalAlpha = reducedMotion ? 1 : 0.55 + 0.45 * Math.sin(now / 130);
    ctx.beginPath(); ctx.arc(cx, cy, S * 0.46, 0, 6.283); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  game.sparks = game.sparks.filter((p) => now - p.born < 700);
  ctx.globalCompositeOperation = 'lighter';
  for (const p of game.sparks) {
    const t = (now - p.born) / 1000;
    ctx.globalAlpha = 1 - t / 0.7;
    ctx.fillStyle = COLORS[p.color];
    ctx.beginPath();
    ctx.arc((p.x + p.vx * t) * S, (p.y + p.vy * t) * S, S * 0.045, 0, 6.283);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

soundLabel();
showMenu();
requestAnimationFrame(frame);
