import { test as base, type Page } from '@playwright/test';
import { AuthPage } from '../pages/auth.page';
import { NotesPage } from '../pages/notes.page';
import { ProfilePage } from '../pages/profile.page';
import { AuthApiClient } from '../clients/auth-api-client';
import { NotesApiClient } from '../clients/notes-api-client';
import { MailhogClient } from '../clients/mailhog-client';
import { env } from '../../config/env';
import { registerConfirmedUser } from '../utils/register';

const TOKEN_KEY = 'qa_task_token';

export interface SeededUser {
  id: string;
  email: string;
  password: string;
  token: string;
}

interface E2EFixtures {
  authPage: AuthPage;
  notesPage: NotesPage;
  profilePage: ProfilePage;
  /** MailHog reader (for the full UI registration journey). */
  mailhog: MailhogClient;
  /** A verified user created via the API (fast path, no UI signup). */
  seededUser: SeededUser;
  /** Notes API client authed as `seededUser` — to seed list/search data fast. */
  seededNotesApi: NotesApiClient;
  /** A page already authenticated as `seededUser` (token injected). */
  signedInPage: Page;
}

export const test = base.extend<E2EFixtures>({
  authPage: async ({ page }, use) => {
    await use(new AuthPage(page));
  },

  mailhog: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({ baseURL: env.mailhogUrl });
    await use(new MailhogClient(context));
    await context.dispose();
  },

  notesPage: async ({ page }, use) => {
    await use(new NotesPage(page));
  },

  profilePage: async ({ page }, use) => {
    await use(new ProfilePage(page));
  },

  /**
   * Register + confirm a user through the API. Far faster and less flaky than
   * driving signup/MailHog/confirm through the UI for every test — the full UI
   * journey gets its own dedicated E2E test instead.
   */
  seededUser: async ({ playwright }, use) => {
    const appCtx = await playwright.request.newContext({ baseURL: env.baseUrl });
    const mailCtx = await playwright.request.newContext({ baseURL: env.mailhogUrl });
    try {
      const auth = new AuthApiClient(appCtx);
      const mailhog = new MailhogClient(mailCtx);
      await use(await registerConfirmedUser(auth, mailhog));
    } finally {
      await appCtx.dispose();
      await mailCtx.dispose();
    }
  },

  seededNotesApi: async ({ playwright, seededUser }, use) => {
    const context = await playwright.request.newContext({
      baseURL: env.baseUrl,
      extraHTTPHeaders: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${seededUser.token}`,
      },
    });
    await use(new NotesApiClient(context));
    await context.dispose();
  },

  signedInPage: async ({ page, seededUser }, use) => {
    // Prime localStorage with the JWT before the app boots, then load the app.
    await page.goto('/app');
    await page.evaluate(
      ([key, token]) => window.localStorage.setItem(key, token),
      [TOKEN_KEY, seededUser.token] as const,
    );
    await page.reload();
    // Wait for the authenticated view to settle before handing off, so tests
    // that immediately reload/navigate don't race the initial /me bootstrap.
    await page.locator('#notes-view').waitFor({ state: 'visible' });
    await use(page);
  },
});

export { expect } from '@playwright/test';
