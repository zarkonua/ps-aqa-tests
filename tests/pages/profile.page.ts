import type { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/** Authenticated user's profile view (id + email). */
export class ProfilePage extends BasePage {
  readonly view: Locator;
  readonly navProfileButton: Locator;
  readonly email: Locator;
  readonly id: Locator;

  constructor(page: Page) {
    super(page);
    this.view = page.locator('#profile-view');
    this.navProfileButton = page.locator('#nav-profile-button');
    this.email = page.locator('#profile-email');
    this.id = page.locator('#profile-id');
  }

  async openProfile(): Promise<void> {
    await this.navProfileButton.click();
  }
}
