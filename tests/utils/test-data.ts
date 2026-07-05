import { faker } from '@faker-js/faker';
import { env } from '../../config/env';
import type { CreateNoteRequest } from '../models/note.model';

// Optional deterministic seed for reproducible runs.
if (env.fakerSeed !== undefined) {
  faker.seed(env.fakerSeed);
}

/** A password that satisfies the app's rule (8–255 chars). */
export const DEFAULT_PASSWORD = 'Password123!';

/**
 * Unique, collision-proof email. Timestamp keeps it unique across parallel
 * workers even if Faker is seeded; `example.com` mirrors the app's own emails.
 */
export function uniqueEmail(prefix = 'qa'): string {
  const suffix = faker.string.alphanumeric(6).toLowerCase();
  return `${prefix}_${Date.now()}_${suffix}@example.com`;
}

/** Realistic note payload with distinctive title/content for search assertions. */
export function noteInput(overrides: Partial<CreateNoteRequest> = {}): CreateNoteRequest {
  return {
    title: faker.lorem.sentence({ min: 2, max: 5 }),
    content: faker.lorem.paragraphs(2),
    ...overrides,
  };
}

/** A note whose title/content embed a unique token, for exact search matching. */
export function searchableNoteInput(): CreateNoteRequest & { token: string } {
  const token = `tkn${faker.string.alphanumeric(8).toLowerCase()}`;
  return {
    token,
    title: `Note ${token}`,
    content: `Body containing ${token} marker.`,
  };
}

/** Build a string of an exact length (for boundary/length validation tests). */
export function stringOfLength(length: number, fill = 'a'): string {
  return fill.repeat(length);
}

/** Emails the app must reject with `Invalid email format.` */
export const INVALID_EMAILS = ['userexample.com', 'user@', '@example.com', 'user@@example.com'] as const;

/** A unique email local part (the bit before `@`) of an exact length — a single
 *  alphanumeric run, no dots. Callers may request a length past the 64-char
 *  limit on purpose, to build a deliberately-invalid email for negative cases. */
function localPartOfLength(length: number): string {
  return faker.string.alphanumeric(length).toLowerCase();
}

/**
 * A **unique** email of an exact `totalLength`, with a single-label domain and
 * **no dots in the domain** (`<localPart>@u<token>.com`). The length lives in
 * the local part; `localLength` sizes the domain label's random token, so a
 * caller can push either side over its own limit for negative cases. Unique per
 * call (like `uniqueEmail`) to avoid the double-submit-race defect (API-SIGNUP-19).
 *
 * Format limits verified against the live app: the **local part** accepts 64
 * chars and rejects 65; each **domain label** accepts 63 and rejects 64. With a
 * single-label (dot-free) domain the longest *valid* email is therefore
 * `64 + '@' + 63 + '.com'` = 132 chars.
 */
export function emailOfLength(totalLength: number, localLength: number = 10): string {
  const domainLabel = `u${faker.string.alphanumeric(localLength).toLowerCase()}`; // unique per call
  const domain = `${domainLabel}.com`;
  const localPartLength = totalLength - domain.length - 1; // minus '@'
  if (localPartLength < 1) {
    throw new Error(`emailOfLength: cannot construct an exact length of ${totalLength}`);
  }
  return `${localPartOfLength(localPartLength)}@${domain}`;
}


/**
 * A long but RFC-valid **unique** email (64-char local + 63-char domain label
 * ≈ 132 chars) — for the long-email profile-layout case.
 */
export function longValidEmail(): string {
  const local = (faker.string.alphanumeric(8).toLowerCase() + stringOfLength(56)).slice(0, 64);
  return `${local}@${stringOfLength(63, 'b')}.com`;
}
