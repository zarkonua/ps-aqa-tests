# UI — Profile

**User story:** _As a signed-in user, I want a profile view so that I can see my account details in
the app._

**Scope (UI-only):** that the profile view **renders** the account details and that navigation
between views works. The correctness of the data itself is the API's `GET /api/auth/me` contract.

**Selectors:** `#nav-profile-button`, `#nav-notes-button`, `#profile-view`, `#profile-email`,
`#profile-id`.

## Test cases

| ID | Pri | Type | Title | Preconditions | Steps | Expected result | Coverage |
|---|---|---|---|---|---|---|---|
| UI-PROF-01 | P1 | Positive | Profile view renders details | Signed in | Click `#nav-profile-button` | `#profile-view` visible; `#profile-email` shows the user's email; `#profile-id` shows a UUID | profile.spec |
| UI-PROF-02 | P2 | Positive | Navigate notes ↔ profile | Signed in | Toggle `#nav-profile-button` / `#nav-notes-button` | Correct view shown each time; no reload | profile.spec |
| UI-PROF-03 | P2 | Negative | 🐞 Long email overflows layout | Signed in with a long email (≤190 chars) | Open profile with a ~132-char email | **Defect (verified):** `#profile-email` doesn't wrap (`overflow-wrap:normal`) → element exceeds the viewport and the page gets a **horizontal scrollbar**. *Expected:* wrap/truncate; no page-level horizontal scroll | profile.spec |

## Covered at API level instead

| Was (UI) | Why it's not UI | Owning API case(s) |
|---|---|---|
| Profile values match `/api/auth/me` | Data correctness over HTTP | API-ME-01 |
| Profile requires auth | Access control | API-ME-02 + UI-GUARD-01 |
