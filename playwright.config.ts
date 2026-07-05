import { defineConfig, devices } from '@playwright/test';
import { env } from './config/env';

/**
 * Three dimensions of projects:
 *  - `api` / `e2e`   : by test *type* — the full catalog for each (no tag filter),
 *    excluding `@db` (see below).
 *  - `smoke` / `regression` : by automation *tier* — cross-cutting (api + e2e),
 *    filtered by the real `{ tag: '@smoke' }` / `{ tag: '@regression' }`
 *    annotations on each `describe` block (see docs/automation-priority.md).
 *    `regression` is a **superset** of `smoke` (PR/nightly reruns the smoke
 *    gate too), so it matches `@smoke|@regression`, not `@regression` alone.
 *  - `db` : the A3 gray-box seam (docs/test-cases/api/advanced-gray-box.md),
 *    tagged `@db @gray-box`. These connect to MySQL directly, so they're
 *    excluded from `api` (`grepInvert`) and only run via `--project=db`
 *    (nightly/on-demand, not part of the default or smoke/regression runs).
 *
 * `smoke`/`regression` re-select tests already covered by `api`/`e2e`, so the
 * default full run (`npm test`) explicitly pins `--project=api --project=e2e`
 * to avoid double-running everything; `smoke`/`regression`/`db` are opt-in via
 * `--project=<name>` (see the `test:smoke` / `test:regression` / `test:db`
 * npm scripts).
 *
 * The app is assumed to be already deployed and reachable at BASE_URL, so
 * there is no `webServer` block — tests run against the live target.
 */
const e2eUse = {
  ...devices['Desktop Chrome'],
  baseURL: env.baseUrl,
  video: 'retain-on-failure',
} as const;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: env.isCi,
  retries: env.isCi ? 1 : 2,
  workers: env.isCi ? 4 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['allure-playwright', { resultsDir: 'allure-results', detail: true }],
    env.isCi ? ['github'] : ['list'],
  ],
  use: {
    baseURL: env.baseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'api',
      testDir: './tests/api',
      grepInvert: /@db/, // gray-box seam cases run only via the `db` project
      use: {
        baseURL: env.baseUrl,
        extraHTTPHeaders: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    },
    {
      name: 'e2e',
      testDir: './tests/e2e',
      use: e2eUse,
    },
    {
      name: 'smoke',
      testDir: './tests',
      grep: /@smoke/,
      use: e2eUse, // spans both api + e2e specs; browser `use` is a no-op for API-only tests
    },
    {
      name: 'regression',
      testDir: './tests',
      grep: /@smoke|@regression/, // regression is a superset: reruns smoke too
      use: e2eUse,
    },
    {
      name: 'db',
      testDir: './tests/api',
      grep: /@db/,
      use: {
        baseURL: env.baseUrl,
        extraHTTPHeaders: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    },
    {
      name: 'e2e-regression',
      testDir: './tests/e2e',
      grep: /@smoke|@regression/,
      use: e2eUse,
    },
  ],
});
