import type { APIRequestContext } from '@playwright/test';
import type { MailhogMessage, MailhogSearchResponse } from '../models/mailhog.model';

/**
 * Reads sign-up confirmation emails from MailHog.
 *
 * Emails are multipart/alternative with quoted-printable encoding, so the raw
 * body must be decoded before the 6-digit code / confirmation link can be
 * extracted. The confirmation link is also validated by tests as a broken-mode
 * catcher (broken mode points it at a bogus host).
 */
export class MailhogClient {
  constructor(private readonly request: APIRequestContext) {}

  /** Decode quoted-printable: unfold soft breaks and =HH escapes. */
  static decodeQuotedPrintable(body: string): string {
    return body
      .replace(/=\r\n/g, '')
      .replace(/=\n/g, '')
      .replace(/=([0-9A-Fa-f]{2})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  private async search(email: string): Promise<MailhogMessage[]> {
    const res = await this.request.get(
      `/api/v2/search?kind=to&query=${encodeURIComponent(email)}`,
    );
    if (!res.ok()) {
      return [];
    }
    const json = (await res.json()) as MailhogSearchResponse;
    return json.items ?? [];
  }

  /** Poll until at least one message for `email` arrives, then return the newest. */
  async waitForLatestMessage(email: string, timeoutMs = 10_000): Promise<MailhogMessage> {
    const deadline = Date.now() + timeoutMs;
    let items: MailhogMessage[] = [];
    while (Date.now() < deadline) {
      items = await this.search(email);
      if (items.length > 0) {
        return items[0];
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`No email received for ${email} within ${timeoutMs}ms`);
  }

  /** Decoded plain-text/html body of the newest message for `email`. */
  async getDecodedBody(email: string, timeoutMs = 10_000): Promise<string> {
    const message = await this.waitForLatestMessage(email, timeoutMs);
    return MailhogClient.decodeQuotedPrintable(message.Content.Body);
  }

  /** Extract the 6-digit confirmation code from the newest email. */
  async getConfirmationCode(email: string, timeoutMs = 10_000): Promise<string> {
    const body = await this.getDecodedBody(email, timeoutMs);
    const match = body.match(/confirm_code=(\d{6})/);
    if (!match) {
      throw new Error(`Confirmation code not found in email for ${email}`);
    }
    return match[1];
  }

  /**
   * All confirmation codes delivered to `email`, newest first. Used by the
   * multiple-live-codes / verified-guard defect cases, which need to reference
   * both an older and a newer code for the same recipient.
   */
  async getConfirmationCodes(email: string, minCount = 1, timeoutMs = 10_000): Promise<string[]> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const items = await this.search(email);
      const codes = items
        .map((m) => MailhogClient.decodeQuotedPrintable(m.Content.Body).match(/confirm_code=(\d{6})/)?.[1])
        .filter((c): c is string => Boolean(c));
      if (codes.length >= minCount) {
        return codes;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Expected >= ${minCount} confirmation code(s) for ${email}`);
  }

  /** Extract the full confirmation link from the newest email. */
  async getConfirmationLink(email: string, timeoutMs = 10_000): Promise<string> {
    const body = await this.getDecodedBody(email, timeoutMs);
    const match = body.match(/https?:\/\/\S+confirm_code=\d{6}/);
    if (!match) {
      throw new Error(`Confirmation link not found in email for ${email}`);
    }
    return match[0];
  }
}
