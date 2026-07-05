# UI — Auth gating (client-side)

**User story:** _As the app, I want to show the right view for the current session so that
unauthenticated visitors see the auth screen and authenticated users see their notes._

**Scope (UI-only):** the **client-side decision** of which view to render based on the token, and
how the SPA reacts to an unauthorized API response. The actual data protection is server-side and
owned by the API (`API-AUTHZ-*`); the page shell at `/`, `/app`, `/account/*` is public and
data-free, so there is nothing to "leak" and no server redirect to test.

## Test cases

| ID | Pri | Type | Title | Preconditions | Steps | Expected result | Coverage |
|---|---|---|---|---|---|---|---|
| UI-GUARD-01 | P0 | Security | Unauthenticated renders auth screen | No token in `localStorage` | Open `/app` | Sign-in and sign-up forms visible; notes/profile **not** rendered | auth-navigation.spec |
| UI-GUARD-02 | P1 | Security | App reacts to a `401` | `localStorage` token is invalid/expired | Load `/app` | SPA treats the API `401` as unauthenticated and shows the auth screen (no error/blank state) | auth-navigation.spec |
| UI-GUARD-03 | P2 | Positive | Valid session renders the app | Valid token in `localStorage` | Load `/app` | Notes view shown without re-login | auth-navigation.spec |

## Covered at API level instead

| Was (UI) | Why it's not UI | Owning API case(s) |
|---|---|---|
| Deep-link `/account/notes` while unauth "leaks" nothing | Page shell is public & data-free; data is gated server-side | API-AUTHZ-01…03 (+ UI-GUARD-01 for the render) |
| Protected views inaccessible after logout | Session render handled by UI-GUARD-01 + logout in UI-REG-04; data gated by API | API-AUTHZ-*, UI-REG-04 |
| Root-path routing loads app | Trivial page load; no distinct behavior | — (folded into UI-GUARD-01/03) |
