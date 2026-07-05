import { test, expect } from '../fixtures/api.fixture';
import { json } from '../utils/response';
import { type Note } from '../models/note.model';
import { noteInput } from '../utils/test-data';
import { expectMatchesSchema, schemaFor } from '../utils/schema';

/**
 * A2 regression — contract/schema validation against the **live** OpenAPI spec.
 * Cases API-CONTRACT-01…07 (the schema oracle from contract-schema.md), applied
 * as real assertions here rather than only inline in the functional specs.
 */
test.describe('API — Contract / schema', () => {
  test(
    'API-CONTRACT-01/07: created note conforms to Note-note.read (strict + formats)',
    { tag: '@regression' },
    async ({ notesApi, openApi }) => {
      const res = await notesApi.create(noteInput());
      expect(res.status()).toBe(201);
      const note = await json<Note>(res);
      expectMatchesSchema(note, schemaFor(openApi, '/api/notes', 'post', '201'), openApi, {
        strict: true,
      });
    },
  );

  test(
    'API-CONTRACT-02: read note conforms to Note-note.read (strict)',
    { tag: '@regression' },
    async ({ notesApi, openApi }) => {
      const created = await json<Note>(await notesApi.create(noteInput()));
      const res = await notesApi.getById(created.id);
      expect(res.status()).toBe(200);
      const read = await json<Note>(res);
      expectMatchesSchema(read, schemaFor(openApi, '/api/notes/{id}', 'get', '200'), openApi, {
        strict: true,
      });
    },
  );

  test(
    'API-CONTRACT-03: every list item conforms to Note-note.read',
    { tag: '@regression' },
    async ({ notesApi, openApi }) => {
      await notesApi.create(noteInput());
      const list = await notesApi.list();
      expect(list.status()).toBe(200);
      expectMatchesSchema(await list.json(), schemaFor(openApi, '/api/notes', 'get', '200'), openApi);
    },
  );

  test(
    'API-CONTRACT-04: updated note conforms to Note-note.read (strict)',
    { tag: '@regression' },
    async ({ notesApi, openApi }) => {
      const created = await json<Note>(await notesApi.create(noteInput()));
      const res = await notesApi.update(created.id, { title: 'Updated', content: 'Updated body' });
      expect(res.status()).toBe(200);
      const updated = await json<Note>(res);
      expectMatchesSchema(updated, schemaFor(openApi, '/api/notes/{id}', 'put', '200'), openApi, {
        strict: true,
      });
    },
  );

  test(
    'API-CONTRACT-05: the 422 error envelope conforms to its schema',
    { tag: '@regression' },
    async ({ notesApi, openApi }) => {
      const res = await notesApi.create({ title: '', content: '' });
      expect(res.status()).toBe(422);
      expectMatchesSchema(await res.json(), schemaFor(openApi, '/api/notes', 'post', '422'), openApi);
    },
  );

  test(
    'API-CONTRACT-06: /me conforms strictly to inline {id,email}',
    { tag: '@regression' },
    async ({ authApi, registeredUser, openApi }) => {
      const res = await authApi.me(registeredUser.token);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expectMatchesSchema(body, schemaFor(openApi, '/api/auth/me', 'get', '200'), openApi, {
        strict: true,
      });
    },
  );
});
