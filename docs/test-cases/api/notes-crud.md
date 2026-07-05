# API — Notes CRUD (`/api/notes`)

**User story:** _As an authenticated user, I want to create, read, update and delete my notes so
that I can manage my content._

**Rules:** all operations require a Bearer JWT · a created note is owned by the caller · note shape
is `{id, title, content, created_at, updated_at}` · collection is a **plain JSON array** · delete
returns `204`; the note is then gone.

## Test cases

| ID | Pri | Type | Title | Preconditions | Steps / Data | Expected result | Coverage |
|---|---|---|---|---|---|---|---|
| API-NOTE-01 | P0 | Positive | Create note | Authed user | POST `{title, content}` | `201`, body has **exactly** keys `id,title,content,created_at,updated_at`; `title`/`content` echo input | notes-crud.spec |
| API-NOTE-02 | P0 | Positive | Read own note | Note created | GET `/api/notes/{id}` | `200`; body equals the created note | notes-crud.spec |
| API-NOTE-03 | P0 | Positive | 🔴 gate — content round-trips | Note created with non-empty content | GET the note | `content` equals what was sent (broken mode blanks it to `""`) | notes-crud.spec |
| API-NOTE-04 | P0 | Positive | List includes created note | ≥1 note created | GET `/api/notes` | `200`, array contains the note; each item has full shape and intact `content` (🔴 gate) | notes-crud.spec |
| API-NOTE-05 | P0 | Positive | Update note | Note created | PUT `/api/notes/{id}` `{title:"New", content:"New body"}` | `200`; `title`/`content` updated; `id` and `created_at` unchanged; `updated_at` ≥ previous | notes-crud.spec |
| API-NOTE-06 | P0 | Positive | Delete note | Note created | DELETE `/api/notes/{id}` | `204`; subsequent GET → `404` | notes-crud.spec |
| API-NOTE-07 | P1 | Positive | Create multiple, list all | Authed user | Create 3 notes, GET list | All 3 present, no duplicates | notes-crud.spec |
| API-NOTE-08 | P1 | Positive | PUT idempotency | Note created | PUT same body twice | Both `200`; resulting resource identical (aside from `updated_at`) | notes-crud.spec |
| API-NOTE-09 | P2 | Contract | Field formats | Note created | Inspect response | `id` = UUID v4; `created_at`/`updated_at` = ISO-8601 with offset | notes-crud.spec |
| API-NOTE-10 | P2 | Positive | `created_at` immutable on update | Note created | Update note, compare | `created_at` unchanged; `updated_at` advanced | notes-crud.spec |
| API-NOTE-11 | P2 | Security | Cannot spoof owner via payload | Two users A, B | A POST `{title, content, owner:"/api/users/<B>"}` | Note owned by **A** (extra field ignored); not assigned to B | notes-crud.spec |
| API-NOTE-12 | P2 | Positive | Unknown fields ignored | Authed user | POST `{title, content, foo:"bar"}` | `201`; `foo` not stored/returned | notes-crud.spec |
| API-NOTE-13 | P3 | Positive | Unicode/emoji content | Authed user | Create note with `título 📝 内容` | Stored and returned byte-for-byte | notes-crud.spec |
| API-NOTE-14 | P2 | Negative | Update non-existent note | Authed user | PUT `/api/notes/<random-uuid>` | `404` | notes-crud.spec |
| API-NOTE-15 | P2 | Negative | Delete non-existent note | Authed user | DELETE `/api/notes/<random-uuid>` | `404` | notes-crud.spec |
| API-NOTE-16 | P1 | Security | 🐞 Lost update — no optimistic concurrency | A note exists | Two clients each read the note, then `PUT` different values in sequence | **Defect (verified):** both `PUT` → `200`; the later write silently **overwrites** the earlier with no version/`ETag`/`If-Match` check — classic lost update. *Expected:* a concurrency guard (`updated_at`/version) → `409 Conflict` on a stale write | notes-crud.spec |

**Built-in schema check:** the create/read/update/list responses here are *additionally* validated
against `Note-note.read` (strict) via the inline `expectMatchesSchema` assertion — see
[contract-schema.md](contract-schema.md) (API-CONTRACT-01…04, 07). No separate contract tests needed.

See [notes-validation.md](notes-validation.md) for field-constraint cases and
[notes-authorization.md](notes-authorization.md) for ownership/auth.
