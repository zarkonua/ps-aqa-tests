import type { APIRequestContext, APIResponse } from '@playwright/test';

/**
 * Thin wrapper over Playwright's APIRequestContext.
 *
 * Auth is handled by the *context*: an authenticated client is constructed
 * with a request context that already carries the `Authorization` header
 * (see the `authedRequest` fixture). This keeps individual calls clean and
 * avoids threading tokens through every method.
 */
export abstract class BaseApiClient {
  protected readonly request: APIRequestContext;
  protected readonly basePath: string;

  constructor(request: APIRequestContext, basePath: string) {
    this.request = request;
    this.basePath = basePath;
  }

  protected url(path = ''): string {
    return `${this.basePath}${path}`;
  }

  protected get(path = '', params?: Record<string, string>): Promise<APIResponse> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request.get(`${this.url(path)}${query}`);
  }

  protected post(path: string, data?: unknown): Promise<APIResponse> {
    return this.request.post(this.url(path), data === undefined ? {} : { data });
  }

  protected put(path: string, data?: unknown): Promise<APIResponse> {
    return this.request.put(this.url(path), data === undefined ? {} : { data });
  }

  protected delete(path: string): Promise<APIResponse> {
    return this.request.delete(this.url(path));
  }
}
