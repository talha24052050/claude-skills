// src/ altındaki dosyaları tek, bağımsız bir index.html'e gömer (bağımlılık yok).
// dist/prizma.html ise aynı sayfanın <html>/<body> sarmalı olmayan, Artifact olarak yayınlanan hâlidir.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`src/${f}`, import.meta.url), 'utf8');
const js =
  read('core.js').replace(/^export /gm, '') +
  read('game.js').replace(/^import[\s\S]*?from '\.\/core\.js';\n/, '');
const [head, body] = read('template.html').split('<!--BODY-->');
const page = body
  .replace('/*CSS*/', () => read('style.css'))
  .replace('/*JS*/', () => `(() => {\n${js}})();`);

writeFileSync('index.html', `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>html{box-sizing:border-box;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}[hidden]{display:none!important}</style>
${head.trim()}
</head>
<body>
${page.trim()}
</body>
</html>
`);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/prizma.html', head + page);
