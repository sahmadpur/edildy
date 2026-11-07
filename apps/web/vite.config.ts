import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  // A second checkout can point its dev server at an API on another port: `API_PORT=3100` in apps/web/.env.local.
  const api = `http://localhost:${loadEnv(mode, import.meta.dirname, '').API_PORT || '3000'}`;
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
    server: { port: 5173, proxy: { '/api': api } },
    preview: { port: 4173, proxy: { '/api': api } },
    test: {
      environment: 'jsdom',
      setupFiles: ['src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
      // Heavy pages (reports) can pass 5 s when the CI runner is loaded.
      testTimeout: 15_000,
    },
  };
});
