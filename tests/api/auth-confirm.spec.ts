import { test, expect } from '../fixtures/api.fixture';
import { errorOf, json } from '../utils/response';
import { DEFAULT_PASSWORD, uniqueEmail } from '../utils/test-data';
import { FAR_PAST_DATETIME } from '../utils/constants';
import type {ConfirmResponse, MeResponse, SigninResponse} from '../models/auth.model';

/**
 * POST /api/auth/confirm.
 *
 * NOTE: the implementation returns 201 for confirm; the OpenAPI doc annotates
 * 200 (documentation drift — see requirements-gap-analysis.md G7). The code is
 * the source of truth, so these assert 201.
 *
 * @smoke — API-CONFIRM-01 (happy path), API-CONFIRM-02 (verified -> sign-in), API-CONFIRM-09 (exact status/shape).
 * @regression — negatives + confirmation-lifecycle defects: API-CONFIRM-03…07, 10, 15, 16.
 *   (11 @security → A3, not yet automated.)
 * @db @gray-box — DB seam (docs/test-cases/api/advanced-gray-box.md): API-CONFIRM-08, 08b, 13, 14.
 *   Expiry states aren't reachable through the public API in reasonable time, so the DB seam
 *   arranges them; the confirm/sign-in call itself still goes through the real API.
 */
test.describe('API — Auth: confirm', () => {
  test(
    'API-CONFIRM-01: confirms with the emailed code (201 + token + message)',
    { tag: '@smoke' },
    async ({ authApi, mailhog }) => {
      const email = uniqueEmail();
      await authApi.signup({ email, password: DEFAULT_PASSWORD });
      const code = await mailhog.getConfirmationCode(email);

      const res = await authApi.confirm({ email, code });
      expect(res.status()).toBe(201);
      const body = await json<ConfirmResponse>(res);
      expect(body.message).toBe('Account confirmed.');
      expect(body.token.split('.')).toHaveLength(3); // structurally a JWT

      // Token is immediately usable on a protected endpoint.
      expect((await authApi.me(body.token)).status()).toBe(200);
    },
  );

  test(
    'API-CONFIRM-02: confirmation verifies the account so sign-in succeeds',
    { tag: '@smoke' },
    async ({ authApi, mailhog }) => {
      const email = uniqueEmail();
      await authApi.signup({ email, password: DEFAULT_PASSWORD });
      const code = await mailhog.getConfirmationCode(email);
      expect((await authApi.confirm({ email, code })).status()).toBe(201);

      const signin = await authApi.signin({ email, password: DEFAULT_PASSWORD });
      expect(signin.status()).toBe(200);

      const { token } = await json<SigninResponse>(signin);
      const me = await authApi.me(token);
      expect(await json<MeResponse>(me)).toMatchObject({ email: email });
    },
  );

  test(
    'API-CONFIRM-09: success is exactly 201 with keys {token, message}',
    { tag: '@smoke' },
    async ({ authApi, mailhog }) => {
      const email = uniqueEmail();
      await authApi.signup({ email, password: DEFAULT_PASSWORD });
      const code = await mailhog.getConfirmationCode(email);

      const res = await authApi.confirm({ email, code });
      expect(res.status()).toBe(201);
      expect(Object.keys(await json<ConfirmResponse>(res)).sort()).toEqual(['message', 'token']);
    },
  );

  test('API-CONFIRM-03: a wrong code is rejected', { tag: '@regression' }, async ({ authApi, mailhog }) => {
    const email = uniqueEmail();
    await authApi.signup({ email, password: DEFAULT_PASSWORD });
    await mailhog.getConfirmationCode(email); // ensure a real code exists
    const res = await authApi.confirm({ email, code: '000000' });
    expect(res.status()).toBe(400);
    expect(await errorOf(res)).toBe('Invalid or expired confirmation code.');
  });

  test('API-CONFIRM-04: a code is single-use', { tag: '@regression' }, async ({ authApi, mailhog }) => {
    const email = uniqueEmail();
    await authApi.signup({ email, password: DEFAULT_PASSWORD });
    const code = await mailhog.getConfirmationCode(email);

    expect((await authApi.confirm({ email, code })).status()).toBe(201);
    const reuse = await authApi.confirm({ email, code });
    expect(reuse.status()).toBe(400);
    expect(await errorOf(reuse)).toBe('Invalid or expired confirmation code.');
  });

  for (const code of ['12345', '1234567', '12a456', '']) {
    test(
      `API-CONFIRM-05: malformed code "${code}" is rejected on format`,
      { tag: '@regression' },
      async ({ authApi, unverifiedUser }) => {
        const res = await authApi.confirm({ email: unverifiedUser.email, code });
        expect(res.status()).toBe(400);
        expect(await errorOf(res)).toBe('Confirmation code must be exactly 6 digits.');
      },
    );
  }

  test('API-CONFIRM-06: an unknown email is rejected', { tag: '@regression' }, async ({ authApi }) => {
    const res = await authApi.confirm({ email: uniqueEmail('nobody'), code: '123456' });
    expect(res.status()).toBe(400);
    expect(await errorOf(res)).toBe('User not found.');
  });

  test(
    'API-CONFIRM-07: missing email or code is rejected',
    { tag: '@regression' },
    async ({ authApi, unverifiedUser }) => {
      const noEmail = await authApi.confirm({ code: '123456' } as never);
      expect(noEmail.status()).toBe(400);
      expect(await errorOf(noEmail)).toBe('Email is required.');

      const noCode = await authApi.confirm({ email: unverifiedUser.email } as never);
      expect(noCode.status()).toBe(400);
      expect(await errorOf(noCode)).toBe('Confirmation code must be exactly 6 digits.');
    },
  );

  test(
    'API-CONFIRM-10: a re-issued code confirms the account',
    { tag: '@regression' },
    async ({ authApi, mailhog }) => {
      const email = uniqueEmail();
      await authApi.signup({ email, password: DEFAULT_PASSWORD });
      await authApi.signup({ email, password: DEFAULT_PASSWORD }); // re-issue
      const [newest] = await mailhog.getConfirmationCodes(email, 2);

      expect((await authApi.confirm({ email, code: newest })).status()).toBe(201);
    },
  );

  // 🐞 Defect (verified)
  test(
    'API-CONFIRM-16: an older code still confirms after a newer one is issued (defect)',
    { tag: '@regression' },
    async ({ authApi, mailhog }) => {
      const email = uniqueEmail();
      await authApi.signup({ email, password: DEFAULT_PASSWORD }); // code A
      await authApi.signup({ email, password: DEFAULT_PASSWORD }); // code B
      const codes = await mailhog.getConfirmationCodes(email, 2);
      const older = codes[codes.length - 1]; // code A

      // Expected (correct): re-issue should invalidate prior codes → 400.
      expect((await authApi.confirm({ email, code: older })).status()).toBe(201);
    },
  );

  // 🐞 Defect (verified)
  test(
    'API-CONFIRM-15: an unused code mints a JWT on an already-verified account (defect)',
    { tag: '@regression' },
    async ({ authApi, mailhog }) => {
      const email = uniqueEmail();
      await authApi.signup({ email, password: DEFAULT_PASSWORD }); // code A
      await authApi.signup({ email, password: DEFAULT_PASSWORD }); // code B (both unused)
      const codes = await mailhog.getConfirmationCodes(email, 2);
      const [codeB, codeA] = codes;

      // Confirm with A -> account becomes verified, A is consumed.
      expect((await authApi.confirm({ email, code: codeA })).status()).toBe(201);

      // Defect: the still-unused code B re-confirms the verified account and mints a fresh JWT.
      const res = await authApi.confirm({ email, code: codeB });
      expect(res.status()).toBe(201); // Expected (correct): 400 "Account already confirmed."
      const body = await json<ConfirmResponse>(res);
      expect(body.token.split('.')).toHaveLength(3);
    },
  );

  test(
    'API-CONFIRM-08: a real, emailed code is rejected once aged out',
    { tag: '@db @gray-box' },
    async ({ authApi, mailhog, dbSeam }) => {
      const email = uniqueEmail();
      await authApi.signup({ email, password: DEFAULT_PASSWORD });
      const code = await mailhog.getConfirmationCode(email);

      await dbSeam.expireSignupCode(email); // age the real, emailed code to the far past

      const res = await authApi.confirm({ email, code });
      expect(res.status()).toBe(400);
      expect(await errorOf(res)).toBe('Invalid or expired confirmation code.');
    },
  );

  test(
    'API-CONFIRM-08b: an injected, already-expired code is rejected',
    { tag: '@db @gray-box' },
    async ({ authApi, dbSeam }) => {
      const code = '111111';
      const user = await dbSeam.insertUser({ verified: false });
      await dbSeam.insertSignupCode(user.id, code, { expiresAt: FAR_PAST_DATETIME });

      const res = await authApi.confirm({ email: user.email, code });
      expect(res.status()).toBe(400);
      expect(await errorOf(res)).toBe('Invalid or expired confirmation code.');

      await dbSeam.deleteUserByEmail(user.email);
    },
  );

  test(
    'API-CONFIRM-13: expiry boundary — valid just before expiry, invalid just after',
    { tag: '@db @gray-box' },
    async ({ authApi, dbSeam }) => {
      // A few-second margin rather than an exact tie: the confirm HTTP round-trip
      // takes non-zero time, so racing an exact "now" boundary would make the
      // "still valid" case flaky. Same rationale as waitToCrossSecondBoundary()
      // elsewhere in the suite — pick a side of the boundary deterministically.
      const MARGIN_MS = 5_000;
      const validCode = '111111';
      const expiredCode = '222222';

      const stillValid = await dbSeam.insertUser({ verified: false });
      await dbSeam.insertSignupCode(stillValid.id, validCode, {
        expiresAt: new Date(Date.now() + MARGIN_MS),
      });
      const validRes = await authApi.confirm({ email: stillValid.email, code: validCode });
      expect(validRes.status()).toBe(201);

      const alreadyExpired = await dbSeam.insertUser({ verified: false });
      await dbSeam.insertSignupCode(alreadyExpired.id, expiredCode, {
        expiresAt: new Date(Date.now() - MARGIN_MS),
      });
      const expiredRes = await authApi.confirm({ email: alreadyExpired.email, code: expiredCode });
      expect(expiredRes.status()).toBe(400);
      expect(await errorOf(expiredRes)).toBe('Invalid or expired confirmation code.');

      await dbSeam.deleteUserByEmail(stillValid.email);
      await dbSeam.deleteUserByEmail(alreadyExpired.email);
    },
  );

});
