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
        // SVG artwork + theme config objects — no executable branch logic to unit-test
        'src/components/icons/**',
        'src/theme/**',
        // Interaction-heavy tool UIs (Quiz/Flashcards/Gantt/Mermaid/… editors & players): their
        // PURE logic (each tool's logic.ts + src/lib/*) IS unit-tested; the .tsx components are
        // exercised by the Playwright e2e suite, same split as the page shells above.
        'src/components/tools/**/*.tsx',
        'src/components/tools/quiz/image.ts',      // browser <canvas> resize — no jsdom coverage
        'src/components/tools/flashcards/apkg.ts', // Anki zip/sql.js WASM import — e2e/manual only
        // Auth & onboarding gates, PDF canvas, markdown renderer, scroll/route helpers — e2e shells
        'src/components/common/AuthPromptSnackbar.tsx',
        'src/components/common/DelegateMandates.tsx',
        'src/components/common/DevLoginButton.tsx',
        'src/components/common/Markdown.tsx',
        'src/components/common/OnboardingGate.tsx',
        'src/components/common/PdfViewer.tsx',
        'src/components/common/ScrollToTop.tsx',
        'src/components/common/TermsGate.tsx',
        // Bootstrap / effect hooks (auth init, SSE notification stream) — e2e-covered
        'src/hooks/useAuthInit.ts',
        'src/hooks/useNotificationsStream.ts',
        // Purely visual UI shells (the tested ones — GlassCard, StarRating — stay in)
        'src/components/ui/AdBanner.tsx',
        'src/components/ui/Divider.tsx',
        'src/components/ui/OrbitalLoader.tsx',
        'src/components/ui/SearchBar.tsx',
        'src/components/ui/Shimmer.tsx',
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
