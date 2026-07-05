# Test Plan — Notes App (one-pager)

The classic plan document: **what is in and out of scope, under which conditions testing starts,
stops, and passes**. The *how* (levels, tooling, broken-mode design) lives in
[`test-strategy.md`](test-strategy.md); the *what exactly* (case-by-case) lives in
[`test-cases/`](test-cases/README.md). This page mostly points there — by design.

| | |
|---|---|
| **Product** | Symfony Notes app (auth + notes CRUD/search/pagination), deployed at `http://localhost:4444` |
| **Plan owner** | QA (single engineer — first QA in the team, see [`qa-process.md`](qa-process.md)) |
| **References** | app `README.md` (8 features) · live OpenAPI (`/api/doc.json`) · app source (oracle of last resort) |

## 1. Objectives

1. Verify all **8 product features** (sign-up, email confirmation, sign-in, profile, notes list
   with search/pagination, note create/edit/delete) against the *actual* contract — exact statuses,
   full response shapes, content round-trips.
2. Prove the suite catches real regressions: green on `APP_MODE=healthy`, **red on `broken`**
   (see [`test-strategy.md` §2/§7](test-strategy.md)).
3. Surface and register defects and requirement ambiguities as first-class deliverables
   (a defect register and a requirements gap analysis).

## 2. Scope

### In scope

- **Functional** — API-first: contract, validation, boundaries, authorization/ownership,
  search/sort/pagination logic; UI only for browser-specific behavior (rendering, modals,
  client-side gating, one full E2E journey). Rationale: [`test-cases/README.md` → pyramid](test-cases/README.md#test-level-strategy-pyramid).
- **Integration** — email delivery + confirmation-link correctness via MailHog.
- **Security (targeted)** — injection/XSS safety, enumeration resistance, session/code lifecycle,
  ownership isolation. Findings-driven, not a full pentest.
- **Exploratory** — charter-based sessions per feature.
- **Contract/schema** — responses validated against the live OpenAPI doc, incl. spec-drift findings.

### Out of scope (deliberate)

| Area | Why |
|---|---|
| Load / stress / soak testing | Task scope is functional automation; no dedicated performance/response-time tests |
| Accessibility | Not in the task's scope |
| Cross-browser matrix | Chromium only; SPA is framework-free vanilla JS, low cross-browser risk |
| Full penetration test | Targeted security cases only; findings raised are entry points for a real audit |
| App's own PHPUnit suite | Left untouched — this project is the *external* black-box deliverable |

## 3. Test items & environments

- **Surfaces:** SPA UI (`:4444`), REST API (`/api`), OpenAPI doc, MailHog (`:8025`), MySQL seam
  (`:33444`, `@db` gray-box only).
- **Environments are config-only:** every target is env-driven (`BASE_URL`, `MAILHOG_URL`, `DB_*`
  — see root `README.md` → Configuration); the suite runs against any deployment without code changes.
- **Modes:** `healthy` (primary target, must be green) and `broken` (throwaway second instance,
  suite must go red — validation of the suite itself).

## 4. Approach & prioritization (pointers)

- Levels, tooling, data strategy, contract layer → [`test-strategy.md`](test-strategy.md).
- Business priority **P0–P3** (risk-based) → defined in [`test-cases/README.md`](test-cases/README.md#conventions).
- Automation tiers **A1/A2/A3/M** (ROI-based, separate from business priority) →
  [`automation-priority.md`](automation-priority.md).

## 5. Entry criteria (testing starts when…)

1. App deployed; UI, `/api/doc.json`, and MailHog all reachable (`200`).
2. DB migrations applied (`make up && make install && make migrate` in the app repo).
3. MailHog captures a signup email end-to-end (smoke-checked by `API-SIGNUP-02`).

## 6. Exit criteria (a release/iteration passes when…)

The Definition of Done in [`test-strategy.md` §10](test-strategy.md#10-definition-of-done--acceptance-criteria),
condensed: A1+A2 green against `healthy` · typecheck clean, no `test.only`/hard waits · broken-mode
subset verified **red** against `broken` · CI green with published HTML report · every catalog case
automated or explicitly manual/exploratory · confirmed defects registered and pinned by tests.

**Known-defect policy:** confirmed defects do **not** block the exit gate by default — they are pinned
by characterization tests and triaged by severity/priority with the team (P0 defects are release
decisions for the whole team, not silently waived by QA).

## 7. Suspension & resumption

- **Suspend** when the environment itself fails entry criteria mid-run (app/MailHog down, migrations
  missing) — results against a half-up environment are noise, not signal.
- **Resume** when the A1 smoke suite (≤ 90 s) is green again; it doubles as the environment health check.

## 8. Deliverables

All in this repo: strategy · this plan · [`qa-process.md`](qa-process.md) ·
[test-case catalog](test-cases/README.md) · [automation-priority matrix](automation-priority.md) ·
the automated suite (`../tests`).

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Broken-mode randomness → flaky detection | Exact-value assertions; multiple independent catchers per injected bug (see strategy §7) |
| Confirmation codes expire in 10 min, single-use | Fresh code per test via MailHog; expiry states arranged via the `@db` seam, not waiting |
| Shared env state (suite isn't the only client) | Unique Faker data per test; no assertions on global counts (except scoped `@db` cases) |
| Spec drift — OpenAPI disagrees with reality | Statuses asserted explicitly, never derived from the spec; drift pinned as `API-DRIFT-*` |
| Single-QA bus factor | Everything ID-traceable and documented — stable case IDs link the catalog to the suite both ways |

## 10. Milestones (status)

Phasing and current state: [`test-strategy.md` §11](test-strategy.md#11-execution-phasing-history) —
scaffold → A1 smoke → A2 regression → E2E → CI ✅ done; broken-mode validation run and the remaining
A3 slices (`@infra @concurrency @scale @security`) ⬜ outstanding.
