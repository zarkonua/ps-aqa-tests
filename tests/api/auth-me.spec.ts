import { test, expect } from '../fixtures/api.fixture';
import { json } from '../utils/response';
import type { JwtError } from '../models/api-error.model';
import type { MeResponse } from '../models/auth.model';

/**
 * GET /api/auth/me.
 * @smoke — API-ME-01 (happy path + strict {id,email} shape, covers API-ME-06), API-ME-02 (no token -> 401).
 * @regression — negatives + session defect: API-ME-03, 04, 08, 09. (05 expired / 07 deleted-user → A3/manual.)
 */
test.describe('API — Auth: profile /me', () => {
  test(
    'API-ME-01: returns the authenticated user profile (exact {id, email} — covers API-ME-06)',
    { tag: '@smoke' },
    async ({ authApi, registeredUser }) => {
      const res = await authApi.me(registeredUser.token);

      expect(res.status()).toBe(200);
      // toEqual is an exact match: also enforces the strict {id,email} shape
      // (no extra/renamed keys — the broken-mode catcher, formerly API-ME-06).
      expect(await res.json()).toEqual({ id: registeredUser.id, email: registeredUser.email });
    },
  );

  test('API-ME-02: rejects a missing Authorization header with 401', { tag: '@smoke' }, async ({
    authApi,
  }) => {
    const res = await authApi.me();

    expect(res.status()).toBe(401);
  });

  test('API-ME-03: a malformed token is rejected', { tag: '@regression' }, async ({ authApi }) => {
    const res = await authApi.me('not.a.jwt');
    expect(res.status()).toBe(401);
    expect((await json<JwtError>(res)).message).toBe('Invalid JWT Token');
  });

  test('API-ME-04: a non-Bearer auth scheme is rejected', { tag: '@regression' }, async ({ request }) => {
    const res = await request.get('/api/auth/me', {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    expect(res.status()).toBe(401);
  });

  test('API-ME-08: an empty Bearer value is rejected', { tag: '@regression' }, async ({ request }) => {
    const res = await request.get('/api/auth/me', { headers: { Authorization: 'Bearer ' } });
    expect(res.status()).toBe(401);
  });

  // 🐞 Defect (verified)
  test(
    'API-ME-09: a token still works after (client-side) logout — no revocation (defect)',
    { tag: '@regression' },
    async ({ authApi, registeredUser }) => {
      // "Logout" in this app only clears the client's localStorage; there is no
      // server-side revocation, so the captured token stays valid until its TTL.
      const res = await authApi.me(registeredUser.token);
      expect(res.status()).toBe(200); // Expected (correct): a revoked token → 401.
      expect(await json<MeResponse>(res)).toEqual({
        id: registeredUser.id,
        email: registeredUser.email,
      });
    },
  );
});
