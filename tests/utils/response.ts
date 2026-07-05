import type { APIResponse } from '@playwright/test';
import type { ControllerError } from '../models/api-error.model';

/**
 * Parse a response body as `T`. Centralizes the single unchecked cast so specs
 * read `await json<Note>(res)` instead of repeating `(await res.json()) as Note`
 * (and the double-await `(await (await api.create()).json()) as Note`). Runtime
 * shape is asserted separately by the contract/schema specs.
 */
export async function json<T>(res: APIResponse): Promise<T> {
  return (await res.json()) as T;
}

/** The `{ error }` message from a custom auth-controller response. */
export async function errorOf(res: APIResponse): Promise<string> {
  return (await json<ControllerError>(res)).error;
}

export interface Violation {
  propertyPath: string;
  message: string;
}

/** The `application/problem+json` validation-error envelope. */
export interface ProblemJson {
  status: number;
  title: string;
  detail?: string;
  violations: Violation[];
}

export const problemOf = (res: APIResponse): Promise<ProblemJson> => json<ProblemJson>(res);

/** All violation messages for a given property path. */
export const messagesFor = (p: ProblemJson, path: string): string[] =>
  p.violations.filter((v) => v.propertyPath === path).map((v) => v.message);
