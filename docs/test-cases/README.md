# Test Cases — Notes App

Manual/reference test-case catalog for the Symfony **Notes** application, derived from the
product's user stories (README of the app) and the observed API contract. These are the
**design** artifact — the source of truth for what the automated suite must cover. Automation
lives under [`../../tests`](../../tests); the mapping is in each file's _Coverage_ column.

> Companion docs: [`../test-strategy.md`](../test-strategy.md) (strategy, requirements, "broken mode" design, DoD) ·
> [`../coverage-matrix.md`](../coverage-matrix.md) (feature → test mapping) ·
> [`../automation-priority.md`](../automation-priority.md) (per-case automation tier + runtime budgets) ·
> [`../requirements-gap-analysis.md`](../requirements-gap-analysis.md) (ambiguous/missing requirements vs implementation) ·
> [`../a1-automation-report.md`](../a1-automation-report.md) / [`../a2-automation-report.md`](../a2-automation-report.md) (automation evidence) ·
> [`../supporting/coverage-gap-analysis.md`](../supporting/coverage-gap-analysis.md) (source-driven branch/risk gaps) ·
> [`../supporting/test-design-techniques.md`](../supporting/test-design-techniques.md) (per-case design techniques) ·
> [`../exploratory/`](../exploratory) (exploratory charter sessions).

## How this is organized

```
test-cases/
├── api/     # endpoint-level cases (contract, validation, authz, search, pagination)
└── ui/      # user-journey cases through the SPA
```

| Area | File |
|---|---|
| **API** — Sign up | [api/auth-signup.md](api/auth-signup.md) |
| **API** — Confirm | [api/auth-confirm.md](api/auth-confirm.md) |
| **API** — Sign in | [api/auth-signin.md](api/auth-signin.md) |
| **API** — Profile (`/me`) | [api/auth-me.md](api/auth-me.md) |
| **API** — Notes CRUD | [api/notes-crud.md](api/notes-crud.md) |
| **API** — Notes authorization | [api/notes-authorization.md](api/notes-authorization.md) |
| **API** — Search / filter / sort | [api/notes-search-sort.md](api/notes-search-sort.md) |
| **API** — Pagination | [api/notes-pagination.md](api/notes-pagination.md) |
| **API** — Notes validation | [api/notes-validation.md](api/notes-validation.md) |
| **API** — Contract & schema (OpenAPI) | [api/contract-schema.md](api/contract-schema.md) |
| **API** — Advanced / gray-box | [api/advanced-gray-box.md](api/advanced-gray-box.md) |
| **UI** — Registration journey | [ui/registration-journey.md](ui/registration-journey.md) |
| **UI** — Notes management | [ui/notes-management.md](ui/notes-management.md) |
| **UI** — Search & pagination | [ui/search-pagination.md](ui/search-pagination.md) |
| **UI** — Profile | [ui/profile.md](ui/profile.md) |
| **UI** — Auth guard & navigation | [ui/auth-navigation.md](ui/auth-navigation.md) |

## Conventions

**Test-case ID** — `API-<AREA>-NN` / `UI-<AREA>-NN` (stable; referenced from automation).

**Type** — `Positive` · `Negative` · `Boundary` · `Security` · `Contract` (response shape/status).

**Tags** — `@smoke` (fast subset) · `@db @gray-box` (needs the DB seam; skipped when `DB_HOST`
is unset — see [api/advanced-gray-box.md](api/advanced-gray-box.md)) · `@slow` (excluded from PR runs) ·
`@infra` `@concurrency` `@security` `@scale`.

**Automation tier** — every case is assigned **A1** (smoke) / **A2** (regression) / **A3** (extended) /
**M** (exploratory) in [`../automation-priority.md`](../automation-priority.md). A `🐞` in a case marks a
**confirmed defect** the case documents (see [`../exploratory/`](../exploratory) for the sessions that found them).

**Priority** (risk-based, per business impact × failure likelihood):

| Priority | Meaning |
|---|---|
| **P0** | Critical path — release blocker (core auth, ownership, data integrity) |
| **P1** | High — important functionality & common error handling |
| **P2** | Medium — edge cases, secondary flows, contract details |
| **P3** | Low — rare inputs, cosmetic, nice-to-have |

## Test-level strategy (pyramid)

Coverage is **API-first**. A behavior is tested through the UI **only when it is browser-specific
and cannot be asserted over HTTP** — rendering, HTML-escaping, DOM interactions (e.g. the delete
confirmation modal), client-side routing/auth-gating, session lifecycle, and one full end-to-end
journey. Everything else — input validation, authorization/ownership, search/sort/pagination
**logic**, email content, data correctness — is owned by the API layer, which is faster, more
precise, and less flaky.

Consequently the UI docs are deliberately thin. Each UI file ends with a **"Covered at API level
instead"** table that redirects the logic-level checks to their owning API cases, so nothing is
lost — it just lives at the right level. Example: a deep-link-while-unauthenticated check is *not*
a UI case, because the data protection is `API-AUTHZ-*` (endpoints return `401`) and the page shell
is public and data-free; the only UI part (auth form renders) is already `UI-GUARD-01`.

## The "broken mode" bug-injection mode

The app can run in `APP_MODE=broken`, which deliberately regresses behavior. Certain cases are written
so they **pass in `healthy` mode and fail in `broken` mode** — they are the proof that the suite asserts
real contracts, not just "2xx". They cluster around:

| Broken-mode defect | Caught by |
|---|---|
| Auth returns random 2xx instead of 201/200 | exact-status assertions in signup/confirm/me |
| Auth response shape mutates (`jwt`/`access_token`/`user_id`…) | exact-shape Contract cases |
| Note `content` blanked to `""` on read | content round-trip cases (API-NOTE-03) + browser render (UI-NOTE-07) |
| Confirmation email link points to bogus host | email-link validation (API-SIGNUP-02) |

## Verified contract (baseline, `healthy` mode)

| Endpoint | Success | Notable errors |
|---|---|---|
| `POST /api/auth/signup` | `201 {message}` | `400 {error}` (validation / duplicate) |
| `POST /api/auth/confirm` | `201 {token, message}` | `400 {error}` (bad/expired code) |
| `POST /api/auth/signin` | `200 {token}` | `401 {code,message}` (invalid creds / unverified) |
| `GET /api/auth/me` | `200 {id, email}` | `401 {code,message}` (missing/invalid JWT) |
| `GET /api/notes` | `200 [Note,…]` (plain array) | `401` |
| `POST /api/notes` | `201 {id,title,content,created_at,updated_at}` | `422 problem+json`, `401` |
| `GET/PUT/DELETE /api/notes/{id}` | `200` / `200` / `204` | `404` (not owner / missing), `422`, `401` |

## Business rules reference

- **Email**: required, RFC-valid, ≤ 190 chars, lower-cased & trimmed.
- **Password**: required, 8–255 chars.
- **Confirmation code**: exactly 6 digits, single-use, expires in 10 minutes.
- **Note title**: required (NotBlank), 1–255 chars, trimmed.
- **Note content**: required (NotBlank), 1–10 000 chars.
- **Ownership**: a note is only visible/mutable by its owner; others get `404`.
- **Pagination**: client-controlled `itemsPerPage`, capped at **50**.
