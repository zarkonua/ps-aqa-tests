# QA Process — how QA operates in this team

The [test plan](test-plan.md) covers *this* release; this doc defines the **standing process** — how
quality work runs day-to-day now that the team has its first QA. Lightweight on purpose: one QA,
small team, no ceremony that doesn't pay for itself.

## 1. Where testing sits in the flow

```
requirement/feature ──► test design ──► automation ──► gates ──► release
        │                    │               │            │
   gap questions        catalog case     tier (A1–A3)   DoD check
   (before code)        with stable ID   or M(anual)
```

- **Test design precedes automation.** Every behavior gets a catalog case
  ([`test-cases/`](test-cases/README.md)) with a stable `API-*`/`UI-*` ID *first*; automated tests
  reference that ID in their title, keeping a two-way traceable mapping between catalog and suite.
- **Requirements get challenged before they're tested.** Ambiguous or missing rules are captured as
  numbered gaps (G1…) with the code-verified actual behavior — the test oracle is never a guess.
- **New feature intake:** read the requirement → write gap questions → catalog cases (with P0–P3
  business priority) → assign automation tier per ROI ([`automation-priority.md`](automation-priority.md))
  → automate → wire into the matching gate below.

## 2. Gates (what runs when)

| Trigger | Suite | Budget | Command |
|---|---|---|---|
| every push | **A1 smoke** | ≤ 90 s | `npm run test:smoke` |
| every PR + nightly | **A2 regression** (superset of A1) | ~3–5 min | `npm run test:regression` |
| nightly / on-demand | **A3 extended** (`@db` live; `@infra @concurrency @scale @security` planned) | ~5–10 min | `npm run test:db` (+ future tags) |
| per release candidate | **broken-mode validation** — suite must go **red** vs `APP_MODE=broken` | one-off run | see [`test-strategy.md` §7](test-strategy.md#7-broken-mode-validation-validation-of-the-suite-itself) |

A red gate blocks the merge/release until triaged: either it's a product regression (fix the app)
or a legitimate behavior change (update catalog case *and* test together — never the test alone).

## 3. Defect workflow

1. **Found** — via automation, exploratory session, or review.
2. **Reproduce & pin** — write a **characterization test** asserting the current (wrong) behavior,
   with a comment stating the correct expectation. It passes today and flips the moment the bug is
   fixed, so fixes are detected automatically. (Spec-drift findings use `test.fail()` instead, so an
   "unexpected pass" flags the fix.)
3. **Register** — one row in the defect register with **Severity** (business/security impact) and
   **Priority** (P0–P3). Cross-link the gap (G-#) and the exploratory session that found it, if any.
4. **Report & triage with the dev team** — severity/priority proposed by QA, agreed in triage.
   P0 = release blocker by default (see [test-plan §6](test-plan.md#6-exit-criteria-a-releaseiteration-passes-when)).
5. **On fix** — the characterization test flips/fails → convert it to a normal regression assertion,
   move the register row to a "fixed" state, close the loop.

## 4. Exploratory testing cadence

Scripted coverage is the floor, not the ceiling. Charter-based sessions
(generated per the charter-generator skill) run:

- once per **new feature** before its cases are finalized (findings feed the catalog),
- on **risk triggers** — a gnarly bug fix, a dependency upgrade, a suspicious area from triage.

Each session produces a report (charter, execution log, findings F1…); confirmed findings graduate
into catalog cases + characterization tests, same as §3.

## 5. Keeping the docs honest

The catalog is the **source of truth**; drift between docs, tests, and app behavior is treated as a
defect in the QA deliverable itself:

- Every automated test carries a catalog ID → orphans/dropped cases are diffable mechanically.
- Periodic **self-review** (docs vs tests vs app source) reconciles the catalog, the defect register,
  and the automated suite whenever tests are added, renamed, or removed — so the docs never drift from
  what the suite actually runs.
- A behavior change updates the catalog row and the test **in the same PR**.

## 6. Release sign-off

QA signs off a release when the [test-plan exit criteria](test-plan.md#6-exit-criteria-a-releaseiteration-passes-when)
hold, and reports: gate results (A1/A2, CI link + HTML report), open defects with severity/priority,
and any exit-criteria exceptions explicitly listed — sign-off states *what was and wasn't verified*,
never a bare "QA passed".
