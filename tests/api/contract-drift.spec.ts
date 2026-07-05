import { test, expect } from '../fixtures/api.fixture';
import { documentedSuccessStatus } from '../utils/schema';

/**
 * A2 regression — OpenAPI spec-drift findings (documentation vs reality).
 * Cases API-DRIFT-01…04. Each asserts what the spec **should** say/do; each
 * currently **fails**, so they are marked `test.fail()` (xfail) — they report
 * drift as a known defect without gating the healthy suite red. When the docs
 * are fixed, the "unexpected pass" flags the case for removal.
 */
test.describe('API — Contract drift', () => {
  test(
    'API-DRIFT-01: confirm success status is documented as it actually is (201)',
    { tag: '@regression' },
    async ({ openApi }) => {
      test.fail(); // documented 200, actual 201
      expect(documentedSuccessStatus(openApi, '/api/auth/confirm', 'post')).toBe('201');
    },
  );

  test(
    'API-DRIFT-02: GET /api/notes documents its real unauthorized status (401)',
    { tag: '@regression' },
    async ({ openApi }) => {
      test.fail(); // documents 403 only; actual is 401 (JWT Token not found)
      const statuses = Object.keys(openApi.paths['/api/notes']?.get?.responses ?? {});
      expect(statuses).toContain('401');
    },
  );

  test(
    'API-DRIFT-03: GET /api/notes/{id} documents its real missing-token status (401)',
    { tag: '@regression' },
    async ({ openApi }) => {
      test.fail(); // documents 403/404; missing-token 401 is undocumented
      const statuses = Object.keys(openApi.paths['/api/notes/{id}']?.get?.responses ?? {});
      expect(statuses).toContain('401');
    },
  );

  test(
    'API-DRIFT-04: application/ld+json is served, not errored',
    { tag: '@regression' },
    async ({ request, registeredUser }) => {
      test.fail(); // only application/json works; ld+json does not succeed
      const res = await request.get('/api/notes', {
        headers: { Accept: 'application/ld+json', Authorization: `Bearer ${registeredUser.token}` },
      });
      expect(res.status()).toBeLessThan(400);
    },
  );
});
