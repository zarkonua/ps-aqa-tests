import {expect, test} from '../fixtures/api.fixture';
import {errorOf, json} from '../utils/response';
import {DEFAULT_PASSWORD, INVALID_EMAILS, emailOfLength, stringOfLength, uniqueEmail,} from '../utils/test-data';
import {env} from '../../config/env';
import type {MeResponse, SigninResponse, SignupResponse} from '../models/auth.model';

/**
 * POST /api/auth/signup.
 * @smoke — API-SIGNUP-01 (happy path), API-SIGNUP-02 (email+link), API-SIGNUP-13 (exact status/shape).
 * @regression — negatives, boundaries, defects: API-SIGNUP-03…17, 20. (18 @infra / 19 @concurrency live in A3.)
 */
test.describe('API — Auth: sign up', () => {
  test('API-SIGNUP-01: registers a brand-new user (201 + exact message)', { tag: '@smoke' }, async ({
    authApi,
  }) => {
    const res = await authApi.signup({ email: uniqueEmail(), password: DEFAULT_PASSWORD });

    expect(res.status()).toBe(201);
    expect(await res.json()).toEqual({ message: 'Confirmation code sent to email.' });
  });

  test(
    'API-SIGNUP-02: confirmation email is delivered with an app-hosted link',
    { tag: '@smoke' },
    async ({ authApi, mailhog }) => {
      const email = uniqueEmail();
      expect((await authApi.signup({ email, password: DEFAULT_PASSWORD })).status()).toBe(201);

      const link = await mailhog.getConfirmationLink(email);
      // Healthy mode points the link at the app host; broken mode points it at a
      // bogus host (oh-no-it-is-broken-mode.example.com) — caught here.
      expect(link).toContain(env.baseUrl);
      expect(link).toContain(`confirm_email=${email}`);
      expect(link).toMatch(/confirm_code=\d{6}/);
    },
  );

  test(
    'API-SIGNUP-13: success is exactly 201 with a single `message` key',
    { tag: '@smoke' },
    async ({ authApi }) => {
      const res = await authApi.signup({ email: uniqueEmail(), password: DEFAULT_PASSWORD });

      expect(res.status()).toBe(201);
      const body = await json<SignupResponse>(res);
      expect(Object.keys(body)).toEqual(['message']);
      expect(body.message).toBe('Confirmation code sent to email.');
    },
  );

  test(
    'API-SIGNUP-03: email is normalized (trim + lowercase) end-to-end',
    { tag: '@regression' },
    async ({ authApi, mailhog }) => {
      const base = uniqueEmail('mixed');
      const normalized = base.toLowerCase();
      const messy = `  ${base.toUpperCase()} `;

      expect((await authApi.signup({ email: messy, password: DEFAULT_PASSWORD })).status()).toBe(201);
      const code = await mailhog.getConfirmationCode(normalized);
      expect((await authApi.confirm({ email: normalized, code })).status()).toBe(201);

      // Account is usable via the normalized address: sign in, then confirm the
      // token actually resolves to this account, stored under the normalized email.
      const signin = await authApi.signin({ email: normalized, password: DEFAULT_PASSWORD });
      expect(signin.status()).toBe(200);
      const { token } = await json<SigninResponse>(signin);
      const me = await authApi.me(token);
      expect(await json<MeResponse>(me)).toMatchObject({ email: normalized });
    },
  );

  test('API-SIGNUP-04: duplicate verified user is rejected', { tag: '@regression' }, async ({
    authApi,
    registeredUser,
  }) => {
    const res = await authApi.signup({ email: registeredUser.email, password: DEFAULT_PASSWORD });
    expect(res.status()).toBe(400);
    expect(await errorOf(res)).toBe('User already exists.');
  });

  test(
    'API-SIGNUP-05: re-signup for an unverified user is allowed',
    { tag: '@regression' },
    async ({ authApi, unverifiedUser }) => {
      const res = await authApi.signup({ email: unverifiedUser.email, password: DEFAULT_PASSWORD });
      expect(res.status()).toBe(201);
    },
  );

  test('API-SIGNUP-06: missing email is rejected', { tag: '@regression' }, async ({ authApi }) => {
    const res = await authApi.signup({ password: DEFAULT_PASSWORD } as never);
    expect(res.status()).toBe(400);
    expect(await errorOf(res)).toBe('Email is required.');
  });

  test('API-SIGNUP-07: missing password is rejected', { tag: '@regression' }, async ({ authApi }) => {
    const res = await authApi.signup({ email: uniqueEmail() } as never);
    expect(res.status()).toBe(400);
    expect(await errorOf(res)).toBe('Password is required.');
  });

  for (const email of INVALID_EMAILS) {
    test(
      `API-SIGNUP-08: invalid email format is rejected — "${email}"`,
      { tag: '@regression' },
      async ({ authApi }) => {
        const res = await authApi.signup({ email, password: DEFAULT_PASSWORD });
        expect(res.status()).toBe(400);
        expect(await errorOf(res)).toBe('Invalid email format.');
      },
    );
  }

  test(
    'API-SIGNUP-09: password below the minimum (7 chars) is rejected',
    { tag: '@regression' },
    async ({ authApi }) => {
      const res = await authApi.signup({ email: uniqueEmail(), password: stringOfLength(7) });
      expect(res.status()).toBe(400);
      expect(await errorOf(res)).toBe('Password must be at least 8 characters.');
    },
  );

  test(
    'API-SIGNUP-10: password at the minimum (8 chars) is accepted',
    { tag: '@regression' },
    async ({ authApi }) => {
      const res = await authApi.signup({ email: uniqueEmail(), password: stringOfLength(8) });
      expect(res.status()).toBe(201);
    },
  );

  test(
    'API-SIGNUP-11a: password at the maximum (255 chars) is accepted',
    { tag: '@regression' },
    async ({ authApi }) => {
      const res = await authApi.signup({ email: uniqueEmail(), password: stringOfLength(255) });
      expect(res.status()).toBe(201);
    },
  );

  test(
    'API-SIGNUP-11b: password over the maximum (256 chars) is rejected',
    { tag: '@regression' },
    async ({ authApi }) => {
      const res = await authApi.signup({ email: uniqueEmail(), password: stringOfLength(256) });
      expect(res.status()).toBe(400);
      expect(await errorOf(res)).toBe('Password is too long.');
    },
  );

  // Email-format length boundaries (built via emailOfLength). Single-label
  // domain (no dots), so a valid email maxes out at 132 chars:
  // 64 local + '@' + 63 domain label + '.com'.
  test(
    'API-SIGNUP-12: email at the length limit (total 132, local 64, label 63) is accepted',
    { tag: '@regression' },
    async ({ authApi }) => {
      const res = await authApi.signup({
        email: emailOfLength(132, 62),
        password: DEFAULT_PASSWORD,
      });
      expect(res.status()).toBe(201);
    },
  );

  const invalidEmailLengthCases = [
    { title: 'local part over the limit (total 133, local 65)', total: 133, localLength: 62 },
    { title: 'domain label over the limit (total 80, label 64)', total: 80, localLength: 63 },
  ] as const;

  for (const c of invalidEmailLengthCases) {
    test(`API-SIGNUP-21: email rejected — ${c.title}`, { tag: '@regression' }, async ({ authApi }) => {
      const res = await authApi.signup({
        email: emailOfLength(c.total, c.localLength),
        password: DEFAULT_PASSWORD,
      });
      expect(res.status()).toBe(400);
      expect(await errorOf(res)).toBe('Invalid email format.');
    });
  }

  test(
    'API-SIGNUP-14: empty JSON body is rejected as missing email',
    { tag: '@regression' },
    async ({ authApi }) => {
      const res = await authApi.signup({} as never);
      expect(res.status()).toBe(400);
      expect(await errorOf(res)).toBe('Email is required.');
    },
  );

  test(
    'API-SIGNUP-16: malformed JSON body is rejected (no stack trace)',
    { tag: '@regression' },
    async ({ request }) => {
      // Buffer = raw bytes (a string `data` gets JSON-encoded by Playwright).
      const res = await request.post('/api/auth/signup', {
        headers: { 'Content-Type': 'application/json' },
        data: Buffer.from('{"email": '),
      });
      expect(res.status()).toBe(400);
      const error = await errorOf(res);
      expect(error).toBe('Invalid JSON payload.');
      // No stack trace / raw exception leaked.
      expect(error).not.toMatch(/exception|stack|#\d|\.php/i);
    },
  );

  for (const scalar of ['123', '"x"', 'true']) {
    test(
      `API-SIGNUP-17: non-object JSON (${scalar}) is rejected`,
      { tag: '@regression' },
      async ({ request }) => {
        const res = await request.post('/api/auth/signup', {
          headers: { 'Content-Type': 'application/json' },
          data: scalar,
        });
        expect(res.status()).toBe(400);
        expect(await errorOf(res)).toBe('JSON payload must be an object.');
      },
    );
  }
});
