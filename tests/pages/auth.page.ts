import type { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/** Sign-up and sign-in forms (both live in the auth section of the SPA). */
export class AuthPage extends BasePage {
  readonly signupForm: Locator;
  readonly signupEmail: Locator;
  readonly signupPassword: Locator;
  readonly signinForm: Locator;
  readonly signinEmail: Locator;
  readonly signinPassword: Locator;

  constructor(page: Page) {
    super(page);
    this.signupForm = page.locator('#signup-form');
    this.signupEmail = page.locator('#signup-email');
    this.signupPassword = page.locator('#signup-password');
    this.signinForm = page.locator('#signin-form');
    this.signinEmail = page.locator('#signin-email');
    this.signinPassword = page.locator('#signin-password');
  }

  async signup(email: string, password: string): Promise<void> {
    await this.signupEmail.fill(email);
    await this.signupPassword.fill(password);
    await this.signupForm.getByRole('button').click();
  }

  async signin(email: string, password: string): Promise<void> {
    await this.signinEmail.fill(email);
    await this.signinPassword.fill(password);
    await this.signinForm.getByRole('button').click();
  }
}
