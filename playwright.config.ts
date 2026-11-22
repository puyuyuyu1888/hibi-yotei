import { defineConfig } from '@playwright/test';
import path from 'node:path';

export default defineConfig({
  testDir: './tests', outputDir: './test-results', workers: 1,
  reporter: [['list']], timeout: 30000,
  // PWA版（dist/）を配信するローカルサーバー。先に build で dist/ を作っておくこと。
  webServer: { command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173/', reuseExistingServer: false },
  use: {
    viewport: { width: 320, height: 740 }, offline: true,
    isMobile: true, hasTouch: true, locale: 'ja-JP', timezoneId: 'Asia/Tokyo',
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
    launchOptions: { args: ['--disable-breakpad', '--disable-crash-reporter', `--crash-dumps-dir=${path.resolve('.cache/crashes')}`] },
  },
});
