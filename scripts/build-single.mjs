import { build } from 'vite';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = await build({
  configFile: false, root, publicDir: false, cacheDir: path.join(root, '.cache/vite-single'),
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    write: false, minify: 'esbuild', cssCodeSplit: false, target: 'es2020',
    lib: { entry: path.join(root, 'src/standalone.tsx'), formats: ['iife'], name: 'HibiSchedule' },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
const outputs = (Array.isArray(result) ? result : [result]).flatMap(r => r.output);
const chunks = outputs.filter(o => o.type === 'chunk');
const styles = outputs.filter(o => o.type === 'asset' && o.fileName.endsWith('.css'));
if (chunks.length !== 1 || chunks[0].imports.length || chunks[0].dynamicImports.length ||
  outputs.some(o => o.type === 'asset' && !o.fileName.endsWith('.css'))) {
  throw new Error('単一HTMLに埋め込めない出力が含まれています。');
}
const js = chunks[0].code.replace(/<\/script/gi, '<\\/script');
const css = styles.map(o => o.source).join('\n');
if (/@import\b|url\s*\(|<\/style/i.test(css)) throw new Error('外部素材を参照するCSSは使用できません。');
const icon = await readFile(path.join(root, 'public/icon.svg'), 'utf8');
const license = await readFile(path.join(root, 'node_modules/react/LICENSE'), 'utf8');
const baseCsp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'";
// PWA版だけ、manifest・Service Worker・manifestのアイコンに必要な同一オリジンの読み込みを許可する。connect-src 'none' は維持する。
const pwaCsp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob: 'self'; font-src 'none'; connect-src 'none'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'";
const page = (csp, extraHead = '') => `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#121212">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${Buffer.from(icon).toString('base64')}">${extraHead}
  <title>スケジュール</title>
  <style>${css}</style>
</head>
<body>
  <div id="root"></div>
  <noscript>JavaScriptを有効にして開いてください。</noscript>
  <!-- Bundled React / React DOM / Scheduler: ${license.replaceAll('--', '—')} -->
  <script>${js}</script>
</body>
</html>
`;

// 単一HTML版：プロジェクト直下の index.html（ファイルを直接開いて使う）。
const html = page(baseCsp);
await writeFile(path.join(root, 'index.html'), html);
console.log(`単一HTML: ${path.join(root, 'index.html')} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KiB)`);

// PWA版：dist/（GitHub Pages で公開する）。
const dist = path.join(root, 'dist');
const icons = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
const manifest = JSON.stringify({
  id: './', name: 'スケジュール', short_name: 'スケジュール', lang: 'ja', start_url: './', scope: './',
  display: 'standalone', theme_color: '#121212', background_color: '#121212',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2);
const files = {
  'index.html': page(pwaCsp, '\n  <link rel="manifest" href="manifest.webmanifest">'),
  'manifest.webmanifest': manifest,
};
for (const name of icons) files[name] = await readFile(path.join(root, 'public', name));
const version = createHash('sha256');
for (const [name, content] of Object.entries(files)) version.update(name).update(content);
const sw = (await readFile(path.join(root, 'src/sw.js'), 'utf8'))
  .replace('__VERSION__', version.digest('hex').slice(0, 12))
  .replace('__FILES__', JSON.stringify(['./', ...Object.keys(files)]));
await rm(dist, { recursive: true, force: true });
await mkdir(dist);
for (const [name, content] of Object.entries({ ...files, 'sw.js': sw })) await writeFile(path.join(dist, name), content);
console.log(`PWA版: ${dist} (${Object.keys(files).length + 1} ファイル)`);
