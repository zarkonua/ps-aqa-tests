import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { randomUUID, createHash } from 'node:crypto';
import { env } from '../../config/env';
import { DEFAULT_PASSWORD, uniqueEmail } from '../utils/test-data';
import { FAR_PAST_DATETIME } from '../utils/constants';
import type { Note } from '../models/note.model';

/**
 * Gray-box DB seam (docs/test-cases/api/advanced-gray-box.md).
 *
 * Arranges state that isn't reachable through the public API in reasonable
 * time (expired confirmation codes, large datasets) — tests still call the
 * real API/UI to exercise the behavior under test; this only seeds
 * *preconditions*. No ad-hoc SQL belongs in spec files — everything goes
 * through these intention-revealing methods.
 */

export interface SeededUser {
  id: string;
  email: string;
  password: string;
}

export interface NoteSpec {
  title?: string;
  content?: string;
  /** MySQL `datetime` literal, e.g. `'2026-01-01 00:00:00'`. Defaults to now. */
  createdAt?: string;
  updatedAt?: string;
}

export interface SignupCodeOptions {
  /** MySQL `datetime` literal or a `Date` (converted to UTC). Defaults to 15 minutes from now. */
  expiresAt?: string | Date;
  /** MySQL `datetime` literal, a `Date`, or `null` for unused (default). */
  usedAt?: string | Date | null;
}

function toDatetimeLiteral(value: string | Date): string {
  return typeof value === 'string' ? value : value.toISOString().slice(0, 19).replace('T', ' ');
}

export class DbSeamClient {
  private readonly pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: env.dbHost,
      port: env.dbPort,
      user: env.dbUser,
      password: env.dbPassword,
      database: env.dbName,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }

  async dispose(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Login-able user in one step: real bcrypt hash, no MailHog/signup round-trip.
   * `password_verify` reads the bcrypt cost from the hash itself, so a
   * bcryptjs-generated `$2b$` hash is fully interchangeable with the app's own `$2y$`.
   */
  async insertUser(opts: { email?: string; password?: string; verified?: boolean } = {}): Promise<SeededUser> {
    const id = randomUUID();
    const email = opts.email ?? uniqueEmail('dbseam');
    const password = opts.password ?? DEFAULT_PASSWORD;
    const passwordHash = await bcrypt.hash(password, 13);

    await this.pool.execute(
      'INSERT INTO users (id, email, password_hash, is_verified, created_at) VALUES (?, ?, ?, ?, NOW())',
      [id, email, passwordHash, opts.verified ?? true ? 1 : 0],
    );
    return { id, email, password };
  }

  /**
   * Bulk-insert notes for `ownerId` in a single round-trip (a `count` gets
   * generic seed content; `specs` lets a case control title/content/timestamps).
   */
  async insertNotes(ownerId: string, countOrSpecs: number | NoteSpec[]): Promise<Note[]> {
    const specs: NoteSpec[] = Array.isArray(countOrSpecs)
      ? countOrSpecs
      : Array.from({ length: countOrSpecs }, (_, i) => ({
          title: `Seed note ${i}`,
          content: `Seed content ${i}`,
        }));

    const now = toDatetimeLiteral(new Date());
    const rows = specs.map((spec) => ({
      id: randomUUID(),
      title: spec.title ?? 'Seed note',
      content: spec.content ?? 'Seed content',
      createdAt: spec.createdAt ?? now,
      updatedAt: spec.updatedAt ?? spec.createdAt ?? now,
    }));

    await this.pool.query(
      'INSERT INTO notes (id, title, content, created_at, updated_at, owner_id) VALUES ?',
      [rows.map((r) => [r.id, r.title, r.content, r.createdAt, r.updatedAt, ownerId])],
    );

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    }));
  }

  /** Insert a fully-controlled signup code (known plaintext, known hash). */
  async insertSignupCode(userId: string, code: string, opts: SignupCodeOptions = {}): Promise<void> {
    const codeHash = createHash('sha256').update(code.trim()).digest('hex');
    const expiresAt = toDatetimeLiteral(
      opts.expiresAt ?? new Date(Date.now() + 15 * 60_000),
    );
    const usedAt = opts.usedAt == null ? null : toDatetimeLiteral(opts.usedAt);

    await this.pool.execute(
      'INSERT INTO signup_codes (user_id, code_hash, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, NOW())',
      [userId, codeHash, expiresAt, usedAt],
    );
  }

  /** Age an already-issued (real) code to force expiry, without knowing its hash. */
  async expireSignupCode(email: string, expiresAt: string | Date = FAR_PAST_DATETIME): Promise<void> {
    await this.pool.execute(
      'UPDATE signup_codes SET expires_at = ? WHERE user_id = (SELECT id FROM users WHERE email = ?)',
      [toDatetimeLiteral(expiresAt), email],
    );
  }

  /** Flip `is_verified` directly — the hybrid path (API signup, then DB-verify). */
  async verifyUser(email: string): Promise<void> {
    await this.pool.execute('UPDATE users SET is_verified = 1 WHERE email = ?', [email]);
  }

  /** Cascades to the user's notes and signup codes. */
  async deleteUserByEmail(email: string): Promise<void> {
    await this.pool.execute('DELETE FROM users WHERE email = ?', [email]);
  }
}
