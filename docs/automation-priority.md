# Automation Priority (candidacy matrix)

Every test case assigned an **automation tier** with a **per-case reason**. Automation priority is
*separate* from business priority (P0–P3): it weighs **ROI, determinism, and feasibility** — a P0 that
needs a 10-minute wait or a flaky race is not "automate-first".

## Tiers

| Tier | Suite | Target runtime | When it runs | Selection criteria |
|---|---|---|---|---|
| **A1** | **Smoke** | **≤ 90 s** (target ~60 s) | every push (CI gate) | critical + fast + deterministic + black-box: core happy paths, top auth/ownership negatives, broken-mode gates |
| **A2** | **Regression** | **~3–5 min** | every PR + nightly | deterministic negatives, boundaries, search/pagination, validation, contract |
| **A3** | **Extended** | **~5–10 min** | nightly / on-demand (tagged) | slower or seam-dependent: `@db` `@infra` `@concurrency` `@slow` `@scale` `@security` |

Full scripted suite (A1 + A2 + A3): **~10–15 min**.

**Tags are real Playwright annotations**, not filenames or title text: every `describe` block carries
`{ tag: '@smoke' }` (A1) or `{ tag: '@regression' }` (A2), so `npm run test:smoke` /
`npm run test:regression` (or `npx playwright test --grep @smoke`) filter for real. A3's
`@db @infra @concurrency @slow @scale @security` tags are reserved above but not yet applied to any spec —
add them the same way once A3 cases land.

> **How to read "Why":** each reason states the deciding factor(s) — *value* (release-gating vs
> secondary), *speed/determinism* (fast & repeatable vs flaky/slow), and *feasibility* (black-box vs
> needs a seam/infra). The strongest constraint wins the tier.

## API — Auth: sign-up (`auth-signup.md`)
| ID | Tier | Why this tier |
|---|---|---|
| API-SIGNUP-01 | A1 | Core registration happy path; fast & deterministic → must gate every push |
| API-SIGNUP-02 | A1 | Confirms email + link delivery (broken-mode 🔴 gate); MailHog read is deterministic |
| API-SIGNUP-13 | A1 | Exact status/shape 🔴 gate — the primary broken-mode catcher for signup |
| API-SIGNUP-03 | A2 | Email normalization correctness; valuable but not release-gating |
| API-SIGNUP-04 | A2 | Duplicate-verified negative; needs a confirmed-user setup → regression, not smoke |
| API-SIGNUP-05 | A2 | Re-signup-unverified secondary flow |
| API-SIGNUP-06 | A2 | Missing-email validation; deterministic negative |
| API-SIGNUP-07 | A2 | Missing-password validation; deterministic negative |
| API-SIGNUP-08 | A2 | Invalid-email equivalence set; data-driven breadth |
| API-SIGNUP-09 | A2 | Password below-min boundary |
| API-SIGNUP-10 | A2 | Password at-min boundary |
| API-SIGNUP-11 | A2 | Password max boundary (255/256) |
| API-SIGNUP-12 | A2 | Email length boundary (190/191) |
| API-SIGNUP-14 | A2 | Empty-body negative |
| API-SIGNUP-15 | A2 | Injection safety; deterministic security check |
| API-SIGNUP-16 | A2 | Malformed-JSON negative |
| API-SIGNUP-17 | A2 | Non-object-JSON branch (GAP-2) |
| API-SIGNUP-18 | A3 | `@infra` — requires taking the mailer down; can't run in the fast suite |
| API-SIGNUP-19 | A3 | `@concurrency` — double-submit race is non-deterministic; needs retries/isolation |
| API-SIGNUP-20 | A2 | Weak-password defect; deterministic single request |

## API — Auth: confirm (`auth-confirm.md`, `advanced-gray-box.md`)
| ID | Tier | Why this tier |
|---|---|---|
| API-CONFIRM-01 | A1 | Core activation happy path |
| API-CONFIRM-02 | A1 | Confirm→verified unlocks sign-in; core state transition |
| API-CONFIRM-09 | A1 | Exact status/shape 🔴 gate |
| API-CONFIRM-03 | A2 | Wrong-code negative |
| API-CONFIRM-04 | A2 | Single-use enforcement; deterministic |
| API-CONFIRM-05 | A2 | Malformed-code format set (data-driven) |
| API-CONFIRM-06 | A2 | Unknown-email negative |
| API-CONFIRM-07 | A2 | Missing-fields negative |
| API-CONFIRM-10 | A2 | Re-issued-code positive |
| API-CONFIRM-15 | A2 | Verified-guard defect; deterministic security regression |
| API-CONFIRM-16 | A2 | Multiple-live-codes defect; deterministic |
| API-CONFIRM-08 | A3 | `@db` — expiry reachable only via the DB seam |
| API-CONFIRM-11 | A3 | `@security` — rapid brute-force loop; observational, low CI value |
| API-CONFIRM-13 | A3 | `@db` — expiry boundary via seam |
| API-CONFIRM-14 | A3 | `@db` seeding helper (fixture, not an assertion) |

## API — Auth: sign-in (`auth-signin.md`)
| ID | Tier | Why this tier |
|---|---|---|
| API-SIGNIN-01 | A1 | Core auth happy path |
| API-SIGNIN-02 | A1 | Wrong-password core negative |
| API-SIGNIN-08 | A1 | Exact `{token}` 🔴 gate |
| API-SIGNIN-03 | A2 | Unverified rejection; needs unverified seed |
| API-SIGNIN-04 | A2 | No-enumeration security assertion |
| API-SIGNIN-05 | A2 | Missing-credentials negative |
| API-SIGNIN-06 | A2 | Token-usable chain to `/me` |
| API-SIGNIN-07 | A2 | Case-insensitive email |
| API-SIGNIN-09 | A2 | Wrong content-type edge |
| API-SIGNIN-10 | A3 | `@security` — 20 concurrent attempts; slow & non-deterministic |

## API — Profile `/me` (`auth-me.md`)
| ID | Tier | Why this tier |
|---|---|---|
| API-ME-01 | A1 | Profile happy path |
| API-ME-02 | A1 | No-token 401 — core auth boundary |
| API-ME-06 | A1 | Strict `{id,email}` 🔴 gate |
| API-ME-03 | A2 | Malformed-token negative |
| API-ME-04 | A2 | Wrong-scheme negative |
| API-ME-08 | A2 | Empty-Bearer negative |
| API-ME-09 | A2 | Post-logout-token defect; deterministic single request |
| API-ME-05 | A3 | Expired token — needs key-material seam or a wait |
| API-ME-07 | A3 | Deleted-user token — needs a deletion seam |

## API — Notes CRUD (`notes-crud.md`)
| ID | Tier | Why this tier |
|---|---|---|
| API-NOTE-01 | A1 | Create — core |
| API-NOTE-02 | A1 | Read own — core |
| API-NOTE-03 | A1 | Content round-trip 🔴 gate |
| API-NOTE-04 | A1 | List includes note + content intact 🔴 gate |
| API-NOTE-05 | A1 | Update — core |
| API-NOTE-06 | A1 | Delete → 404 — core |
| API-NOTE-07 | A2 | Create-many / list-all |
| API-NOTE-08 | A2 | PUT idempotency |
| API-NOTE-09 | A2 | Field formats (uuid/ISO) |
| API-NOTE-10 | A2 | `created_at` immutable on update |
| API-NOTE-11 | A2 | Owner-spoof security |
| API-NOTE-12 | A2 | Unknown fields ignored |
| API-NOTE-13 | A2 | Unicode/emoji content |
| API-NOTE-14 | A2 | Update non-existent → 404 |
| API-NOTE-15 | A2 | Delete non-existent → 404 |
| API-NOTE-16 | A2 | Lost-update defect; deterministic (two sequential PUTs, no race) |

## API — Notes authorization (`notes-authorization.md`)
| ID | Tier | Why this tier |
|---|---|---|
| API-AUTHZ-01 | A1 | List requires auth — critical security gate |
| API-AUTHZ-02 | A1 | Create requires auth |
| API-AUTHZ-03 | A1 | Get/Put/Delete require auth |
| API-AUTHZ-04 | A1 | Cross-user read → 404 (ownership leak = critical) |
| API-AUTHZ-05 | A1 | Cross-user update → 404 |
| API-AUTHZ-06 | A1 | Cross-user delete → 404 |
| API-AUTHZ-07 | A1 | Owner-scoped list — critical isolation |
| API-AUTHZ-08 | A2 | Non-existent id → 404 |
| API-AUTHZ-09 | A2 | Invalid token on notes |
| API-AUTHZ-10 | A2 | Search owner-scoped |
| API-AUTHZ-11 | A2 | Malformed id handling |

## API — Search / sort (`notes-search-sort.md`)
| ID | Tier | Why this tier |
|---|---|---|
| API-SEARCH-01…07 | A2 | Deterministic match/field-targeting/scoping; small fixtures → regression breadth |
| API-SEARCH-08…10 | A2 | Sort ordering (output oracle); deterministic |
| API-SEARCH-11 | A2 | Search+sort combined (pairwise) |
| API-SEARCH-12…15 | A2 | Empty-q / case / special-chars / unknown-sort edges; deterministic |

## API — Pagination (`notes-pagination.md`)
| ID | Tier | Why this tier |
|---|---|---|
| API-PAGE-01, 02, 04…09 | A2 | Page-size/navigation/defaults/scope; small fixtures, deterministic |
| API-PAGE-03 | A3 | Needs ≥51-note seed → `@db`/pool, too heavy for smoke |
| API-SCALE-01…07 | A3 | `@scale @db` — large-dataset seeding + soft perf |
| API-SEED-01 | A3 | `@db` bulk-seed helper (fixture) |

## API — Validation (`notes-validation.md`)
| ID | Tier | Why this tier |
|---|---|---|
| API-VAL-01…15 | A2 | Deterministic field validation, boundaries, envelope, and the trim/whitespace asymmetry → regression |

## API — Contract / schema (`contract-schema.md`)
| ID | Tier | Why this tier |
|---|---|---|
| API-CONTRACT-01…08 | **inline** | Not standalone tests — an `expectMatchesSchema` assertion added **inside the host case**, so each inherits its host's tier (e.g. API-CONTRACT-06 rides API-ME-06 → A1; API-CONTRACT-01 rides API-NOTE-01 → A1). No separate execution/suite slot |
| API-DRIFT-01…04 | A2 | The only standalone contract items — spec-drift, run as known-fail (`xfail`) to track documentation defects |

## UI — Registration / session (`registration-journey.md`)
| ID | Tier | Why this tier |
|---|---|---|
| UI-REG-01 | A1 | Flagship end-to-end journey — highest-value browser smoke |
| UI-REG-02 | A2 | Form sign-in transition |
| UI-REG-03 | A2 | API error surfaced in `#status` |
| UI-REG-04 | A2 | Logout clears session |
| UI-REG-05 | A2 | Session persistence on reload |
| UI-REG-06 | A3 | `@concurrency` — double-submit UI race; flaky, retry-tolerant |

## UI — Notes management (`notes-management.md`)
| ID | Tier | Why this tier |
|---|---|---|
| UI-NOTE-01 | A1 | Create-in-UI is the core notes journey |
| UI-NOTE-02 | A2 | Edit reflects in list |
| UI-NOTE-03 | A2 | Delete via confirmation modal (UI-only interaction) |
| UI-NOTE-04 | A2 | Cancel deletion |
| UI-NOTE-05 | A2 | Live list/counter update |
| UI-NOTE-06 | A2 | Invalid create surfaced |
| UI-NOTE-07 | A2 | Content renders (UI broken-mode 🔴 catcher) |
| UI-NOTE-08 | A2 | XSS escaped in browser (UI-only security) |
| UI-NOTE-09 | A3 | `@concurrency` — double-click create race; flaky, retry-tolerant |
| UI-NOTE-10 | A2 | Edit-modal input-loss defect; deterministic |

## UI — Search & pagination (`search-pagination.md`)
| ID | Tier | Why this tier |
|---|---|---|
| UI-SP-01…05 | A2 | Control→re-render wiring; deterministic, not release-gating |
| UI-SP-06 | A3 | `@concurrency` — rapid-paging race → phantom pages; flaky, retry-tolerant |
| UI-SP-07 | A2 | Mislabeled total; deterministic DOM assertion |

## UI — Profile (`profile.md`)
| ID | Tier | Why this tier |
|---|---|---|
| UI-PROF-01, 02 | A2 | Renders details / view navigation; secondary |
| UI-PROF-03 | A2 | Long-email overflow; deterministic layout assertion (no horizontal scroll) |

## UI — Auth gating (`auth-navigation.md`)
| ID | Tier | Why this tier |
|---|---|---|
| UI-GUARD-01 | A1 | Unauth → auth screen; core client-side gate |
| UI-GUARD-02 | A2 | App reacts to `401` |
| UI-GUARD-03 | A2 | Valid session renders app |

## Suite composition (summary)

| Suite | ~Count | Target runtime | Trigger | Tags |
|---|---|---|---|---|
| **Smoke (A1)** | ~28 | ≤ 90 s | every push | `@smoke` |
| **Regression (A2)** | ~100 | ~3–5 min | every PR + nightly | (default) |
| **Extended (A3)** | ~30 | ~5–10 min | nightly / on-demand | `@db @infra @concurrency @slow @scale @security` |

**Build order:** A1 (get CI green fast) → A2 (breadth) → A3 (seams/infra). The broken-mode gate suite is
the 🔴-flagged subset of A1/A2 re-run against a `broken` instance.

## Runtime budgets & assumptions

Estimates assume **~4 parallel workers**, `fullyParallel`, and the app reachable on `localhost`
(no cross-network latency). Per-test averages (measured/extrapolated from the smoke run):

| Test kind | Avg per test | What drives it |
|---|---|---|
| API happy/negative | ~0.5–1.5 s | `registeredUser` fixture (signup → MailHog poll → confirm → me ≈ 1 s); pure signup negatives ~0.3 s (no user) |
| E2E (UI) | ~3–6 s | browser context + page load; auth seeded via `localStorage` token (no UI login). The full journey UI-REG-01 ~8–10 s |
| `@db` (gray-box) | ~1–2 s | MySQL connect + seed/assert |
| `@scale` | ~2–5 s | large-set seeding (DB bulk-insert ~ms; API pool ~1.4 s / 55 notes) + queries |
| `@concurrency` | 2–3× base | non-deterministic; runs with retries |
| `@infra` | ~5–15 s | **the slowest** — stopping/starting the mailer container dominates |

**Why the tier budgets fall out of this:**
- **A1 ≤ 90 s** — ~28 mostly-API cases at ~1 s across 4 workers ≈ 30–60 s of work; a handful of E2E gates add the rest. Hard cap so every push stays fast (see `test-strategy.md` §9 requirements checklist).
- **A2 ~3–5 min** — ~100 cases, API-heavy but with the UI regression set; parallelism keeps it minutes, not tens of minutes.
- **A3 ~5–10 min** — dominated by `@infra` container restarts and `@concurrency` retries; `@scale` seeding adds a little. Runs off the critical path (nightly/on-demand).

**If a tier blows its budget:** increase workers/shard in CI; move a slow case down a tier (A1→A2, A2→A3); prefer the DB seam over API loops for heavy seeding; and keep auth setup in fixtures (never log in through the UI per test). Treat a budget breach as a signal to investigate, not to raise the number.
