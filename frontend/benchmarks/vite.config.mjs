import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { outDir: 'build/benchmark', rollupOptions: { input: 'benchmarks/browser.html' }, sourcemap: false },
  publicDir: false,
});
