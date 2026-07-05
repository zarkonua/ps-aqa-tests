/**
 * Note resource contract as served by API Platform with `application/json`.
 * Collections are returned as a **plain JSON array** of Note (no pagination
 * envelope), so `NoteCollection` is simply `Note[]`.
 */

export interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CreateNoteRequest {
  title: string;
  content: string;
}

export interface UpdateNoteRequest {
  title?: string;
  content?: string;
}

export type NoteCollection = Note[];

/** Keys every Note object must expose — used for strict schema checks. */
export const NOTE_KEYS: ReadonlyArray<keyof Note> = [
  'id',
  'title',
  'content',
  'created_at',
  'updated_at',
];
