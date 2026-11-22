// PWA版の Service Worker。scripts/build-single.mjs が版番号とファイル一覧を埋め込み、dist/sw.js として出力する。
// 起動に必要なファイルをすべてキャッシュし、オフラインでも起動できるようにする。
// 新しい版は起動時にバックグラウンドで取得・有効化し、次回起動時から使われる。古い版のキャッシュは削除する。
const PREFIX = 'hibi-yotei-';
const CACHE = PREFIX + '__VERSION__';
const FILES = __FILES__;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE)
    .then(cache => cache.addAll(FILES.map(file => new Request(file, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    // 画面の読み込みは常にキャッシュ済みのアプリ本体を返す（単一ページのため）。
    const cached = await cache.match(request.mode === 'navigate' ? './' : request, { ignoreSearch: true });
    return cached ?? fetch(request);
  }));
});
