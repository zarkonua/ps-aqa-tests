import { test as base, type APIRequestContext } from '@playwright/test';
import { AuthApiClient } from '../clients/auth-api-client';
import { NotesApiClient } from '../clients/notes-api-client';
import { MailhogClient } from '../clients/mailhog-client';
import { DbSeamClient } from '../clients/db-client';
import { env } from '../../config/env';
import { DEFAULT_PASSWORD, uniqueEmail } from '../utils/test-data';
import { registerConfirmedUser, type ConfirmedUser } from '../utils/register';
import { fetchOpenApi, type OpenApiDoc } from '../utils/schema';

/** A fully registered + confirmed user, ready to authenticate against the API. */
export type RegisteredUser = ConfirmedUser;

/** A user that has signed up but NOT confirmed (no token). */
export interface UnverifiedUser {
  email: string;
  password: string;
}

interface ApiFixtures {
  /** Unauthenticated auth client (signup/confirm/signin/me). */
  authApi: AuthApiClient;
  /** MailHog reader (own request context pointed at MAILHOG_URL). */
  mailhog: MailhogClient;
  /** Registers a new user via signup -> confirm and returns their token. */
  registeredUser: RegisteredUser;
  /** A second, independent confirmed user — for cross-user isolation tests. */
  secondUser: RegisteredUser;
  /** A signed-up-but-unconfirmed user — for unverified-sign-in / re-signup cases. */
  unverifiedUser: UnverifiedUser;
  /** Request context pre-authenticated as `registeredUser`. */
  authedRequest: APIRequestContext;
  /** Notes client authenticated as `registeredUser`. */
  notesApi: NotesApiClient;
  /** Notes client authenticated as `secondUser`. */
  secondUserNotesApi: NotesApiClient;
  /** Notes client with **no** Authorization header — for auth-required gates. */
  unauthedNotesApi: NotesApiClient;
}

interface ApiWorkerFixtures {
  /** The app's live OpenAPI doc, fetched once per worker (contract oracle). */
  openApi: OpenApiDoc;
  /**
   * Gray-box DB seam (docs/test-cases/api/advanced-gray-box.md), shared across
   * a worker's `@db`-tagged tests. Only connects when a test actually requests
   * it — non-`@db` tests never touch MySQL.
   */
  dbSeam: DbSeamClient;
}

const jsonHeaders = { Accept: 'application/json', 'Content-Type': 'application/json' } as const;

export const test = base.extend<ApiFixtures, ApiWorkerFixtures>({
  openApi: [
    async ({ playwright }, use) => {
      const context = await playwright.request.newContext({ baseURL: env.baseUrl });
      const doc = await fetchOpenApi(context);
      await context.dispose();
      await use(doc);
    },
    { scope: 'worker' },
  ],

  dbSeam: [
    async ({}, use) => {
      const client = new DbSeamClient();
      await use(client);
      await client.dispose();
    },
    { scope: 'worker' },
  ],

  authApi: async ({ request }, use) => {
    await use(new AuthApiClient(request));
  },

  mailhog: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({ baseURL: env.mailhogUrl });
    await use(new MailhogClient(context));
    await context.dispose();
  },

  registeredUser: async ({ authApi, mailhog }, use) => {
    await use(await registerConfirmedUser(authApi, mailhog, 'qa'));
  },

  secondUser: async ({ authApi, mailhog }, use) => {
    await use(await registerConfirmedUser(authApi, mailhog, 'qa2'));
  },

  unverifiedUser: async ({ authApi }, use) => {
    const email = uniqueEmail('unv');
    const res = await authApi.signup({ email, password: DEFAULT_PASSWORD });
    if (res.status() !== 201) {
      throw new Error(`Unverified-user setup failed for ${email}: ${res.status()}`);
    }
    await use({ email, password: DEFAULT_PASSWORD });
  },

  authedRequest: async ({ playwright, registeredUser }, use) => {
    const context = await playwright.request.newContext({
      baseURL: env.baseUrl,
      extraHTTPHeaders: { ...jsonHeaders, Authorization: `Bearer ${registeredUser.token}` },
    });
    await use(context);
    await context.dispose();
  },

  notesApi: async ({ authedRequest }, use) => {
    await use(new NotesApiClient(authedRequest));
  },

  secondUserNotesApi: async ({ playwright, secondUser }, use) => {
    const context = await playwright.request.newContext({
      baseURL: env.baseUrl,
      extraHTTPHeaders: { ...jsonHeaders, Authorization: `Bearer ${secondUser.token}` },
    });
    await use(new NotesApiClient(context));
    await context.dispose();
  },

  unauthedNotesApi: async ({ request }, use) => {
    // The `api` project's default context carries Accept/Content-Type but no
    // Authorization header, so this client exercises the auth-required gates.
    await use(new NotesApiClient(request));
  },
});

export { expect } from '@playwright/test';
