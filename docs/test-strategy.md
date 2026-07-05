# Test Strategy — PS AQA Tech Task (Symfony Notes App)

> **Status:** A1 (smoke, 25 tests) and A2 (regression, 149 tests total) are built and green — see
> [`a1-automation-report.md`](a1-automation-report.md) / [`a2-automation-report.md`](a2-automation-report.md)
> for evidence. A3 (extended) is partially built: the `@db` gray-box seam is implemented and runs via
> `npm run test:db` (opt-in `db` project); `@infra @concurrency @scale @security` are designed but not yet built.
> Target under test: deployed at `http://localhost:4444`.

---

## 1. System under test

A Symfony 8 / PHP 8.5 notes application with authentication, deployed and reachable locally.
All three surfaces verified reachable (`200`):

| Surface | URL |
|---|---|
| SPA UI (vanilla JS) | `http://localhost:4444` |
| REST API (API Platform + JWT) | `http://localhost:4444/api` |
| OpenAPI spec (JSON) | `http://localhost:4444/api/doc.json` |
| API docs (UI) | `http://localhost:4444/api/doc` |
| MailHog (captures signup emails) | `http://localhost:8025` |

### API surface

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/api/auth/signup` | public | Emails a 6-digit confirmation code (10-min expiry) via MailHog |
| `POST` | `/api/auth/confirm` | public | Verifies account, returns JWT |
| `POST` | `/api/auth/signin` | public | JSON login (lexik JWT), returns token |
| `GET`  | `/api/auth/me` | Bearer | Returns `{id, email}` |
| `GET`  | `/api/notes` | Bearer | List: search (`q`,`title`,`content`), sort (`sort[updatedAt]`,`sort[title]`), pagination (client-controlled, **max 50/page**) |
| `POST` | `/api/notes` | Bearer | Create |
| `GET`  | `/api/notes/{id}` | Bearer | Read (owner-scoped) |
| `PUT`  | `/api/notes/{id}` | Bearer | Update (owner-scoped) |
| `DELETE` | `/api/notes/{id}` | Bearer | Delete (owner-scoped) |

Notes are **owner-scoped** via `NoteOwnerExtension` — a user must never see or mutate another user's notes.

### Business rules extracted from source

- Password: min 8, max 255 **bytes** (see [`requirements-gap-analysis.md`](requirements-gap-analysis.md) G4).
- Email: RFC-valid, max 190 chars, lowercased/trimmed.
- Confirmation code: exactly 6 digits, single-use, expires in 10 minutes.
- Note title: 1–255 chars, `NotBlank`, trimmed.
- Note content: 1–10000 chars, `NotBlank` (not trimmed — asymmetric with title).
- Signup for an **existing verified** user → `400 User already exists.`
- Signup for an existing **unverified** user → allowed (re-issues code).

---

## 2. The key insight — this is a bug-injection harness

The app has a hidden env `APP_MODE` (`healthy` | `broken`). Both are committed; CI and the current
deployment run `healthy`. In **`broken` mode** the code deliberately regresses:

1. **`AuthController`** — signup/confirm return a *random* `2xx` status instead of `201`, and response
   shapes randomly mutate (`token` → `jwt`/`access_token`, `id` → `user_id`, extra keys added).
2. **`BrokenModeNoteNormalizer`** — silently blanks every note's `content` to `""` on read.
3. **Confirmation email link** points to a bogus `oh-no-it-is-broken-mode.example.com` host with a
   typo'd param (`confirm_kode`).

**This is the real point of the task.** A weak suite (only "status is 2xx", ignores response schema,
never re-reads content) passes *both* modes and proves nothing. A strong suite passes green on
`healthy` and **turns red on `broken`**. Every assertion below is designed to prove exactly that:
exact status codes, strict schema/shape checks, content round-trip verification, and email-link validation.

---

## 3. Tooling decision

Standalone **Playwright + TypeScript** project, black-box against the deployed app over HTTP.
Matches the provided QA skills (`playwright-api`, `playwright-e2e`) and treats the app as a real
deployed target. The app's own PHPUnit suite is left untouched; this is the external automation deliverable.

---

## 4. Project structure

```
tests/
  api/          # *.spec.ts — A1 (@smoke) + A2 (@regression) tagged blocks in the same file
  e2e/          # same convention, browser specs
  clients/      # base-api-client, auth-api-client, notes-api-client, mailhog-client
  pages/        # base, auth, notes, profile Page Objects
  fixtures/     # api.fixture / e2e.fixture — auth seeding, POM wiring
  models/       # request/response TypeScript contracts
  utils/        # test-data (Faker), schema (live OpenAPI validation), register
playwright.config.ts   # projects: api, e2e, smoke, regression
.github/workflows/ci.yml
```

### Frontend selectors available (from `public/assets/app.js`)

The SPA exposes stable element IDs, so POM is clean (no brittle CSS):
`signup-form`, `signup-email`, `signup-password`, `signin-form`, `signin-email`, `signin-password`,
`create-note-form`, `note-title`, `note-content`, `notes-list`, `notes-list-total`,
`notes-search-query`, `notes-search-field`, `notes-search-sort`, `notes-prev-page`, `notes-next-page`,
`notes-page-size`, `notes-page-info`, `nav-notes-button`, `nav-profile-button`, `logout-button`,
`profile-email`, `profile-id`, `status`. Delete uses a confirmation modal (`.modal-actions`, Delete/danger).

---

## 5. Coverage plan

The full case-by-case breakdown lives in [`test-cases/`](test-cases/README.md) and
[`coverage-matrix.md`](coverage-matrix.md); this section summarizes the design.

### 5.1 API tests — assert status **and** body shape

- **Auth (signup/confirm/signin/me):** happy paths with exact status/shape; validation boundaries
  (password/email/code length); duplicate/unverified/unknown-user negatives; no-enumeration checks.
- **Notes CRUD:** create→read (content round-trip), update, delete→404, list with full field set.
- **Authorization:** any notes endpoint without token → `401`; cross-user access → `404` (not `403` —
  anti-enumeration by design, see G11).
- **Search/sort/pagination:** `q`/`title`/`content` filters, `sort[updatedAt|title]`, owner-scoped
  results, page-size cap (50), default (30).
- **Validation:** blank/missing/boundary title & content → `422 application/problem+json`.

### 5.2 E2E / UI tests — Page Object Model

- **Full journey:** sign up → poll MailHog for the code → confirm → land on notes list.
- **Note lifecycle in UI:** create → appears in list → edit → delete via confirmation modal → gone.
- **Search + pagination** controls drive the list correctly.
- **Profile page** shows correct id + email for the logged-in user.
- **Auth guard:** unauthenticated user cannot reach notes/profile; logout returns to auth screen.

### 5.3 MailHog integration

A client against `http://localhost:8025/api/v2/messages`: fetch the latest message for a recipient,
regex-extract the 6-digit code and the confirmation link, and assert the link is well-formed and
points at the app (a direct broken-mode catcher). Unlocks the real signup → confirm flow for both suites.

### 5.4 Test data & seeding

Two tiers:

1. **Black-box (default):** `faker`-generated, unique per run (timestamp/seed suffix on emails);
   fixtures build state through the API (signup → confirm → notes). This is how the happy paths and
   the system-under-test are exercised.
2. **DB seed (gray-box, `@db`, built — opt-in `db` project):** direct inserts via the DB seam for data
   that is a *precondition*, not the behavior under test — verified users (bcrypt hash + `is_verified`),
   large or **time-ordered** note sets, and expired/used codes. Fast (ms) and deterministic; runs only
   via `npm run test:db` (excluded from the default `api` project via `grepInvert`).

**Guiding rule:** seed the *arrange* data, never the thing being asserted — signup/confirm/sign-in
and note-creation always run through the real API/UI. Details, schema, and builders in
[test-cases/api/advanced-gray-box.md](test-cases/api/advanced-gray-box.md).

### 5.5 Contract & schema validation (OpenAPI)

A contract layer validates response **bodies** against the app's **live** OpenAPI spec
(`GET /api/doc.json`, fetched once at runtime — no hardcoded/vendored schemas), complementing (not
replacing) the explicit status/exact-shape assertions.

- Schemas are looked up **by endpoint** (`schemaFor(path, method, status)`), resolving `$ref`s.
- **Strict mode** injects `additionalProperties:false` so renamed/extra keys fail — a second
  broken-mode catcher (e.g. `/me` returning `{user_id, mail}` fails the `{id,email}` schema).
- **Status codes stay explicit** in the tests, never derived from the spec, because the spec's
  documented statuses are wrong in places (see spec drift below).
- Implemented dependency-free (`tests/utils/schema.ts`): required keys / `additionalProperties` /
  `uuid`+`date-time` formats validated directly, without pulling in `ajv`.

**⚠️ Spec drift found (real findings — see [`requirements-gap-analysis.md`](requirements-gap-analysis.md) G7):**

| Endpoint | Spec documents | Actual (verified) |
|---|---|---|
| `POST /api/auth/confirm` | `200` | **`201`** |
| `GET /api/notes` (no token) | `403` only | **`401`** (`JWT Token not found`); 401 not documented |
| notes item errors | `403` | cross-user is **`404`**, missing token is **`401`** |
| collections (`ld+json`) | schema advertised | `application/ld+json` actually **`500`s**; only `application/json` works |

A few **spec-drift assertions** (`API-DRIFT-*`, run as `xfail`) turn these into reported defects —
legitimate QA output beyond pass/fail. See [test-cases/api/contract-schema.md](test-cases/api/contract-schema.md).

---

## 6. CI & evidence

`.github/workflows/ci.yml` — on push/PR:
- brings up (or points at) the deployed app,
- runs the Playwright suite,
- uploads the **Playwright HTML report** as an artifact → satisfies the task's "evidence tests run" ask.

---

## 7. Broken-mode validation (validation of the suite itself)

After the suite is green against `healthy`, stand up a **throwaway second instance** with
`APP_MODE=broken` (separate port / temporary container — the running healthy instance is left alone)
and re-run the suite. Expected outcome: **it goes red**, specifically on —
- exact auth status-code assertions (random 2xx),
- auth response-shape assertions (mutated keys),
- note content round-trip (blanked content),
- email-link validation (bogus host).

This proves the tests assert real contracts rather than rubber-stamping any 2xx. (Not yet executed
against a live `broken` instance — see Definition of Done, §10.)

---

## 8. Automation tiers & runtime budgets

Full detail — per-case tier assignment and *why* — lives in [`automation-priority.md`](automation-priority.md).
Summary:

| Tier | Suite | Target runtime | Status |
|---|---|---|---|
| **A1** | Smoke — every push | ≤ 90 s | ✅ built, 25 tests green |
| **A2** | Regression — every PR + nightly | ~3–5 min | ✅ built, 124 tests green (149 total incl. A1) |
| **A3** | Extended — nightly/on-demand (`@db @infra @concurrency @scale @security`) | ~5–10 min | 🟡 partial — `@db` seam built (`npm run test:db`); rest designed, not built |

---

## 9. Requirements checklist (condensed)

The suite must satisfy these, grouped by concern (each verifiable; ✅ = currently true, per the
automation reports):

| Area | Key requirements |
|---|---|
| **Scope** | Black-box over HTTP ✅ · API-first, UI only for browser-specific behavior ✅ · all 8 product features covered (§ coverage-matrix.md) |
| **Architecture** | Playwright+TS, `api`/`e2e` projects ✅ · typed clients + POM ✅ · fixtures for cross-cutting setup ✅ · typed models, status+body asserted ✅ · no hardcoded config ✅ · `tsc --noEmit` clean ✅ |
| **Environment** | Env-driven targets (`BASE_URL`, `MAILHOG_URL`, DB seam vars) ✅ · runs against any env by config only ✅ · doesn't assume sole-client state ✅ |
| **Test data** | Unique per test (Faker + timestamp) ✅ · seeded at the right level (API by default, DB seam for arrange-only data) ✅ |
| **Contract/schema** | Schemas fetched live from `/api/doc.json`, no hardcoding ✅ · looked up by endpoint ✅ · dedicated spec (`contract.spec.ts`), no duplicate CRUD tests ✅ · strict mode available ✅ · status codes asserted explicitly, not derived from spec ✅ |
| **Broken-mode detection** | Exact-status/exact-shape cases assert exact status/shape/content/link ✅ · not yet re-run against a live `broken` instance ⬜ |
| **Coverage** | Every catalog case automated or marked manual/exploratory (A1+A2 done; A3 designed) · negatives ≥ happy paths ✅ |
| **Execution/CI** | Isolated & parallel-safe ✅ · tag-selectable suites ✅ · smoke ≤ 90s on every push ✅ · CI stands up app + publishes report ✅ · no hard waits ✅ |
| **Reporting** | HTML report + CI artifact ✅ · trace/screenshot on failure (recommended, verify config) |
| **Non-functional** | Determinism (repeat-run stable) ✅ · maintainable selectors (ids/roles) ✅ · readable, one area per spec file ✅ |

## 10. Definition of Done / acceptance criteria

The automation is "done" for a release when **all** hold:

1. All **A1** and **A2** tests pass against a `healthy` instance. ✅ (149/149, see automation reports)
2. `npm run typecheck` passes; no `test.only`, no committed hard waits. ✅
3. The **broken-mode (exact-status/exact-shape) subset** is verified to **fail** against an `APP_MODE=broken` instance. ⬜ **not yet run**
4. **CI is green**, and the HTML report is published as an artifact. ⬜ **verify on first push**
5. Every catalog case is automated or explicitly marked manual/exploratory. ✅ (A1+A2); A3 designed, not built
6. Confirmed defects are captured as annotated regression tests and listed for the team. ✅ (see A2 report + `requirements-gap-analysis.md`)
7. `@db`/`@infra`/`@slow` tests are correctly tagged and skip cleanly when their preconditions are absent. 🟡 **partial** — `@db` is tagged and isolated in its own opt-in `db` project (never runs by default); `@infra`/`@slow` not yet built

---

## 11. Execution phasing (history)

1. ✅ Scaffold Playwright TS project (api + e2e projects, tsconfig, deps, MailHog client).
2. ✅ API happy paths (auth + notes CRUD) — A1 smoke, green.
3. ✅ API unhappy paths, authz, search/pagination, validation — A2 regression, green.
4. ✅ E2E: full signup→confirm→signin journey + notes lifecycle + profile + auth guard (A1 core + A2 breadth).
5. ✅ CI workflow + README with setup/run instructions and report evidence.
6. ⬜ Validate broken-mode detection: run against a local `APP_MODE=broken` instance, confirm red.
7. 🟡 A3 (extended): `@db` gray-box seam ✅ built (`npm run test:db`); `@infra` mailer-down, `@concurrency` races, `@security` loops ⬜ remaining.

---

## 12. Skills mapped to steps

| Skill | Used for |
|---|---|
| `playwright-api` | API client classes, fixtures, spec structure (status + body assertions) |
| `playwright-e2e` | POM, fixtures, storage-state auth reuse for UI flows |
| `api-test-suite-generator` | Bootstrap the CRUD/error/pagination matrix from `/api/doc.json` |
| `faker-test-data` | Reproducible, unique test data |
| `test-case-generator-user-stories` | Derive formal test cases from README feature list before coding |

---

## 13. Open risks / notes

- Broken mode uses randomness — assertions must be deterministic enough that broken mode fails
  *reliably*, not flakily (assert exact expected values, run enough cases that random variance is caught).
- Confirmation codes expire in 10 min and are single-use — tests must fetch a fresh code per run.
- Keep API and E2E suites separate (per skill guidance); share only the MailHog client and models.
- Real defects found via automation (`API-NOTE-10` — `created_at` reset; several security gaps) are
  pinned as characterization tests in A2 — see [`requirements-gap-analysis.md`](requirements-gap-analysis.md)
  and the automation reports for the full list and recommended fixes.
