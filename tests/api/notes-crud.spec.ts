import { test, expect } from '../fixtures/api.fixture';
import { json } from '../utils/response';
import { NOTE_KEYS, type Note } from '../models/note.model';
import { noteInput } from '../utils/test-data';
import { NONEXISTENT_UUID } from '../utils/constants';
import { waitToCrossSecondBoundary } from '../utils/time';

const ISO_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)$/;

/**
 * Notes CRUD (/api/notes).
 * @smoke — happy path: API-NOTE-01 (create), API-NOTE-02 (read own), API-NOTE-03 (content
 *   round-trip), API-NOTE-04 (list includes note), API-NOTE-05 (update), API-NOTE-06 (delete -> 404).
 * @regression — extended + data-integrity defects: API-NOTE-07…16.
 */
test.describe('API — Notes CRUD', () => {
  test(
    'API-NOTE-01: creates a note (201 + full shape, echoes input)',
    { tag: '@smoke' },
    async ({ notesApi }) => {
      const input = noteInput();

      const res = await notesApi.create(input);
      expect(res.status()).toBe(201);
      const note = await json<Note>(res);
      expect(Object.keys(note).sort()).toEqual([...NOTE_KEYS].sort());
      expect(note.title).toBe(input.title);
      expect(note.content).toBe(input.content);
      expect(note.id).toMatch(/^[0-9a-f-]{36}$/);
    },
  );

  test('API-NOTE-02/03: reads own note with content intact', { tag: '@smoke' }, async ({ notesApi }) => {
    const input = noteInput();
    const created = await json<Note>(await notesApi.create(input));

    const res = await notesApi.getById(created.id);
    expect(res.status()).toBe(200);
    const note = await json<Note>(res);
    expect(note).toEqual(created);
    // Content integrity: broken mode blanks this to "".
    expect(note.content).toBe(input.content);
  });

  test(
    'API-NOTE-04: list includes the created note with full shape + content',
    { tag: '@smoke' },
    async ({ notesApi }) => {
      const input = noteInput();
      const created = await json<Note>(await notesApi.create(input));

      const res = await notesApi.list();
      expect(res.status()).toBe(200);
      const notes = await json<Note[]>(res);
      expect(Array.isArray(notes)).toBe(true);

      const found = notes.find((n) => n.id === created.id);
      expect(found, 'created note must appear in the owner list').toBeDefined();
      expect(Object.keys(found!).sort()).toEqual([...NOTE_KEYS].sort());
      expect(found!.content).toBe(input.content);
    },
  );

  test('API-NOTE-05: updates a note title/content (200, persisted)', { tag: '@smoke' }, async ({
    notesApi,
  }) => {
    const created = await json<Note>(await notesApi.create(noteInput()));
    const update = { title: 'Updated title', content: 'Updated body content' };

    const res = await notesApi.update(created.id, update);
    expect(res.status()).toBe(200);
    const note = await json<Note>(res);
    expect(note.id).toBe(created.id);
    expect(note.title).toBe(update.title);
    expect(note.content).toBe(update.content);

    // Persistence is verified via read-back (both fields survive the round-trip).
    const after = await json<Note>(await notesApi.getById(created.id));
    expect(after.title).toBe(update.title);
    expect(after.content).toBe(update.content);
    expect(new Date(after.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(after.created_at).getTime(),
    );

    // NOTE: `created_at` immutability is intentionally NOT asserted here — it is
    // the dedicated concern of API-NOTE-10 (A2). Automation of this flow surfaced
    // a real defect: PUT re-runs the create timestamps, so `created_at` is RESET
    // to the update time (visible only when create/update cross a 1s boundary).
    // See requirements-gap-analysis.md G14. API-NOTE-10 will fail until fixed.
  });

  test('API-NOTE-06: deletes a note (204, then 404 on read)', { tag: '@smoke' }, async ({ notesApi }) => {
    const created = await json<Note>(await notesApi.create(noteInput()));

    expect((await notesApi.remove(created.id)).status()).toBe(204);
    expect((await notesApi.getById(created.id)).status()).toBe(404);
  });

  test(
    'API-NOTE-07: create several, list contains all with no duplicates',
    { tag: '@regression' },
    async ({ notesApi }) => {
      const created: Note[] = [];
      for (let i = 0; i < 3; i++) {
        created.push(await json<Note>(await notesApi.create(noteInput())));
      }
      const list = await json<Note[]>(await notesApi.list({ itemsPerPage: '50' }));
      const ids = list.map((n) => n.id);
      for (const note of created) expect(ids).toContain(note.id);
      expect(new Set(ids).size).toBe(ids.length);
    },
  );

  test('API-NOTE-08: PUT is idempotent for the meaningful fields', { tag: '@regression' }, async ({
    notesApi,
  }) => {
    const created = await json<Note>(await notesApi.create(noteInput()));
    const body = { title: 'Same title', content: 'Same content' };

    const first = await json<Note>(await notesApi.update(created.id, body));
    const second = await json<Note>(await notesApi.update(created.id, body));

    expect(second.id).toBe(first.id);
    expect(second.title).toBe(body.title);
    expect(second.content).toBe(body.content);
  });

  test(
    'API-NOTE-09: field formats — uuid id + ISO-8601 timestamps',
    { tag: '@regression' },
    async ({ notesApi }) => {
      const note = await json<Note>(await notesApi.create(noteInput()));
      expect(note.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(note.created_at).toMatch(ISO_OFFSET);
      expect(note.updated_at).toMatch(ISO_OFFSET);
    },
  );

  // 🐞 Defect (found via A1 automation) — gap-analysis G14. Deterministic because
  // the boundary wait guarantees the reset created_at lands in a later second.
  test(
    'API-NOTE-10: created_at is RESET on update instead of immutable (defect)',
    { tag: '@regression' },
    async ({ notesApi }) => {
      const created = await json<Note>(await notesApi.create(noteInput()));
      const before = await json<Note>(await notesApi.getById(created.id));

      await waitToCrossSecondBoundary();
      await notesApi.update(created.id, { title: 'changed', content: 'changed body' });
      const after = await json<Note>(await notesApi.getById(created.id));

      // Expected (correct): created_at unchanged. Actual: it moves with updated_at.
      expect(after.created_at).not.toBe(before.created_at);
    },
  );

  test(
    'API-NOTE-11: owner cannot be spoofed via the payload',
    { tag: '@regression' },
    async ({ notesApi, secondUser, secondUserNotesApi }) => {
      // Try to assign the new note to user B via an extra `owner` field.
      const res = await notesApi.create({
        title: 'ownership',
        content: 'x',
        owner: `/api/users/${secondUser.id}`,
      } as never);
      expect(res.status()).toBe(201);
      const note = await json<Note>(res);

      // The note belongs to A (creator): A can read it, B cannot.
      expect((await notesApi.getById(note.id)).status()).toBe(200);
      expect((await secondUserNotesApi.getById(note.id)).status()).toBe(404);
    },
  );

  test('API-NOTE-12: unknown fields in the payload are ignored', { tag: '@regression' }, async ({
    notesApi,
  }) => {
    const res = await notesApi.create({ title: 'ok', content: 'x', foo: 'bar' } as never);
    expect(res.status()).toBe(201);
    const note = await json<Note & { foo?: unknown }>(res);
    expect(note.foo).toBeUndefined();
    expect(Object.keys(note).sort()).toEqual([...NOTE_KEYS].sort());
  });

  test(
    'API-NOTE-13: unicode/emoji content round-trips byte-for-byte',
    { tag: '@regression' },
    async ({ notesApi }) => {
      const input = { title: 'título 📝 内容', content: 'emoji 😀 ünïcode 内容 body' };
      const created = await json<Note>(await notesApi.create(input));
      const read = await json<Note>(await notesApi.getById(created.id));
      expect(read.title).toBe(input.title);
      expect(read.content).toBe(input.content);
    },
  );

  test('API-NOTE-14: updating a non-existent note returns 404', { tag: '@regression' }, async ({
    notesApi,
  }) => {
    expect((await notesApi.update(NONEXISTENT_UUID, { title: 'x', content: 'y' })).status()).toBe(404);
  });

  test('API-NOTE-15: deleting a non-existent note returns 404', { tag: '@regression' }, async ({
    notesApi,
  }) => {
    expect((await notesApi.remove(NONEXISTENT_UUID)).status()).toBe(404);
  });

  // 🐞 Defect (verified)
  test(
    'API-NOTE-16: sequential PUTs silently lose the earlier update (defect)',
    { tag: '@regression' },
    async ({ notesApi }) => {
      const created = await json<Note>(await notesApi.create(noteInput()));

      // Two clients read the same version, then write in sequence.
      const w1 = await notesApi.update(created.id, { title: 'Writer 1', content: 'from writer 1' });
      const w2 = await notesApi.update(created.id, { title: 'Writer 2', content: 'from writer 2' });
      expect(w1.status()).toBe(200);
      expect(w2.status()).toBe(200); // Expected (correct): 409 Conflict on the stale write.

      const final = await json<Note>(await notesApi.getById(created.id));
      expect(final.title).toBe('Writer 2'); // last write silently wins; writer 1 is lost
    },
  );
});
