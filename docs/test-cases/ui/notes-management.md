# UI — Notes management

**User story:** _As a signed-in user, I want to create, edit and delete notes through the app so
that I can manage my content visually._

**Scope (UI-only):** form→list rendering, the delete **confirmation modal**, live list/counter
updates, in-browser **content rendering** and **HTML-escaping**. The CRUD contract and field
validation are owned by the API layer.

**Selectors:** `#create-note-form`, `#note-title`, `#note-content`, `#notes-list`,
`#notes-list-total`; note cards `.panel`; delete modal `.modal-actions` (Delete / Cancel).

## Test cases

| ID | Pri | Type | Title | Preconditions | Steps | Expected result | Coverage |
|---|---|---|---|---|---|---|---|
| UI-NOTE-01 | P0 | Positive | Create a note (form → list) | Signed in, notes view | Fill title + content, submit create form | New `.panel` appears in `#notes-list` with entered title & content; `#notes-list-total` increments | notes-management.spec |
| UI-NOTE-02 | P0 | Positive | Edit a note reflects in list | ≥1 note exists | Edit a note, change title/content, save | Card shows updated values; persists after reload | notes-management.spec |
| UI-NOTE-03 | P0 | Positive | Delete via confirmation modal | ≥1 note exists | Click Delete on a card → confirm in modal | Modal reads `Delete note "<title>"?`; on confirm the card is removed; total decrements | notes-management.spec |
| UI-NOTE-04 | P1 | Positive | Cancel deletion | ≥1 note exists | Click Delete → Cancel | Note remains; list unchanged | notes-management.spec |
| UI-NOTE-05 | P1 | Positive | List & counter update without refresh | Signed in | Create then delete a note | `#notes-list` and `#notes-list-total` update immediately (SPA re-render), no manual reload | notes-management.spec |
| UI-NOTE-06 | P1 | Negative | Invalid create is surfaced | Signed in | Submit create form with empty title | Error shown; note **not** added to list _(representative — field-by-field validation is API-tested)_ | notes-management.spec |
| UI-NOTE-07 | P1 | Positive | Content is rendered | Note with distinctive content | View the note card | Content is visible and matches what was entered (broken mode blanks content → card shows empty) | notes-management.spec |
| UI-NOTE-08 | P2 | Security | XSS is escaped in the browser | Signed in | Create note with title/content `<script>alert(1)</script>` | Rendered as literal text; **no** script executes (no alert). _Can only be verified in a browser — API stores it verbatim (API-VAL-14)_ | notes-management.spec |
| UI-NOTE-09 | P1 | Security | 🐞 Double-click create → duplicate notes | Signed in | Double-click **Create** with the same title/content | **Defect (verified):** button not disabled in-flight → two `POST`s → **two identical notes**. Same missing-guard pattern as sign-up (UI-REG-06) and pagination (UI-SP-06). *Expected:* button locks/debounces during submit | notes-management.spec `@concurrency` |
| UI-NOTE-10 | P2 | Negative | 🐞 Edit modal discards input on validation failure | ≥1 note exists | In the edit modal, submit an invalid value (e.g. 256-char title) | **Defect (verified):** modal closes on `422`, error only in `#status`, typed values lost — inconsistent with the create form (which preserves input). *Expected:* modal stays open, inline error, input preserved | notes-management.spec |

## Covered at API level instead

| Was (UI) | Why it's not UI | Owning API case(s) |
|---|---|---|
| Empty title / empty content / length limits | Validation contract (`422`) | API-VAL-01…08 |
| Note content round-trips (data) | Data integrity over HTTP | API-NOTE-03 |
| Unicode/emoji stored correctly | Storage correctness | API-NOTE-13 |
| Long content accepted | Boundary contract | API-VAL-07 |

> UI-NOTE-07 (renders content) and UI-NOTE-08 (escapes HTML) are the genuinely UI-only checks — the
> browser is where blanked content and unescaped markup would actually manifest.
