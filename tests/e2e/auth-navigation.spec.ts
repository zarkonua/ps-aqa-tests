import { test, expect } from '../fixtures/e2e.fixture';

const TOKEN_KEY = 'qa_task_token';

/**
 * Client-side auth gating.
 * @smoke — UI-GUARD-01: with no session, the app shows the auth screen (sign-up + sign-in)
 *   and never exposes the authenticated notes view.
 * @regression — UI-GUARD-02 (app reacts to a 401), UI-GUARD-03 (valid session renders).
 */
test.describe('UI — Auth gating', () => {
  test(
    'UI-GUARD-01: unauthenticated app shows the auth screen, not the notes view',
    { tag: '@smoke' },
    async ({ page, authPage, notesPage }) => {
      await page.goto('/app');

      await expect(authPage.signinForm).toBeVisible();
      await expect(authPage.signupForm).toBeVisible();
      await expect(notesPage.view).toBeHidden();
    },
  );

  test(
    'UI-GUARD-02: an invalid token is treated as unauthenticated',
    { tag: '@regression' },
    async ({ page, authPage, notesPage }) => {
      await page.goto('/app');
      await page.evaluate((k) => window.localStorage.setItem(k, 'not.a.valid.jwt'), TOKEN_KEY);
      await page.reload();

      // The SPA treats the API 401 as "not signed in" — auth screen, no error/blank state.
      await expect(authPage.signinForm).toBeVisible();
      await expect(notesPage.view).toBeHidden();
    },
  );

  test(
    'UI-GUARD-03: a valid session renders the app',
    { tag: '@regression' },
    async ({ signedInPage, notesPage }) => {
      void signedInPage;
      await expect(notesPage.view).toBeVisible();
      await expect(notesPage.logoutButton).toBeVisible();
    },
  );
});
