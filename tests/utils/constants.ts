/** A fixed, well-formed UUID v4 that no note will ever use — for not-found cases.
 *  (All-zeros can't collide with a server-generated UUID, so it's deterministic
 *  and safe; it is NOT random by design.) */
export const NONEXISTENT_UUID = '00000000-0000-4000-8000-000000000000';

/**
 * Absolute far-past MySQL `datetime` literal for the DB gray-box seam
 * (docs/test-cases/api/advanced-gray-box.md) — safe against PHP/MySQL
 * timezone drift, unlike `NOW() - INTERVAL ...`.
 */
export const FAR_PAST_DATETIME = '2000-01-01 00:00:00';
