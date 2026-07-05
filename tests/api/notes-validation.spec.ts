import { test, expect } from '../fixtures/api.fixture';
import { type Note } from '../models/note.model';
import { noteInput, stringOfLength } from '../utils/test-data';
import { json, messagesFor, problemOf } from '../utils/response';

/**
 * Notes field validation (`422 application/problem+json`).
 * @regression — API-VAL-01…15.
 */
test.describe('API — Notes validation', () => {
  test('API-VAL-01: empty title is rejected', { tag: '@regression' }, async ({ notesApi }) => {
    const res = await notesApi.create({ title: '', content: 'x' });
    expect(res.status()).toBe(422);
    expect(messagesFor(await problemOf(res), 'title')).toContain('Title is required.');
  });

  test('API-VAL-02: missing title is rejected', { tag: '@regression' }, async ({ notesApi }) => {
    const res = await notesApi.create({ content: 'x' } as never);
    expect(res.status()).toBe(422);
    expect((await problemOf(res)).violations.some((v) => v.propertyPath === 'title')).toBe(true);
  });

  test('API-VAL-03: empty content is rejected', { tag: '@regression' }, async ({ notesApi }) => {
    const res = await notesApi.create({ title: 'ok', content: '' });
    expect(res.status()).toBe(422);
    expect(messagesFor(await problemOf(res), 'content')).toContain('Content is required.');
  });

  test('API-VAL-04: missing content is rejected', { tag: '@regression' }, async ({ notesApi }) => {
    const res = await notesApi.create({ title: 'ok' } as never);
    expect(res.status()).toBe(422);
    expect((await problemOf(res)).violations.some((v) => v.propertyPath === 'content')).toBe(true);
  });

  test(
    'API-VAL-05: title min (1) and max (255) are accepted',
    { tag: '@regression' },
    async ({ notesApi }) => {
      expect((await notesApi.create({ title: 'a', content: 'x' })).status()).toBe(201);
      expect((await notesApi.create({ title: stringOfLength(255), content: 'x' })).status()).toBe(201);
    },
  );

  test('API-VAL-06: title over 255 is rejected', { tag: '@regression' }, async ({ notesApi }) => {
    const res = await notesApi.create({ title: stringOfLength(256), content: 'x' });
    expect(res.status()).toBe(422);
    expect(messagesFor(await problemOf(res), 'title')).toContain(
      'Title cannot be longer than 255 characters.',
    );
  });

  test(
    'API-VAL-07: content min (1) and max (10000) are accepted',
    { tag: '@regression' },
    async ({ notesApi }) => {
      expect((await notesApi.create({ title: 'ok', content: 'x' })).status()).toBe(201);
      expect((await notesApi.create({ title: 'ok', content: stringOfLength(10000) })).status()).toBe(201);
    },
  );

  test('API-VAL-08: content over 10000 is rejected', { tag: '@regression' }, async ({ notesApi }) => {
    const res = await notesApi.create({ title: 'ok', content: stringOfLength(10001) });
    expect(res.status()).toBe(422);
    expect(messagesFor(await problemOf(res), 'content')).toContain(
      'Content cannot be longer than 10000 characters.',
    );
  });

  test(
    'API-VAL-09: whitespace-only title is rejected (trimmed to empty)',
    { tag: '@regression' },
    async ({ notesApi }) => {
      const res = await notesApi.create({ title: '   ', content: 'x' });
      expect(res.status()).toBe(422);
      expect((await problemOf(res)).violations.some((v) => v.propertyPath === 'title')).toBe(true);
    },
  );

  test(
    'API-VAL-10: the error envelope is problem+json with the expected shape',
    { tag: '@regression' },
    async ({ notesApi }) => {
      const res = await notesApi.create({ title: '', content: '' });
      expect(res.status()).toBe(422);
      expect(res.headers()['content-type']).toContain('application/problem+json');
      const p = await problemOf(res);
      expect(p.status).toBe(422);
      expect(p.title).toBe('An error occurred');
      expect(Array.isArray(p.violations)).toBe(true);
      expect(p.violations[0]).toHaveProperty('propertyPath');
      expect(p.violations[0]).toHaveProperty('message');
    },
  );

  test('API-VAL-11: validation also applies on update', { tag: '@regression' }, async ({ notesApi }) => {
    const created = await json<Note>(await notesApi.create(noteInput()));
    const res = await notesApi.update(created.id, { title: '', content: '' });
    expect(res.status()).toBe(422);
  });

  test('API-VAL-12: title is trimmed before storing', { tag: '@regression' }, async ({ notesApi }) => {
    const res = await notesApi.create({ title: '  Hi  ', content: 'x' });
    expect(res.status()).toBe(201);
    expect((await json<Note>(res)).title).toBe('Hi');
  });

  test(
    'API-VAL-13: wrong field types are rejected (no 500)',
    { tag: '@regression' },
    async ({ notesApi }) => {
      const res = await notesApi.create({ title: 123, content: true } as never);
      expect(res.status()).toBeGreaterThanOrEqual(400);
      expect(res.status()).toBeLessThan(500);
    },
  );

  test(
    'API-VAL-14: script/HTML in fields is accepted and stored verbatim',
    { tag: '@regression' },
    async ({ notesApi }) => {
      const title = '<script>alert(1)</script>';
      const res = await notesApi.create({ title, content: 'x' });
      expect(res.status()).toBe(201);
      // Stored verbatim — escaping is the browser/UI concern (UI-NOTE-08).
      expect((await json<Note>(res)).title).toBe(title);
    },
  );

  // 🐞 Defect (documented)
  test(
    'API-VAL-15: whitespace-only content is accepted (trim asymmetry)',
    { tag: '@regression' },
    async ({ notesApi }) => {
      const res = await notesApi.create({ title: 'ok', content: '   ' });
      expect(res.status()).toBe(201);
      expect((await json<Note>(res)).content).toBe('   ');
    },
  );
});
