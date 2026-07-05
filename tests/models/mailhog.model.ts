/** Minimal subset of the MailHog v2 message shape that we consume. */
export interface MailhogMessage {
  ID: string;
  Content: {
    Headers: Record<string, string[]>;
    Body: string;
  };
}

export interface MailhogSearchResponse {
  total: number;
  count: number;
  start: number;
  items: MailhogMessage[];
}
