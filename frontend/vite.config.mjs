import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Preserve the existing public build-time API setting. Do not expose the
  // process environment or backend credentials to browser bundles.
  const env = loadEnv(mode, process.cwd(), 'REACT_APP_API_URL');
  return {
    define: { 'process.env.REACT_APP_API_URL': JSON.stringify(process.env.REACT_APP_API_URL || env.REACT_APP_API_URL || '') },
    build: { outDir: 'build', sourcemap: false, target: ['chrome107', 'firefox104', 'safari16', 'edge107'] },
    server: { host: '127.0.0.1', port: 3000, strictPort: true },
    preview: { host: '127.0.0.1', port: 3000, strictPort: true },
    test: { environment: 'jsdom', globals: true, include: ['src/**/*.test.{js,jsx}'], pool: 'forks', maxWorkers: 1 },
  };
});
