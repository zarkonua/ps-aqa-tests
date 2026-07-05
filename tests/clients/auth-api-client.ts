import type { APIRequestContext, APIResponse } from '@playwright/test';
import { BaseApiClient } from './base-api-client';
import type { ConfirmRequest, SignupRequest } from '../models/auth.model';

/**
 * Client for the custom auth controller: /api/auth/*.
 * Built from an *unauthenticated* request context; `me()` takes an explicit
 * token so the same client can exercise valid/invalid/missing token cases.
 */
export class AuthApiClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request, '/api/auth');
  }

  signup(body: SignupRequest): Promise<APIResponse> {
    return this.post('/signup', body);
  }

  confirm(body: ConfirmRequest): Promise<APIResponse> {
    return this.post('/confirm', body);
  }

  signin(body: { email: string; password: string }): Promise<APIResponse> {
    return this.post('/signin', body);
  }

  /** GET /api/auth/me. Pass a raw token to control the Authorization header. */
  me(token?: string): Promise<APIResponse> {
    return this.request.get(this.url('/me'), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }
}
