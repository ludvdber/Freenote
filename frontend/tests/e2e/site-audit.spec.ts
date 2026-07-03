import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.resolve(__dirname, '../../screenshots');

// ── Console error collector ─────────────────────────────────────────
const consoleErrors: Record<string, string[]> = {};

function collectConsole(page: Page, label: string) {
  consoleErrors[label] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      consoleErrors[label].push(msg.text());
    }
  });
}

/** Match either French or English i18n text */
function either(fr: string, en: string) {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${esc(fr)}|${esc(en)}`);
}

/**
 * Wait for the SPA to be usable. NEVER use waitForLoadState('networkidle') here: for a logged-in
 * user the notifications SSE stream (/api/notifications/stream) keeps one connection open for the
 * whole session, so "network idle" is never reached and every test times out. We wait for the DOM
 * plus a short settle delay, then assert on concrete elements.
 */
async function settle(page: Page, ms = 800) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(ms);
}

/** Scroll to trigger framer-motion whileInView animations */
async function autoScroll(page: Page) {
  await page.evaluate(async () => {
    const step = Math.floor(window.innerHeight / 2);
    const maxScroll = document.body.scrollHeight;
    for (let y = 0; y < maxScroll; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 200));
    }
    window.scrollTo(0, maxScroll);
    await new Promise((r) => setTimeout(r, 300));
  });
}

/** Dev login via API — sets the JWT cookie directly */
async function devLogin(page: Page, username: string) {
  // Call the dev login API to set the JWT cookie
  await page.request.post(`http://localhost:8080/api/dev/login/${username}`);
  // Then fetch /api/users/me and hydrate the auth store via localStorage
  const meRes = await page.request.get('http://localhost:8080/api/users/me');
  const user = await meRes.json();
  // Set the Zustand persisted store in localStorage
  await page.evaluate((u) => {
    const state = {
      state: {
        user: u,
        token: 'cookie',
        isVerified: !!u.verified,
        isAdmin: u.role === 'ADMIN',
      },
      version: 0,
    };
    localStorage.setItem('freenote-auth', JSON.stringify(state));
  }, user);
}

// ══════════════════════════════════════════════════════════════════════
//  PART 1 — VISITOR (non connecté)
// ══════════════════════════════════════════════════════════════════════

test.describe('Visiteur non connecté', () => {
  test('page d\'accueil accessible avec contenu', async ({ page }) => {
    collectConsole(page, 'visitor-home');
    await page.goto('/');
    await expect(page.getByText(either('Réussis plus vite', 'Learn faster'))).toBeVisible({ timeout: 15_000 });
    await autoScroll(page);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'visitor-home.png'), fullPage: true });
  });

  test('routes protégées redirigent vers l\'accueil', async ({ page }) => {
    collectConsole(page, 'visitor-blocked');
    // /news, /guides, /browse, /documents/:id, /outils, /a-propos sont PUBLIQUES (vitrine
    // anonyme pour les deux premières du catalogue) — ne pas les tester ici.
    for (const route of ['/courses/1', '/users/2', '/leaderboard', '/upload']) {
      await page.goto(route);
      // Should redirect to home
      await page.waitForURL('/', { timeout: 5_000 });
    }
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'visitor-redirect.png') });
  });

  test('pages publiques accessibles sans login', async ({ page }) => {
    collectConsole(page, 'visitor-public');
    for (const route of ['/news', '/guides', '/browse', '/a-propos']) {
      await page.goto(route);
      await settle(page);
      expect(page.url()).toContain(route); // pas de redirection
      const body = await page.locator('body').textContent();
      expect(body!.length).toBeGreaterThan(100);
    }
  });

  test('vitrine anonyme du catalogue : /browse + teaser /documents/:id', async ({ page }) => {
    collectConsole(page, 'visitor-catalog');
    await page.goto('/browse');
    await settle(page);
    // L'invite de connexion (aperçu public) est visible pour un anonyme.
    await expect(page.getByText(either('aperçu public', 'public preview')).first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'visitor-browse-teaser.png'), fullPage: true });
    // L'ancienne URL /ressources redirige vers /browse.
    await page.goto('/ressources');
    await page.waitForURL('/browse', { timeout: 5_000 });
  });

  test('outils accessibles sans login', async ({ page }) => {
    collectConsole(page, 'visitor-tools');
    await page.goto('/outils');
    await expect(page.getByText(either('Calculateur IPv4', 'IPv4 Calculator'))).toBeVisible({ timeout: 10_000 });
    // Drill into one tool page (separate SEO URL)
    await page.goto('/outils/calculateur-moyenne');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'visitor-tools.png'), fullPage: true });
  });

  test('quiz : hint local visible pour un anonyme', async ({ page }) => {
    collectConsole(page, 'visitor-quiz');
    await page.goto('/outils/quiz');
    // Le nouvel encart explique le modèle local/en-ligne aux non-connectés.
    await expect(page.getByText(either('tout reste sur cet appareil', 'stays on this device'))).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'visitor-quiz.png'), fullPage: true });
  });

  test('pages légales accessibles sans login', async ({ page }) => {
    collectConsole(page, 'visitor-legal');
    await page.goto('/legal');
    await settle(page);
    const body = await page.locator('body').textContent();
    expect(body!.length).toBeGreaterThan(200);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'visitor-legal.png'), fullPage: true });
  });

  test('page 404', async ({ page }) => {
    collectConsole(page, 'visitor-404');
    await page.goto('/cette-page-nexiste-pas');
    await expect(page.getByText('404')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'visitor-404.png'), fullPage: true });
  });

  test('bouton Dev Login visible en dev', async ({ page }) => {
    collectConsole(page, 'visitor-devlogin');
    await page.goto('/');
    await expect(page.getByText('Dev Login')).toBeVisible({ timeout: 10_000 });
  });
});

// ══════════════════════════════════════════════════════════════════════
//  PART 2 — UTILISATEUR CONNECTÉ (Sophie_M — verified)
// ══════════════════════════════════════════════════════════════════════

test.describe('Utilisateur connecté', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await devLogin(page, 'Sophie_M');
  });

  test('browse accessible après login', async ({ page }) => {
    collectConsole(page, 'auth-browse');
    await page.goto('/browse');
    await settle(page, 1500);
    // Should NOT redirect — page should show search/documents
    expect(page.url()).toContain('/browse');
    const body = await page.locator('body').textContent();
    expect(body!.length).toBeGreaterThan(100);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'auth-browse.png'), fullPage: true });
  });

  test('page cours accessible', async ({ page }) => {
    collectConsole(page, 'auth-course');
    await page.goto('/courses/1');
    await settle(page, 1500);
    expect(page.url()).toContain('/courses/');
    const headings = page.locator('h1, h2, h3, h4, h5');
    await expect(headings.first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'auth-course.png'), fullPage: true });
  });

  test('page document avec métadonnées', async ({ page }) => {
    collectConsole(page, 'auth-document');
    await page.goto('/documents/1');
    await settle(page, 1500);
    expect(page.url()).toContain('/documents/');

    // Titre visible
    const headings = page.locator('h1, h2, h3, h4, h5');
    await expect(headings.first()).toBeVisible({ timeout: 10_000 });

    // Catégorie
    const body = await page.locator('body').textContent();
    const categories = [
      'Synthèse', 'Examen', 'Notes', 'Exercices', 'Divers', 'Cours', 'TFE',
      'Summary', 'Exam', 'Notes', 'Exercises', 'Miscellaneous',
    ];
    expect(categories.some((c) => body!.includes(c))).toBeTruthy();

    // Laisse le canvas pdf.js se rendre, puis vérifie que la page a du contenu.
    await page.waitForTimeout(2_000);
    expect(body!.length).toBeGreaterThan(100);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'auth-document.png'), fullPage: true });
  });

  test('leaderboard accessible', async ({ page }) => {
    collectConsole(page, 'auth-leaderboard');
    await page.goto('/leaderboard');
    await settle(page, 1500);
    expect(page.url()).toContain('/leaderboard');
    await expect(page.getByText('XP').first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'auth-leaderboard.png'), fullPage: true });
  });

  test('profil public accessible', async ({ page }) => {
    collectConsole(page, 'auth-user');
    await page.goto('/users/2');
    await settle(page, 1500);
    expect(page.url()).toContain('/users/');
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    await expect(headings.first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'auth-user.png'), fullPage: true });
  });

  test('page upload accessible (verified)', async ({ page }) => {
    collectConsole(page, 'auth-upload');
    await page.goto('/upload');
    await settle(page);
    expect(page.url()).toContain('/upload');
    // Titre "Partager un document" visible
    await expect(
      page.getByText(either('Partager un document', 'Share a document')),
    ).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'auth-upload.png'), fullPage: true });
  });

  test('quiz : onglets Mes quiz / Bibliothèque', async ({ page }) => {
    collectConsole(page, 'auth-quiz');
    await page.goto('/outils/quiz');
    await settle(page);
    await expect(page.getByRole('tab').first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'auth-quiz.png'), fullPage: true });
  });
});

// ══════════════════════════════════════════════════════════════════════
//  PART 3 — THEME & MOBILE
// ══════════════════════════════════════════════════════════════════════

test.describe('Theme & Mobile', () => {
  test('toggle dark/light mode', async ({ page }) => {
    collectConsole(page, 'theme-toggle');
    await page.goto('/');
    await settle(page);
    const themeButton = page.getByRole('button', { name: /changer de thème|toggle theme/i });
    await expect(themeButton).toBeVisible({ timeout: 10_000 });
    await themeButton.click();
    await page.waitForTimeout(500);
    await autoScroll(page);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'home-light.png'), fullPage: true });
    await themeButton.click();
    await page.waitForTimeout(500);
  });

  test('mobile avec hamburger', async ({ page }) => {
    collectConsole(page, 'mobile');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await settle(page);
    const nav = page.locator('nav');
    await expect(nav.locator('button').first()).toBeVisible({ timeout: 10_000 });
    await autoScroll(page);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'home-mobile.png'), fullPage: true });
  });
});

// ══════════════════════════════════════════════════════════════════════
//  PART 4 — API HEALTH (aligné sur l'access gate : email @isfce.be vérifié)
// ══════════════════════════════════════════════════════════════════════

test.describe('API Health', () => {
  test('GET /api/stats est public (compteurs de la home anonyme)', async ({ request }) => {
    const res = await request.get('http://localhost:8080/api/stats');
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.totalDocs).toBeGreaterThan(0);
  });

  test('endpoints publics : news, guides, catalogue teaser', async ({ request }) => {
    for (const ep of ['/api/news', '/api/guides', '/api/public/documents']) {
      const res = await request.get(`http://localhost:8080${ep}`);
      expect(res.status(), ep).toBe(200);
    }
  });

  test('endpoints métier refusés aux anonymes (401)', async ({ request }) => {
    for (const ep of ['/api/sections', '/api/documents/popular', '/api/documents/search', '/api/quizzes', '/api/leaderboard']) {
      const res = await request.get(`http://localhost:8080${ep}`);
      expect(res.status(), ep).toBe(401);
    }
  });

  test('sections + populaires accessibles une fois vérifié', async ({ request }) => {
    await request.post('http://localhost:8080/api/dev/login/Sophie_M');
    const sections = await request.get('http://localhost:8080/api/sections');
    expect(sections.ok()).toBeTruthy();
    expect((await sections.json()).length).toBeGreaterThan(0);
    const popular = await request.get('http://localhost:8080/api/documents/popular');
    expect(popular.ok()).toBeTruthy();
    expect((await popular.json()).length).toBeGreaterThan(0);
  });

  test('POST /api/dev/login sets JWT cookie', async ({ request }) => {
    const res = await request.post('http://localhost:8080/api/dev/login/Sophie_M');
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.username).toBe('Sophie_M');
    expect(json.verified).toBe('true');
  });

  test('GET /api/documents/1/file returns PDF (authenticated)', async ({ request }) => {
    // Login first
    await request.post('http://localhost:8080/api/dev/login/Sophie_M');
    const res = await request.get('http://localhost:8080/api/documents/1/file');
    expect(res.ok()).toBeTruthy();
    const contentType = res.headers()['content-type'];
    expect(contentType).toContain('application/pdf');
  });
});

// ══════════════════════════════════════════════════════════════════════
//  RAPPORT FINAL
// ══════════════════════════════════════════════════════════════════════

test.describe('Rapport final', () => {
  test('erreurs console collectées', async () => {
    console.log('\n══════════════════════════════════════════════');
    console.log('  RAPPORT — Erreurs console JavaScript');
    console.log('══════════════════════════════════════════════\n');

    let totalErrors = 0;
    for (const [pageName, errors] of Object.entries(consoleErrors)) {
      if (errors.length === 0) {
        console.log(`  ✓ ${pageName}: aucune erreur`);
      } else {
        console.log(`  ✗ ${pageName}: ${errors.length} erreur(s)`);
        errors.forEach((err) => console.log(`      → ${err.substring(0, 200)}`));
        totalErrors += errors.length;
      }
    }

    console.log(`\n  Total erreurs console: ${totalErrors}`);
    console.log('══════════════════════════════════════════════\n');
  });
});
