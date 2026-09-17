import { defineConfig } from 'vitest/config';
import path from 'node:path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    css: true,
    reporters: ['verbose'],
    env: {
      VITE_API_BASE_URL: 'http://localhost:4000',
      VITE_SOCKET_URL: 'http://localhost:4000',
      VITE_SOCKET_PATH: '/socket.io',
      VITE_API_VERSION: 'api/v1',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        '**/types/**',
        '**/constants/**',
        '**/config/**',
        '**/env.ts',
        '**/pdf-export.ts',
        '**/__tests__/**',
        '**/tests/**',
        '**/test/**',
      ],
      thresholds: {
        global: {
          lines: 50,
          functions: 50,
          branches: 50,
          statements: 50,
        },
      },
    },
  },
});