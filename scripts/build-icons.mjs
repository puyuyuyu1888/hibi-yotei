// public/icon.svg から PWA 用の PNG アイコンを作る。既存の Playwright(Chromium) で描画する。
// 実行：.\project.ps1 icons（ブラウザーは .\project.ps1 browser-install で取得済みであること）
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const svg = await readFile(path.join(root, 'public/icon.svg'), 'utf8');
// maskable：背景を全面に塗り、マークを中央の安全領域（直径80%）に収める。
const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/^<rect[^>]*\/>/, '');
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" fill="#335c4b"/><g transform="translate(96 96) scale(.8) translate(-96 -96)">${inner}</g></svg>`;
const icons = [
  { file: 'icon-192.png', size: 192, source: svg },
  { file: 'icon-512.png', size: 512, source: svg },
  { file: 'icon-maskable-512.png', size: 512, source: maskable },
];
const browser = await chromium.launch({ args: ['--disable-breakpad', '--disable-crash-reporter', `--crash-dumps-dir=${path.join(root, '.cache/crashes')}`] });
try {
  for (const { file, size, source } of icons) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${source}`);
    await page.screenshot({ path: path.join(root, 'public', file), omitBackground: true });
    await page.close();
    console.log(`アイコン: public/${file} (${size}px)`);
  }
} finally { await browser.close(); }
