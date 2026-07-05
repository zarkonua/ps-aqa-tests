import { test, expect } from '../fixtures/api.fixture';
import { json } from '../utils/response';
import type { JwtError } from '../models/api-error.model';
import type { MeResponse, SigninResponse } from '../models/auth.model';
import { DEFAULT_PASSWORD, uniqueEmail } from '../utils/test-data';

/**
 * POST /api/auth/signin (lexik json_login).
 * @smoke — API-SIGNIN-01 (happy path), API-SIGNIN-02 (wrong password), API-SIGNIN-08 (exact {token}).
 * @regression — API-SIGNIN-03…07, 09. (10 @security → A3.)
 */
test.describe('API — Auth: sign in', () => {
  test('API-SIGNIN-01: signs in with valid credentials (200 + token)', { tag: '@smoke' }, async ({
    authApi,
    registeredUser,
  }) => {
    const res = await authApi.signin({
      email: registeredUser.email,
      password: registeredUser.password,
    });

    expect(res.status()).toBe(200);
    expect((await json<SigninResponse>(res)).token).toBeTruthy();
  });

  test('API-SIGNIN-02: rejects a wrong password with 401 Invalid credentials.', { tag: '@smoke' }, async ({
    authApi,
    registeredUser,
  }) => {
    const res = await authApi.signin({ email: registeredUser.email, password: 'WrongPassword9!' });

    expect(res.status()).toBe(401);
    expect((await json<JwtError>(res)).message).toBe('Invalid credentials.');
  });

  test('API-SIGNIN-08: success body is exactly { token }', { tag: '@smoke' }, async ({
    authApi,
    registeredUser,
  }) => {
    const res = await authApi.signin({
      email: registeredUser.email,
      password: registeredUser.password,
    });

    expect(res.status()).toBe(200);
    expect(Object.keys(await json<SigninResponse>(res))).toEqual(['token']);
  });

  test('API-SIGNIN-03: an unverified user cannot sign in', { tag: '@regression' }, async ({
    authApi,
    unverifiedUser,
  }) => {
    const res = await authApi.signin({ email: unverifiedUser.email, password: unverifiedUser.password });
    expect(res.status()).toBe(401);
    expect((await json<JwtError>(res)).message).toBe('Email is not confirmed.');
  });

  test(
    'API-SIGNIN-04: an unknown user gets the same message as wrong password (no enumeration)',
    { tag: '@regression' },
    async ({ authApi }) => {
      const res = await authApi.signin({ email: uniqueEmail('ghost'), password: DEFAULT_PASSWORD });
      expect(res.status()).toBe(401);
      expect((await json<JwtError>(res)).message).toBe('Invalid credentials.');
    },
  );

  test('API-SIGNIN-05: missing credentials are rejected without a token', { tag: '@regression' }, async ({
    authApi,
  }) => {
    for (const body of [{}, { email: uniqueEmail() }, { password: DEFAULT_PASSWORD }]) {
      const res = await authApi.signin(body as never);
      expect([400, 401], JSON.stringify(body)).toContain(res.status());
      expect(await json<Record<string, unknown>>(res), JSON.stringify(body)).not.toHaveProperty('token');
    }
  });

  test('API-SIGNIN-06: the returned token is usable on /me', { tag: '@regression' }, async ({
    authApi,
    registeredUser,
  }) => {
    const signin = await authApi.signin({
      email: registeredUser.email,
      password: registeredUser.password,
    });
    const { token } = await json<SigninResponse>(signin);

    const me = await authApi.me(token);
    expect(me.status()).toBe(200);
    const profile = await json<MeResponse>(me);
    expect(profile).toEqual({ id: registeredUser.id, email: registeredUser.email });
  });

  test('API-SIGNIN-07: email is matched case-insensitively', { tag: '@regression' }, async ({
    authApi,
    registeredUser,
  }) => {
    const res = await authApi.signin({
      email: registeredUser.email.toUpperCase(),
      password: registeredUser.password,
    });
    expect(res.status()).toBe(200);
    expect((await json<SigninResponse>(res)).token).toBeTruthy();
  });

  test(
    'API-SIGNIN-09: a form-encoded body is rejected without a token',
    { tag: '@regression' },
    async ({ request, registeredUser }) => {
      // Force the content-type explicitly so the result is deterministic
      // regardless of which project's ambient `extraHTTPHeaders` runs this spec
      // (the `api` project sets a JSON default; `smoke`/`regression` don't).
      const res = await request.post('/api/auth/signin', {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        form: { email: registeredUser.email, password: registeredUser.password },
      });
      expect(res.ok()).toBe(false);
      // json_login only recognizes application/json; a genuinely form-encoded
      // body isn't matched by the login firewall at all and falls through to
      // routing, where this path has no other controller → 404 (not 400/401).
      expect([400, 401, 404]).toContain(res.status());
      if (res.headers()['content-type']?.includes('json')) {
        expect((await json<Record<string, unknown>>(res))).not.toHaveProperty('token');
      }
    },
  );
});
