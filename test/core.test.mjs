import test from 'node:test';
import assert from 'node:assert/strict';
import {
  trace, isSolved, movable, getState, setState, solutions, nearest, stars,
  generate, campaignLevel, dailyLevel, levelParams, LEVEL_COUNT,
} from '../src/core.js';

// Satır dizilerinden bölüm kurar. Semboller:
// . boş  # duvar  / \ ayna  x y ayırıcı ('/' ve '\')  > v < ^ kırmızı kaynak
// g: yeşil kaynak (doğuya)  R G B Y W: hedef  r: kırmızı filtre
function make(rows) {
  const sym = {
    '.': null, '#': { t: 'wall' },
    '/': { t: 'mirror', o: 0 }, '\\': { t: 'mirror', o: 1 },
    x: { t: 'split', o: 0 }, y: { t: 'split', o: 1 },
    '>': { t: 'emit', d: 0, c: 1 }, v: { t: 'emit', d: 1, c: 1 },
    '<': { t: 'emit', d: 2, c: 1 }, '^': { t: 'emit', d: 3, c: 1 },
    g: { t: 'emit', d: 0, c: 2 }, w: { t: 'emit', d: 0, c: 7 },
    R: { t: 'target', c: 1 }, G: { t: 'target', c: 2 }, B: { t: 'target', c: 4 },
    Y: { t: 'target', c: 3 }, W: { t: 'target', c: 7 },
    r: { t: 'filter', c: 1 },
  };
  const cells = rows.join('').split('').map((ch) => (sym[ch] ? { ...sym[ch] } : null));
  return { w: rows[0].length, h: rows.length, cells };
}

test('ışın düz gider ve hedefi yakar', () => {
  assert.ok(isSolved(make(['>..R'])));
});

test('duvar ışını keser', () => {
  assert.ok(!isSolved(make(['>.#R'])));
});

test("'/' ayna doğuya giden ışını kuzeye çevirir", () => {
  assert.ok(isSolved(make(['..R', '>./'])));
  assert.ok(!isSolved(make(['..R', '>.\\'])));
});

test("'\\' ayna doğuya giden ışını güneye çevirir", () => {
  assert.ok(isSolved(make(['>.\\', '..R'])));
});

test('ayırıcı ışını hem geçirir hem yansıtır', () => {
  assert.ok(isSolved(make(['.R.', '>xR'])));
});

test('iki renk aynı hedefte karışır: kırmızı + yeşil = sarı', () => {
  const lv = make(['.v.', 'g.Y']);
  assert.ok(!isSolved(lv)); // kırmızı aşağı gider, hedefe yalnızca yeşil ulaşır
  assert.ok(isSolved(make(['v..', '\\.Y', '...', 'g./']))); // iki ışın aynalarla aynı hedefe yönlenir
  assert.ok(isSolved(make(['..v', 'g.Y'])));
});

test('hedef tam rengini ister: fazladan renk hedefi bozar', () => {
  assert.ok(!isSolved(make(['..v', 'g.G'])));
});

test('filtre beyaz ışıktan yalnızca kendi rengini geçirir', () => {
  assert.ok(isSolved(make(['w.rR'])));
  assert.ok(!isSolved(make(['w.rW'])));
  assert.ok(!isSolved(make(['g.rR']))); // yeşil, kırmızı filtreden geçemez
});

test('aynalar arasında dönen ışın sonsuz döngüye girmez', () => {
  const lv = make(['/y\\', '>./', '\\./']);
  assert.doesNotThrow(() => trace(lv));
});

test('getState/setState gidiş-dönüş tutarlı', () => {
  const lv = make(['>/\\', 'x.y']);
  const k = movable(lv).length;
  for (let m = 0; m < 1 << k; m++) {
    setState(lv, m);
    assert.equal(getState(lv), m);
  }
});

test('solutions yalnızca çözen durumları döndürür ve durumu bozmaz', () => {
  const lv = make(['..R', '>./']);
  setState(lv, 1);
  assert.deepEqual(solutions(lv), [0]);
  assert.equal(getState(lv), 1);
});

test('nearest en az dokunuş sayısını bulur', () => {
  assert.deepEqual(nearest(0b0000, [0b1110, 0b0001]), { dist: 1, mask: 0b0001 });
});

test('yıldızlar: par içinde 3, par+2 içinde 2, sonrası 1', () => {
  assert.deepEqual([3, 4, 5, 6, 7].map((t) => stars(t, 4)), [3, 3, 2, 2, 1]);
});

test('üretici aynı tohumla aynı bölümü verir', () => {
  const p = levelParams(12);
  assert.deepEqual(generate(42, p), generate(42, p));
  assert.notDeepEqual(generate(42, p), generate(43, p));
});

test('her bölüm çözülebilir, çözülmemiş başlar ve par doğrudur', () => {
  for (let n = 1; n <= LEVEL_COUNT; n++) {
    const lv = campaignLevel(n);
    const p = levelParams(n);
    assert.equal(lv.cells.length, p.w * p.h, `bölüm ${n} boyut`);
    assert.ok(!isSolved(lv), `bölüm ${n} çözülmüş başlıyor`);
    const sols = solutions(lv);
    assert.ok(sols.length > 0, `bölüm ${n} çözümsüz`);
    assert.equal(nearest(getState(lv), sols).dist, lv.par, `bölüm ${n} par`);
    assert.ok(lv.par >= 1, `bölüm ${n} par >= 1`);
    assert.equal(lv.cells.filter((c) => c && c.t === 'target').length, p.targets, `bölüm ${n} hedef sayısı`);
  }
});

test('zorluk bölümlerle artar', () => {
  const avg = (from, to) => {
    let s = 0;
    for (let n = from; n <= to; n++) s += campaignLevel(n).par;
    return s / (to - from + 1);
  };
  assert.ok(avg(1, 4) < avg(15, 20));
  assert.ok(avg(15, 20) < avg(29, 40));
});

test('günlük bulmaca çözülebilir ve güne göre değişir', () => {
  const a = dailyLevel(20261113), b = dailyLevel(20261114);
  assert.ok(solutions(a).length > 0);
  assert.notDeepEqual(a, b);
  assert.deepEqual(a, dailyLevel(20261113));
});
