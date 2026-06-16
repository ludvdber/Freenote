/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Writes build/stats.html with a treemap of the production bundle.
    // Trigger with `npm run analyze`. Disabled by default so dev/prod builds stay fast.
    ...(mode === 'analyze'
      ? [
          visualizer({
            filename: 'build/stats.html',
            gzipSize: true,
            brotliSize: true,
            open: false,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'html', 'json-summary'],
      // Measure all source, not just files imported by a test, for an honest picture.
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      // Scope: the unit-testable layer (lib, stores, hooks, api, reusable components).
      // Page compositions, admin CRUD panels and home/layout/visual shells are validated by the
      // Playwright e2e suite (tests/e2e/site-audit.spec.ts), not unit tests — a standard split.
      exclude: [
        // Non-executable or non-unit-testable by design
        'src/**/*.styles.ts',
        'src/**/*.data.ts',
        'src/**/*.data.tsx',
        'src/**/*.d.ts',
        'src/types/**',
        'src/i18n/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/test/**',
        'src/**/__tests__/**',
        // Three.js / WebGL visual layer — exercised only in a real GPU canvas
        'src/components/three/**',
        // Route compositions + heavy visual shells — covered by the e2e suite, not unit tests
        'src/App.tsx',
        'src/components/ThemedApp.tsx',
        'src/pages/**',
        'src/components/admin/**',
        'src/components/home/**',
        'src/components/layout/**',
      ],
      thresholds: {
        statements: 70,
        lines: 70,
        functions: 60,
        branches: 70,
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
      },
      '/oauth2': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/login/oauth2': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
}))
