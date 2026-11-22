import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  cacheDir: '.cache/vite',
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'], restoreMocks: true },
});
