import { test, expect } from '../fixtures/api.fixture';
import { faker } from '@faker-js/faker';
import { createNote, listNotes } from '../utils/notes';

/** Unique marker so search results never collide with other tests' data. */
const marker = () => `tok${faker.string.alphanumeric(10).toLowerCase()}`;

/**
 * Search, filter & sort (`GET /api/notes`).
 * @regression — API-SEARCH-01…15.
 */
test.describe('API — Notes search / sort', () => {
  test('API-SEARCH-01: q matches the title', { tag: '@regression' }, async ({ notesApi }) => {
    const tkn = marker();
    const note = await createNote(notesApi, `Alpha ${tkn}`, 'body');
    expect((await listNotes(notesApi, { q: tkn })).map((n) => n.id)).toContain(note.id);
  });

  test('API-SEARCH-02: q matches the content', { tag: '@regression' }, async ({ notesApi }) => {
    const tkn = marker();
    const note = await createNote(notesApi, 'Plain title', `body has ${tkn} inside`);
    expect((await listNotes(notesApi, { q: tkn })).map((n) => n.id)).toContain(note.id);
  });

  test(
    'API-SEARCH-03: q does a partial (substring) match',
    { tag: '@regression' },
    async ({ notesApi }) => {
      const note = await createNote(notesApi, `Meeting notes ${marker()}`, 'body');
      expect((await listNotes(notesApi, { q: 'eeti' })).map((n) => n.id)).toContain(note.id);
    },
  );

  test(
    'API-SEARCH-04/05: title/content filters target only their field',
    { tag: '@regression' },
    async ({ notesApi }) => {
      const tkn = marker();
      const inTitle = await createNote(notesApi, `has ${tkn}`, 'plain body');
      const inContent = await createNote(notesApi, 'plain title', `has ${tkn}`);

      const byTitle = (await listNotes(notesApi, { title: tkn })).map((n) => n.id);
      expect(byTitle).toContain(inTitle.id);
      expect(byTitle).not.toContain(inContent.id);

      const byContent = (await listNotes(notesApi, { content: tkn })).map((n) => n.id);
      expect(byContent).toContain(inContent.id);
      expect(byContent).not.toContain(inTitle.id);
    },
  );

  test(
    'API-SEARCH-06: search is scoped to the owner',
    { tag: '@regression' },
    async ({ notesApi, secondUserNotesApi }) => {
      const tkn = marker();
      const mine = await createNote(notesApi, `mine ${tkn}`, 'x');
      await createNote(secondUserNotesApi, `theirs ${tkn}`, 'x');
      expect((await listNotes(notesApi, { q: tkn })).map((n) => n.id)).toEqual([mine.id]);
    },
  );

  test(
    'API-SEARCH-07: a term matching nothing returns an empty array',
    { tag: '@regression' },
    async ({ notesApi }) => {
      await createNote(notesApi, 'something', 'body');
      expect(await listNotes(notesApi, { q: marker() })).toEqual([]);
    },
  );

  test(
    'API-SEARCH-08/09: sort by title ascending and descending',
    { tag: '@regression' },
    async ({ notesApi }) => {
      const titles: string[] = ['Apple', 'Cherry', 'Banana'];
        for (const title of titles) {
            await createNote(notesApi, title, 'x');
        }

      const asc = (await listNotes(notesApi, { 'sort[title]': 'asc' })).map((n) => n.title);
      expect(asc).toEqual(titles.sort());
      const desc = (await listNotes(notesApi, { 'sort[title]': 'desc' })).map((n) => n.title);
      expect(desc).toEqual(titles.sort().reverse());
    },
  );

  test(
    'API-SEARCH-10: sort by updatedAt is correctly ordered',
    { tag: '@regression' },
    async ({ notesApi }) => {
      await createNote(notesApi, 'n1', 'x');
      await createNote(notesApi, 'n2', 'x');
      await createNote(notesApi, 'n3', 'x');

      const times = (await listNotes(notesApi, { 'sort[updatedAt]': 'desc' })).map((n) =>
        Date.parse(n.updated_at),
      );
      expect(times).toEqual([...times].sort((a, b) => b - a));
    },
  );

  test(
    'API-SEARCH-11: search + sort combine (matches only, sorted)',
    { tag: '@regression' },
    async ({ notesApi }) => {
      const tkn = marker();
      await createNote(notesApi, `Banana ${tkn}`, 'x');
      await createNote(notesApi, `Apple ${tkn}`, 'x');
      await createNote(notesApi, 'Unrelated', 'x');

      const titles = (await listNotes(notesApi, { q: tkn, 'sort[title]': 'asc' })).map((n) => n.title);
      expect(titles).toEqual([`Apple ${tkn}`, `Banana ${tkn}`]);
    },
  );

  test(
    'API-SEARCH-12: an empty q returns all owned notes',
    { tag: '@regression' },
    async ({ notesApi }) => {
      const a = await createNote(notesApi, 'first', 'x');
      const b = await createNote(notesApi, 'second', 'x');
      const ids = (await listNotes(notesApi, { q: '' })).map((n) => n.id);
      expect(ids).toContain(a.id);
      expect(ids).toContain(b.id);
    },
  );

  test('API-SEARCH-13: search is case-insensitive', { tag: '@regression' }, async ({ notesApi }) => {
    const tkn = marker();
    const note = await createNote(notesApi, `Alpha ${tkn.toUpperCase()}`, 'x');
    expect((await listNotes(notesApi, { q: tkn.toLowerCase() })).map((n) => n.id)).toContain(note.id);
  });

  test(
    'API-SEARCH-14: special characters in q are handled literally, no error',
    { tag: '@regression' },
    async ({ notesApi }) => {
      const res = await notesApi.list({ q: "%25_'" });
      expect(res.status()).toBe(200);
      expect(Array.isArray(await res.json())).toBe(true);
    },
  );

  test(
    'API-SEARCH-15: an unknown sort direction is handled gracefully (no 500)',
    { tag: '@regression' },
    async ({ notesApi }) => {
      const res = await notesApi.list({ 'sort[title]': 'sideways' });
      expect(res.status()).toBeLessThan(500);
    },
  );
});
