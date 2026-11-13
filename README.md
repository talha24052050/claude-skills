# Prizma

Renkli ışınları aynalarla yönlendirip her hedefi kendi renginde yaktığın bir tarayıcı bulmacası.
Telefonda dokunarak, bilgisayarda tıklayarak oynanır. Kurulum ve bağımlılık yoktur: `index.html` dosyasını aç.

## Nasıl oynanır

- **Aynaya dokun**, 90° döner ve ışının yolunu değiştirir.
- **Hedef (halka)** yalnızca tam kendi rengindeki ışıkla yanar. Ortadaki nokta, o an hedefe ulaşan rengi gösterir.
- **Renkler hedefte karışır:** kırmızı + yeşil = sarı, kırmızı + mavi = mor, yeşil + mavi = camgöbeği, üçü birden = beyaz.
- **Ayırıcı (kesikli çizgi)** ışını hem geçirir hem yansıtır.
- **Filtre (renkli cam)** ışığın yalnızca kendi rengini geçirir.
- Bölümü ne kadar az dokunuşla çözersen o kadar yıldız alırsın: "En az" sayısına ulaşırsan üç yıldız.

40 bölüm ve her gün değişen bir "Günün Bulmacası" var. İlerleme tarayıcıda saklanır.

## Geliştirme

```
npm test        # oyun mantığı testleri (Node 20+, bağımlılık yok)
npm run build   # src/ içeriğini tek dosyalık index.html'e gömer
```

| Dosya | İçerik |
| --- | --- |
| `src/core.js` | Işın izleme, çözücü, bölüm üretici (DOM'dan bağımsız) |
| `src/game.js` | Arayüz: tahta çizimi, dokunma, ses, kayıt |
| `src/style.css`, `src/template.html` | Görünüm ve sayfa iskeleti |
| `test/core.test.mjs` | Testler |
| `index.html` | Derlenmiş oyun (elle düzenleme; `npm run build` üretir) |

Bölümler elle çizilmez: her bölüm, numarasından türetilen bir tohumla üretilir. Üretici önce çözülmüş bir
tahta kurar, tüm ayna durumlarını deneyerek çözümleri bulur, sonra tahtayı çözüme en uzak duruma karıştırır.
Böylece her bölümün çözülebilir olduğu ve "En az" sayısının doğru olduğu testlerle doğrulanır.
