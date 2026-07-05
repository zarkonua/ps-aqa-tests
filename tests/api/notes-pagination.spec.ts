import { test, expect } from '../fixtures/api.fixture';
import { json } from '../utils/response';
import { type Note } from '../models/note.model';
import { noteInput } from '../utils/test-data';
import { listNotes, seedNotes } from '../utils/notes';

/**
 * Pagination (`GET /api/notes`).
 * @regression — small, deterministic fixtures: API-PAGE-01, 02, 04…09.
 * @db @gray-box — DB seam (docs/test-cases/api/advanced-gray-box.md /
 *   notes-pagination.md#large-dataset): API-PAGE-03, API-SEED-01, API-SCALE-01/02/06/07.
 *   Bulk-seeded via the DB (ms, not dozens of sequential POSTs — see the doc's
 *   seeding-speed comparison).
 */
test.describe('API — Notes pagination', () => {
  test('API-PAGE-01: itemsPerPage caps the page length', { tag: '@regression' }, async ({ notesApi }) => {
    await seedNotes(notesApi, 5);
    expect((await listNotes(notesApi, { itemsPerPage: '2' })).length).toBeLessThanOrEqual(2);
  });

  test('API-PAGE-02: consecutive pages do not overlap', { tag: '@regression' }, async ({ notesApi }) => {
    await seedNotes(notesApi, 5);
    const page1 = (await listNotes(notesApi, { itemsPerPage: '2', page: '1' })).map((n) => n.id);
    const page2 = (await listNotes(notesApi, { itemsPerPage: '2', page: '2' })).map((n) => n.id);
    expect(page1).toHaveLength(2);
    expect(page1.filter((id) => page2.includes(id))).toEqual([]);
  });

  test(
    'API-PAGE-04: a page beyond the last returns an empty array',
    { tag: '@regression' },
    async ({ notesApi }) => {
      await seedNotes(notesApi, 3);
      expect(await listNotes(notesApi, { page: '9999' })).toEqual([]);
    },
  );

  test(
    'API-PAGE-05: the default page returns all notes when under the default size',
    { tag: '@regression' },
    async ({ notesApi }) => {
      const seeded = await seedNotes(notesApi, 3);
      const noteIds = (await listNotes(notesApi)).map((n) => n.id);
      expect(noteIds.length).toBeLessThanOrEqual(30);
      for (const seededNote of seeded) expect(noteIds).toContain(seededNote.id);
    },
  );

  test(
    'API-PAGE-06: itemsPerPage=1 returns exactly one item per page',
    { tag: '@regression' },
    async ({ notesApi }) => {
      await seedNotes(notesApi, 2);
      expect(await listNotes(notesApi, { itemsPerPage: '1' })).toHaveLength(1);
    },
  );

  test(
    'API-PAGE-07: invalid page/itemsPerPage values are handled gracefully (no 500)',
    { tag: '@regression' },
    async ({ notesApi }) => {
      await seedNotes(notesApi, 2);
      const invalid: Record<string, string>[] = [{ page: '-1', itemsPerPage: '0' }, { itemsPerPage: 'abc' }];
      for (const params of invalid) {
        const res = await notesApi.list(params);
        expect(res.status()).toBeLessThan(500);
      }
    },
  );

  test(
    'API-PAGE-08: pagination is scoped to the owner',
    { tag: '@regression' },
    async ({ notesApi, secondUserNotesApi }) => {
      const theirs = await json<Note>(await secondUserNotesApi.create(noteInput()));
      const mine = await seedNotes(notesApi, 3);

      const ids = (await listNotes(notesApi, { itemsPerPage: '50' })).map((n) => n.id);
      for (const note of mine) expect(ids).toContain(note.id);
      expect(ids).not.toContain(theirs.id);
    },
  );

  test(
    'API-PAGE-09: full traversal covers all notes with no duplicates',
    { tag: '@regression' },
    async ({ notesApi }) => {
      const seeded = await seedNotes(notesApi, 5);
      const seen = new Set<string>();
      for (let page = 1; page <= 6; page++) {
        const ids = (await listNotes(notesApi, { itemsPerPage: '2', page: String(page) })).map(
          (n) => n.id,
        );
        if (ids.length === 0) break;
        for (const id of ids) {
          expect(seen.has(id), `duplicate id across pages: ${id}`).toBe(false);
          seen.add(id);
        }
      }
      for (const note of seeded) expect(seen.has(note.id)).toBe(true);
    },
  );

  test(
    'API-PAGE-03: itemsPerPage is capped at 50 even when 100 is requested (bulk-seeded notes visible)',
    { tag: '@db @gray-box' },
    async ({ notesApi, registeredUser, dbSeam }) => {
      await dbSeam.insertNotes(registeredUser.id, 51);
      // Exactly 50 (not 51, not 100) proves both the page-size cap AND that the
      // DB-seeded notes are visible through the real API (>=50 returned).
      expect(await listNotes(notesApi, { itemsPerPage: '100' })).toHaveLength(50);
    },
  );

  test(
    'API-SCALE-01: the default page is capped at 30, not the full owned set',
    { tag: '@db @gray-box' },
    async ({ notesApi, registeredUser, dbSeam }) => {
      await dbSeam.insertNotes(registeredUser.id, 40);
      expect(await listNotes(notesApi)).toHaveLength(30);
    },
  );

  test(
    'API-SCALE-02: full traversal reconstructs all 55 notes — no overlap, none missing',
    { tag: '@db @gray-box' },
    async ({ notesApi, registeredUser, dbSeam }) => {
      const seeded = await dbSeam.insertNotes(registeredUser.id, 55);
      const page1 = await listNotes(notesApi, { itemsPerPage: '50', page: '1' });
      const page2 = await listNotes(notesApi, { itemsPerPage: '50', page: '2' });
      expect(page1).toHaveLength(50);
      expect(page2).toHaveLength(5);

      const ids = new Set([...page1, ...page2].map((n) => n.id));
      expect(ids.size).toBe(55);
      for (const note of seeded) expect(ids.has(note.id)).toBe(true);
    },
  );

  test(
    'API-SCALE-07: no total/count is exposed even at 31+ notes (documented limitation)',
    { tag: '@db @gray-box' },
    async ({ notesApi, registeredUser, dbSeam }) => {
      await dbSeam.insertNotes(registeredUser.id, 31);
      const res = await notesApi.list();
      expect(res.status()).toBe(200);
      expect(Array.isArray(await res.json())).toBe(true); // bare array — no {total,count,next}; see G6
    },
  );
});
