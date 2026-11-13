// Prizma oyun mantığı: ışın izleme, çözücü ve bölüm üretici. DOM'a bağımlı değildir.
//
// Renkler bit maskesidir: 1=kırmızı, 2=yeşil, 4=mavi (3=sarı, 5=mor, 6=camgöbeği, 7=beyaz).
// Yönler: 0=doğu, 1=güney, 2=batı, 3=kuzey.
// Hücre: null (boş) ya da {t:'wall'|'emit'|'mirror'|'split'|'filter'|'target', d, c, o}.
// Ayna/ayırıcı yönelimi o: 0 = '/', 1 = '\'.

export const DX = [1, 0, -1, 0];
export const DY = [0, 1, 0, -1];
const REFLECT = [[3, 2, 1, 0], [1, 0, 3, 2]];

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// out[hücre*4+yön]: hücreden o yöne çıkan ışının rengi.
// recv[hücre]: hedefe ulaşan renk. inb[hücre]: hücreye giren tüm ışınların rengi.
export function trace(lv) {
  const { w, h, cells } = lv;
  const out = new Uint8Array(w * h * 4);
  const recv = new Uint8Array(w * h);
  const inb = new Uint8Array(w * h);
  const q = [];
  cells.forEach((c, i) => { if (c && c.t === 'emit') q.push(i, c.d, c.c); });
  for (let p = 0; p < q.length; p += 3) {
    const i = q[p], d = q[p + 1];
    const bits = q[p + 2] & ~out[i * 4 + d];
    if (!bits) continue;
    out[i * 4 + d] |= bits;
    const x = (i % w) + DX[d], y = ((i / w) | 0) + DY[d];
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const j = y * w + x, c = cells[j];
    inb[j] |= bits;
    if (!c) q.push(j, d, bits);
    else if (c.t === 'target') recv[j] |= bits;
    else if (c.t === 'mirror') q.push(j, REFLECT[c.o][d], bits);
    else if (c.t === 'split') q.push(j, d, bits, j, REFLECT[c.o][d], bits);
    else if (c.t === 'filter' && bits & c.c) q.push(j, d, bits & c.c);
  }
  return { out, recv, inb };
}

export function isSolved(lv, tr = trace(lv)) {
  return lv.cells.every((c, i) => !c || c.t !== 'target' || tr.recv[i] === c.c);
}

// Oyuncunun çevirebildiği parçaların hücre indeksleri.
export function movable(lv) {
  const res = [];
  lv.cells.forEach((c, i) => { if (c && (c.t === 'mirror' || c.t === 'split')) res.push(i); });
  return res;
}

export function getState(lv) {
  return movable(lv).reduce((m, i, b) => m | (lv.cells[i].o << b), 0);
}

export function setState(lv, mask) {
  movable(lv).forEach((i, b) => { lv.cells[i].o = (mask >> b) & 1; });
}

// Bölümü çözen tüm durumlar (kaba kuvvet; parça sayısı küçük tutulur).
export function solutions(lv) {
  const saved = getState(lv), k = movable(lv).length, res = [];
  for (let m = 0; m < 1 << k; m++) {
    setState(lv, m);
    if (isSolved(lv)) res.push(m);
  }
  setState(lv, saved);
  return res;
}

function popcount(x) {
  let n = 0;
  for (; x; x &= x - 1) n++;
  return n;
}

// Verilen duruma en yakın çözüm: {dist: gereken dokunuş, mask: çözüm durumu}.
export function nearest(state, sols) {
  let best = { dist: Infinity, mask: 0 };
  for (const s of sols) {
    const d = popcount(s ^ state);
    if (d < best.dist) best = { dist: d, mask: s };
  }
  return best;
}

export function stars(taps, par) {
  return taps <= par ? 3 : taps <= par + 2 ? 2 : 1;
}

function tryBuild(r, p, minPar) {
  const { w, h } = p, n = w * h;
  const cells = new Array(n).fill(null);
  const lv = { w, h, cells };
  const ri = (k) => (r() * k) | 0;
  const free = () => {
    for (;;) { const i = ri(n); if (!cells[i]) return i; }
  };

  // Kaynaklar kenarda durur ve içeri bakar.
  for (const c of p.emit) {
    for (;;) {
      const side = ri(4);
      const x = side === 0 ? 0 : side === 2 ? w - 1 : 1 + ri(w - 2);
      const y = side === 1 ? 0 : side === 3 ? h - 1 : 1 + ri(h - 2);
      if (cells[y * w + x]) continue;
      cells[y * w + x] = { t: 'emit', d: side, c };
      break;
    }
  }
  for (let k = 0; k < (p.walls || 0); k++) cells[free()] = { t: 'wall' };
  for (let k = 0; k < p.mirrors; k++) cells[free()] = { t: 'mirror', o: ri(2) };
  for (let k = 0; k < (p.splits || 0); k++) cells[free()] = { t: 'split', o: ri(2) };
  for (let k = 0; k < (p.filters || 0); k++) cells[free()] = { t: 'filter', c: 1 << ri(3) };

  // Hedefler, bu (çözüm) durumunda ışının geçtiği boş hücrelere konur.
  const plain = (c) => p.emit.includes(c);
  for (let k = 0; k < p.targets; k++) {
    const { inb } = trace(lv);
    let cand = [];
    for (let i = 0; i < n; i++) if (!cells[i] && inb[i]) cand.push(i);
    if (!cand.length) return null;
    const mixed = cand.filter((i) => !plain(inb[i]));
    // Karışık renkli hedef en sona konur; önce konursa sonraki hedefler ışınlarını keser.
    if (p.mix && k === p.targets - 1 && mixed.length) cand = mixed;
    const i = cand[ri(cand.length)];
    cells[i] = { t: 'target', c: inb[i] };
  }
  // Yeni hedefler ışınları kestiği için renkleri son duruma göre yeniden belirle.
  const { recv } = trace(lv);
  let hasMixed = false;
  for (let i = 0; i < n; i++) {
    const c = cells[i];
    if (!c || c.t !== 'target') continue;
    if (!recv[i]) return null;
    c.c = recv[i];
    if (!plain(c.c)) hasMixed = true;
  }
  if (p.mix && !hasMixed) return null;

  // Başlangıç: çözümlere en uzak karışık durum. par = gereken en az dokunuş.
  const sols = solutions(lv);
  const k = movable(lv).length;
  let start = 0, par = -1;
  for (let t = 0; t < 48; t++) {
    const m = ri(1 << k), d = nearest(m, sols).dist;
    if (d > par) { par = d; start = m; }
  }
  if (par < minPar) return null;
  setState(lv, start);
  lv.par = par;
  return lv;
}

// Tohumdan her zaman aynı, çözülebilir bölümü üretir.
// Uygun bölüm çıkmazsa zorluk eşiği kademeli olarak düşürülür.
export function generate(seed, p) {
  const r = rng(seed);
  for (let attempt = 0; ; attempt++) {
    const lv = tryBuild(r, p, Math.max(1, p.minPar - ((attempt / 2000) | 0)));
    if (lv) return lv;
  }
}

export const LEVEL_COUNT = 40;

export function levelParams(n) {
  const one = [1, 2, 4][n % 3];
  const two = [[1, 2], [1, 4], [2, 4]][n % 3];
  if (n <= 4) return { w: 5, h: 5, emit: [one], mirrors: n > 2 ? 4 : 3, targets: 1, minPar: n > 2 ? 2 : 1 };
  if (n <= 8) return { w: 5, h: 6, emit: two, mirrors: 5, walls: 1, targets: 2, minPar: n > 6 ? 3 : 2 };
  if (n <= 14) return { w: 6, h: 7, emit: [...two, two[n % 2]], mirrors: 6, walls: 2, targets: 2, mix: true, minPar: 3 };
  if (n <= 20) return { w: 6, h: 7, emit: two, mirrors: 5, splits: 2, walls: 2, targets: 3, mix: true, minPar: n > 17 ? 4 : 3 };
  if (n <= 28) return { w: 6, h: 8, emit: [7, one], mirrors: 6, splits: 2, filters: 2, walls: 3, targets: 3, mix: true, minPar: 4 };
  return { w: 7, h: 9, emit: [1, 2, 4], mirrors: 7, splits: 3, filters: 2, walls: 4, targets: 4, mix: true, minPar: 5 };
}

export function campaignLevel(n) {
  return generate(n * 7919 + 13, levelParams(n));
}

// dateNum: YYYYAAGG biçiminde sayı (ör. 20261113).
export function dailyLevel(dateNum) {
  return generate(dateNum, levelParams(24));
}
