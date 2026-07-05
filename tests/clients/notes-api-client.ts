import type { APIRequestContext, APIResponse } from '@playwright/test';
import { BaseApiClient } from './base-api-client';
import type { CreateNoteRequest, UpdateNoteRequest } from '../models/note.model';

/**
 * Client for the Notes resource: /api/notes.
 * Expects an *authenticated* request context (Authorization header set by the
 * caller/fixture), so every call is scoped to that user.
 */
export class NotesApiClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request, '/api/notes');
  }

  /**
   * GET /api/notes with optional query params:
   *  q, title, content, page, itemsPerPage, sort[updatedAt], sort[title].
   */
  list(params?: Record<string, string>): Promise<APIResponse> {
    return this.get('', params);
  }

  getById(id: string): Promise<APIResponse> {
    return this.get(`/${id}`);
  }

  create(body: CreateNoteRequest): Promise<APIResponse> {
    return this.post('', body);
  }

  update(id: string, body: UpdateNoteRequest): Promise<APIResponse> {
    return this.put(`/${id}`, body);
  }

  remove(id: string): Promise<APIResponse> {
    return this.delete(`/${id}`);
  }
}
