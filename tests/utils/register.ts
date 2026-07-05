import type { AuthApiClient } from '../clients/auth-api-client';
import type { MailhogClient } from '../clients/mailhog-client';
import type { ConfirmResponse, MeResponse } from '../models/auth.model';
import { DEFAULT_PASSWORD, uniqueEmail } from './test-data';

/** A user that has completed signup -> confirm and holds a live JWT. */
export interface ConfirmedUser {
  id: string;
  email: string;
  password: string;
  token: string;
}

/**
 * Register + confirm a brand-new user through the real API + MailHog flow and
 * return their identity and token. Shared by the `registeredUser`/`secondUser`
 * (API) and `seededUser` (E2E) fixtures so the setup logic lives in one place.
 *
 * `prefix` keeps parallel users visually distinct in MailHog / logs; the email
 * is unique regardless (timestamp + random suffix).
 */
export async function registerConfirmedUser(
  authApi: AuthApiClient,
  mailhog: MailhogClient,
  prefix = 'qa',
  email: string = uniqueEmail(prefix),
): Promise<ConfirmedUser> {
  const password = DEFAULT_PASSWORD;

  const signup = await authApi.signup({ email, password });
  if (signup.status() !== 201) {
    throw new Error(`Sign-up setup failed for ${email}: ${signup.status()}`);
  }

  const code = await mailhog.getConfirmationCode(email);
  const confirm = await authApi.confirm({ email, code });
  const { token } = (await confirm.json()) as ConfirmResponse;

  const me = (await (await authApi.me(token)).json()) as MeResponse;

  return { id: me.id, email, password, token };
}
