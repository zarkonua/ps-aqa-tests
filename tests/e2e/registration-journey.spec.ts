import { test, expect } from '../fixtures/e2e.fixture';
import { DEFAULT_PASSWORD, uniqueEmail } from '../utils/test-data';

const TOKEN_KEY = 'qa_task_token';
const readToken = (page: import('@playwright/test').Page) =>
  page.evaluate((k) => window.localStorage.getItem(k), TOKEN_KEY);

/**
 * Registration journey & session lifecycle.
 * @smoke — UI-REG-01: the flagship end-to-end browser journey. Sign up through the form ->
 *   read the confirmation link from MailHog -> open it -> the app auto-confirms and lands the
 *   user authenticated on the notes view (token persisted in localStorage).
 * @regression — UI-REG-02 (sign in), 03 (API error surfaced), 04 (logout), 05 (reload).
 */
test.describe('UI — Registration journey', () => {
  test(
    'UI-REG-01: sign up -> confirm via email link -> authenticated on notes view',
    { tag: '@smoke' },
    async ({ page, authPage, notesPage, mailhog }) => {
      const email = uniqueEmail('ui');

      await authPage.open();
      await expect(authPage.signupForm).toBeVisible();
      await authPage.signup(email, DEFAULT_PASSWORD);

      // Sign-up success is surfaced in the status banner (echoes the email).
      await expect(authPage.status).toContainText(email);

      // Open the confirmation link straight from the delivered email.
      const link = await mailhog.getConfirmationLink(email);
      await page.goto(link);

      // Auto-confirms and lands authenticated on the notes view.
      await expect(notesPage.view).toBeVisible();
      await expect(notesPage.logoutButton).toBeVisible();

      const token = await readToken(page);
      expect(token, 'JWT should be persisted after confirmation').toBeTruthy();
    },
  );

  test(
    'UI-REG-02: sign in through the form transitions to the notes view',
    { tag: '@regression' },
    async ({ page, authPage, notesPage, seededUser }) => {
      await page.goto('/app');
      await authPage.signin(seededUser.email, seededUser.password);

      await expect(notesPage.view).toBeVisible();
      await expect(notesPage.logoutButton).toBeVisible();
      expect(await readToken(page)).toBeTruthy();
    },
  );

  test(
    'UI-REG-03: an API error is surfaced in #status (wrong password)',
    { tag: '@regression' },
    async ({ page, authPage, seededUser }) => {
      await page.goto('/app');
      await authPage.signin(seededUser.email, 'WrongPassword9!');

      await expect(authPage.status).toContainText(/invalid credentials/i);
      await expect(authPage.signinForm).toBeVisible(); // stays on the auth screen
      expect(await readToken(page)).toBeNull();
    },
  );

  test(
    'UI-REG-04: logout clears the session',
    { tag: '@regression' },
    async ({ signedInPage, authPage, notesPage }) => {
      await notesPage.logoutButton.click();

      await expect(authPage.signinForm).toBeVisible();
      expect(await readToken(signedInPage)).toBeNull();
    },
  );

  test(
    'UI-REG-05: the session persists on reload',
    { tag: '@regression' },
    async ({ signedInPage, notesPage }) => {
      await signedInPage.reload();
      await expect(notesPage.view).toBeVisible();
      await expect(notesPage.logoutButton).toBeVisible();
    },
  );
});
