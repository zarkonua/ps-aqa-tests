# Notes App — Automated Test Suite (API + E2E)

Automated test suite for the Symfony **Notes** application, covering the REST API and
the most important end-to-end UI flows. Built with **Playwright + TypeScript**, treating
the deployed app as a black box over HTTP.

> Companion to the app under test (the "Senior AQA tech task"). **All QA artifacts live in
> [`docs/`](./docs/README.md)** — start with that index for the guided reading order. Highlights:
> [`docs/test-strategy.md`](./docs/test-strategy.md) (strategy + the "broken mode" bug-injection design),
> [`docs/test-plan.md`](./docs/test-plan.md) (scope, entry/exit criteria), and
> [`docs/test-cases/`](./docs/test-cases/README.md) (the manual test-case catalog the automation is built from).

## Prerequisites

- Node.js 20+
- The app under test running and reachable (defaults: app on `http://localhost:4444`,
  MailHog on `http://localhost:8025`). From the app repo: `make up && make install && make migrate`.

## Setup

```sh
npm install
npm run install:browsers      # Chromium for the E2E project
cp .env.example .env          # adjust BASE_URL / MAILHOG_URL if needed
```

## Running tests

```sh
npm test                  # everything (api + e2e)
npm run test:smoke        # @smoke only — A1, fast CI gate
npm run test:regression   # @regression only — A2, PR + nightly
npm run test:api          # API suite only (no browser)
npm run test:db           # @db gray-box seam — A3, opt-in, needs MySQL reachable
npm run test:e2e          # E2E suite only
npm run test:headed       # E2E with a visible browser
npm run test:ui           # Playwright UI mode (watch/debug)
npm run report            # open the last Playwright HTML report
npm run allure:serve      # build + serve the Allure report from the last run
npm run allure:generate   # build a static Allure report into allure-report/
npm run allure:open       # open the generated static Allure report
npm run typecheck         # tsc --noEmit
```

Every test carries a real Playwright tag annotation (`{ tag: '@smoke' }` / `{ tag: '@regression' }` on the
individual `test()`, not the `describe` — each spec file has exactly one `describe` per feature area, and
tier is per-case metadata, matching the catalog. See [`docs/automation-priority.md`](./docs/automation-priority.md)
for the tier definitions and which catalog IDs live in each). Tags are wired into `playwright.config.ts` as
their own **projects** (`smoke`, `regression`, cross-cutting api+e2e), so they're selectable the same way as `api`/`e2e`:

```sh
npx playwright test --project=smoke        # same as npm run test:smoke
npx playwright test --grep "@smoke|@regression" --project=api --project=e2e  # ad-hoc combinations still work
```

Note: `smoke`/`regression` re-select tests already covered by `api`/`e2e`, so plain `npx playwright test`
(no `--project`) would double-run everything — `npm test` pins `--project=api --project=e2e` for that
reason; always pass `--project` explicitly when invoking Playwright directly.

Of the A3 (extended) tier, the `@db @gray-box` seam is implemented — `npm run test:db` runs it as its own
opt-in `db` project (excluded from the default `api` project; needs MySQL reachable, see `DB_*` vars in
`.env.example`). `@infra @concurrency @security @scale` remain reserved for future extended cases.

## Configuration

All configuration is read from the environment (see [`config/env.ts`](./config/env.ts)):

| Variable | Default | Purpose |
|---|---|---|
| `BASE_URL` | `http://localhost:4444` | App UI + API host |
| `MAILHOG_URL` | `http://localhost:8025` | MailHog HTTP API (read confirmation emails) |
| `FAKER_SEED` | _(unset)_ | Fix Faker seed for reproducible data |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | app's `compose.yaml` dev DB (`127.0.0.1:33444`, `root`, `qa_task_dev`) | MySQL gray-box seam — only used by `npm run test:db` |

## Project structure

```
config/
  env.ts                  # typed environment config
tests/
  api/                    # API specs (APIRequestContext, no browser)
  e2e/                    # browser end-to-end specs
  clients/                # API client classes (auth, notes, mailhog)
  pages/                  # Page Objects for the SPA
  fixtures/               # api.fixture / e2e.fixture (auth seeding, POM wiring)
  models/                 # TypeScript contracts for request/response shapes
  utils/                  # Faker-based test data helpers
playwright.config.ts      # two projects: `api` and `e2e`
```

### Design notes

- **Two Playwright projects.** `api` uses `APIRequestContext` only; `e2e` runs Chromium.
- **Authentication as a fixture.** `registeredUser` (API) and `seededUser`/`signedInPage`
  (E2E) create a real verified user via signup → read code from MailHog → confirm, so tests
  never repeat login boilerplate. E2E injects the JWT into `localStorage["qa_task_token"]`
  for a fast authenticated start; the full UI signup journey has its own dedicated test.
- **Strict assertions by design.** Tests assert exact status codes, full response shapes, and
  content round-trips — so a suite that is green against the app's `healthy` mode turns **red**
  against `broken` mode (see `docs/test-strategy.md`).
- **Isolation.** Every test creates its own uniquely-named data (timestamped emails), so the
  suite runs fully in parallel without collisions.

## Reporting

Two HTML reports are produced from every run (reporters are configured in `playwright.config.ts`):

- **Playwright HTML report** — `npm run report` opens the last one (`playwright-report/`).
- **Allure report** — richer history/trends and grouping. Results are written to `allure-results/`
  during the run; turn them into a report with `npm run allure:serve` (build + open in one step) or
  `npm run allure:generate` then `npm run allure:open` (static report in `allure-report/`). Requires
  Java (for the Allure CLI); `allure-playwright` collects the results with no Java needed.

> **Note:** don't pass `--reporter=...` on the command line — it replaces the whole configured
> reporter list, so Allure (and the JSON/HTML reporters) won't collect results. The `npm run test:*`
> scripts don't override the reporter, so they always populate `allure-results/`.

Both `allure-results/` and `allure-report/` are git-ignored.

## CI

GitHub Actions runs the suite on push/PR and uploads the Playwright HTML report as an
artifact. See [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).
