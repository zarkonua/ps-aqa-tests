import { test, expect } from '../fixtures/e2e.fixture';
import { AuthApiClient } from '../clients/auth-api-client';
import { MailhogClient } from '../clients/mailhog-client';
import { registerConfirmedUser } from '../utils/register';
import { longValidEmail } from '../utils/test-data';
import { env } from '../../config/env';

const TOKEN_KEY = 'qa_task_token';

/**
 * A2 regression — UI profile view.
 * Cases UI-PROF-01 (renders details), 02 (navigate), 03 (long-email overflow 🐞).
 */
test.describe('UI — Profile', () => {
  test(
    'UI-PROF-01: the profile view renders the account details',
    { tag: '@regression' },
    async ({ signedInPage, profilePage, seededUser }) => {
      void signedInPage;
      await profilePage.openProfile();

      await expect(profilePage.view).toBeVisible();
      await expect(profilePage.email).toHaveText(seededUser.email);
      await expect(profilePage.id).toHaveText(seededUser.id);
    },
  );

  test(
    'UI-PROF-02: navigate between notes and profile',
    { tag: '@regression' },
    async ({ signedInPage, notesPage, profilePage }) => {
      void signedInPage;
      await profilePage.openProfile();
      await expect(profilePage.view).toBeVisible();

      await notesPage.navNotesButton.click();
      await expect(notesPage.view).toBeVisible();
    },
  );

  // 🐞 Defect (verified) — gap-analysis G6-adjacent: a long email overflows the
  // profile layout and forces a page-level horizontal scrollbar.
  test(
    'UI-PROF-03: a long email overflows the profile layout (defect)',
    { tag: '@regression' },
    async ({ page, playwright, profilePage }) => {
      // Seed a confirmed user with a long (but valid) email via the API.
      const appCtx = await playwright.request.newContext({ baseURL: env.baseUrl });
      const mailCtx = await playwright.request.newContext({ baseURL: env.mailhogUrl });
      let email: string;
      let token: string;
      try {
        const user = await registerConfirmedUser(
          new AuthApiClient(appCtx),
          new MailhogClient(mailCtx),
          'long',
          longValidEmail(),
        );
        email = user.email;
        token = user.token;
      } finally {
        await appCtx.dispose();
        await mailCtx.dispose();
      }

      await page.goto('/app');
      await page.evaluate(([k, t]) => window.localStorage.setItem(k, t), [TOKEN_KEY, token] as const);
      await page.reload();
      await profilePage.openProfile();

      await expect(profilePage.email).toHaveText(email);
      // Expected (correct): the long value wraps/truncates. Actual: horizontal overflow.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(true);
    },
  );
});
