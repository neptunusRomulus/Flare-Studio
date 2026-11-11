import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: './src/setupTests.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/e2e/**/*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*.{ts,tsx,js,cjs}', 'electron/**/*.{ts,js,cjs}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'build/**',
        'scripts/**',
        'public/**',
        'dist/**',
        '**/*.{png,svg,jpg,ico,md}',
      ],
      thresholds: {
        lines: 21,
        statements: 22,
        functions: 20,
        branches: 21,
      },
    },
  }
});