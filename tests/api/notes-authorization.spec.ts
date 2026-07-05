import { test, expect } from '../fixtures/api.fixture';
import type { JwtError } from '../models/api-error.model';
import { type Note } from '../models/note.model';
import { json } from '../utils/response';
import { NONEXISTENT_UUID } from '../utils/constants';
import { noteInput } from '../utils/test-data';

/**
 * Notes authorization & ownership isolation.
 * @smoke — API-AUTHZ-01/02/03 (auth required), API-AUTHZ-04/05/06 (cross-user -> 404),
 *   API-AUTHZ-07 (owner-scoped list).
 * @regression — extended: API-AUTHZ-08…11.
 *
 * Cross-user access returns 404 (not 403) by design — the owner filter is
 * applied at the query layer, so another user's note is simply "not found"
 * (anti-enumeration). See requirements-gap-analysis.md G11.
 */
test.describe('API — Notes authorization', () => {
  test('API-AUTHZ-01: listing notes requires authentication (401)', { tag: '@smoke' }, async ({
    unauthedNotesApi,
  }) => {
    expect((await unauthedNotesApi.list()).status()).toBe(401);
  });

  test('API-AUTHZ-02: creating a note requires authentication (401)', { tag: '@smoke' }, async ({
    unauthedNotesApi,
  }) => {
    expect((await unauthedNotesApi.create(noteInput())).status()).toBe(401);
  });

  test(
    'API-AUTHZ-03: get/put/delete require authentication (401)',
    { tag: '@smoke' },
    async ({ notesApi, unauthedNotesApi }) => {
      const note = await json<Note>(await notesApi.create(noteInput()));

      expect((await unauthedNotesApi.getById(note.id)).status()).toBe(401);
      expect((await unauthedNotesApi.update(note.id, { title: 'x', content: 'y' })).status()).toBe(401);
      expect((await unauthedNotesApi.remove(note.id)).status()).toBe(401);
    },
  );

  test(
    'API-AUTHZ-04/05/06: another user cannot read/update/delete your note (404)',
    { tag: '@smoke' },
    async ({ notesApi, secondUserNotesApi }) => {
      const note = await json<Note>(await notesApi.create(noteInput()));

      expect((await secondUserNotesApi.getById(note.id)).status()).toBe(404);
      expect((await secondUserNotesApi.update(note.id, { title: 'x', content: 'y' })).status()).toBe(404);
      expect((await secondUserNotesApi.remove(note.id)).status()).toBe(404);
    },
  );

  test(
    'API-AUTHZ-07: the note list is scoped to its owner',
    { tag: '@smoke' },
    async ({ notesApi, secondUserNotesApi }) => {
      const mine = await json<Note>(await notesApi.create(noteInput()));

      const res = await secondUserNotesApi.list();
      expect(res.status()).toBe(200);
      const othersNotes = await json<Note[]>(res);
      expect(othersNotes.some((n) => n.id === mine.id)).toBe(false);
    },
  );

  test('API-AUTHZ-08: a non-existent note id returns 404', { tag: '@regression' }, async ({
    notesApi,
  }) => {
    expect((await notesApi.getById(NONEXISTENT_UUID)).status()).toBe(404);
  });

  test(
    'API-AUTHZ-09: an invalid token on notes returns 401 Invalid JWT Token',
    { tag: '@regression' },
    async ({ request }) => {
      const res = await request.get('/api/notes', {
        headers: { Authorization: 'Bearer not.a.valid.jwt' },
      });
      expect(res.status()).toBe(401);
      expect((await json<JwtError>(res)).message).toBe('Invalid JWT Token');
    },
  );

  test(
    'API-AUTHZ-10: search is scoped to the owner',
    { tag: '@regression' },
    async ({ notesApi, secondUserNotesApi }) => {
      const marker = `authz10${Date.now()}`;
      const mine = await json<Note>(await notesApi.create({ title: `A ${marker}`, content: 'x' }));
      await secondUserNotesApi.create({ title: `B ${marker}`, content: 'x' });

      const res = await notesApi.list({ q: marker });
      expect(res.status()).toBe(200);
      const results = await json<Note[]>(res);
      expect(results.map((n) => n.id)).toEqual([mine.id]); // only A's match, never B's
    },
  );

  test(
    'API-AUTHZ-11: a malformed note id is handled without a server error',
    { tag: '@regression' },
    async ({ notesApi }) => {
      const res = await notesApi.getById('not-a-uuid');
      expect([400, 404]).toContain(res.status());
      expect(res.status()).toBeLessThan(500); // no stack trace / server error
    },
  );
});
