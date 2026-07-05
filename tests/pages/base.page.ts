import type { Page, Locator } from '@playwright/test';

/**
 * The app is a single-page app served at `/app`; all views live on one page
 * and are toggled by JS. Page objects therefore share one URL and expose
 * view-specific sections.
 */
export abstract class BasePage {
  readonly page: Page;
  /** Global status banner used by the app for success/error messages. */
  readonly status: Locator;

  constructor(page: Page) {
    this.page = page;
    this.status = page.locator('#status');
  }

  async open(): Promise<void> {
    await this.page.goto('/app');
  }
}
