# UI — Authentication journey & session

**User story:** _As a visitor, I want to register, sign in and out through the app so that I can
access my notes and end my session._

**Scope (UI-only):** the full sign-up → email-link → authenticated browser journey, form→view
transitions, that API errors are **surfaced** to the user, and client-side **session lifecycle**
(token in `localStorage["qa_task_token"]`, persistence, logout). The auth *logic* (which inputs are
valid, status codes, email content) is owned by the API layer.

**Selectors:** `#signup-form`, `#signup-email`, `#signup-password`, `#signin-form`, `#signin-email`,
`#signin-password`, `#status`, `#logout-button`, `#notes-view`.

## Test cases

| ID | Pri | Type | Title | Preconditions | Steps | Expected result | Coverage |
|---|---|---|---|---|---|---|---|
| UI-REG-01 | P0 | Positive | End-to-end registration journey | App open, unauthenticated | 1) Fill sign-up email+password, submit  2) Read confirmation link from MailHog  3) Open the link | Signup success surfaced; opening the link auto-confirms and lands the user **authenticated** on `#notes-view` | registration.spec |
| UI-REG-02 | P0 | Positive | Sign in through the form | Verified user exists | Enter valid credentials in `#signin-form`, submit | View transitions to notes; `#logout-button` visible; token stored | registration.spec |
| UI-REG-03 | P1 | Negative | API error is surfaced to the user | Verified user exists | Sign in with a wrong password | Error message shown in `#status`; stays on auth screen; **no** token stored _(representative — per-input validation is API-tested)_ | registration.spec |
| UI-REG-04 | P1 | Positive | Logout clears the session | Signed in | Click `#logout-button` | Auth forms shown again; `qa_task_token` removed from `localStorage` | registration.spec |
| UI-REG-05 | P2 | Positive | Session persists on reload | Signed in | Reload the page | Still authenticated (token rehydrated from `localStorage`) | registration.spec |
| UI-REG-06 | P1 | Security | 🐞 Sign-up submit not guarded against double-click | Unauthenticated | Double-click **Sign Up** on a fresh email | **Defect (verified):** button is **not disabled** → two `POST`s fire; the racing duplicate returns `500` and the raw DB error can be rendered verbatim in `#status` (timing-dependent). *Expected:* button locks during submit; errors never expose raw SQL. Pairs with `API-SIGNUP-19` | registration.spec |

## Covered at API level instead

| Was (UI) | Why it's not UI | Owning API case(s) |
|---|---|---|
| Confirmation link points to app host | Email content is HTTP, no browser needed | **API-SIGNUP-02** |
| Sign-in wrong password / unknown user / unverified | Status + message are API contract | API-SIGNIN-02/03/04 |
| Sign-up invalid email / short password / duplicate | Validation is API contract | API-SIGNUP-04/08/09 |
| Confirmation with wrong code | Business logic + status | API-CONFIRM-03 |
| Email captured in MailHog | Integration check over HTTP | API-SIGNUP-02 |

> One representative "error is surfaced" case (UI-REG-03) proves the UI renders API errors; the full
> matrix of *which* inputs are invalid lives in the API docs.
