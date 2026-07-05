import { expect } from '@playwright/test';
import type { NotesApiClient } from '../clients/notes-api-client';
import { json } from './response';
import { noteInput } from './test-data';
import type { Note } from '../models/note.model';

/**
 * Shared note test helpers (used by the pagination, search/sort, and E2E
 * search specs). These assert on the response, so they live in test utils —
 * not on `NotesApiClient`, which stays a thin transport so negative tests can
 * still inspect non-200 responses.
 */

/** `GET /api/notes`, assert `200`, return the parsed notes. */
export async function listNotes(
  api: NotesApiClient,
  params?: Record<string, string>,
): Promise<Note[]> {
  const res = await api.list(params);
  expect(res.status()).toBe(200);
  return json<Note[]>(res);
}

/** Create one note with the given title/content; return the created note. */
export async function createNote(
  api: NotesApiClient,
  title: string,
  content: string,
): Promise<Note> {
  return json<Note>(await api.create({ title, content }));
}

/** Create `count` notes with realistic random content; return them in order. */
export async function seedNotes(api: NotesApiClient, count: number): Promise<Note[]> {
  const notes: Note[] = [];
  for (let i = 0; i < count; i++) {
    notes.push(await json<Note>(await api.create(noteInput())));
  }
  return notes;
}

/** Create notes for the given titles (content derived); return them in order. */
export async function seedNotesWithTitles(
  api: NotesApiClient,
  titles: string[],
): Promise<Note[]> {
  const notes: Note[] = [];
  for (const title of titles) {
    notes.push(await createNote(api, title, `content for ${title}`));
  }
  return notes;
}
