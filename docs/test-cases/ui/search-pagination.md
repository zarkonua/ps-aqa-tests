# UI — Search & pagination (control wiring)

**User story:** _As a user, I want the search, sort and paging controls to actually drive the notes
list so that I can navigate my notes._

**Scope (UI-only):** that the on-screen controls are **wired** to the list and trigger a re-render
with the expected effect. The search/sort/pagination **logic** (which notes match, ordering rules,
the 50-item cap, owner scoping) is exhaustively covered at the API level — the UI only needs to
prove the controls call it and reflect the result.

**Selectors:** `#search-notes-form`, `#notes-search-query`, `#notes-search-field`,
`#notes-search-sort`, `#notes-page-size`, `#notes-page-info`, `#notes-prev-page`,
`#notes-next-page`, `#notes-list`.

## Test cases

| ID | Pri | Type | Title | Preconditions | Steps | Expected result | Coverage |
|---|---|---|---|---|---|---|---|
| UI-SP-01 | P1 | Positive | Search filters the visible list | Notes incl. one titled `"<tkn>"` | Type `<tkn>`, submit search | List narrows to the matching note(s) | search-pagination.spec |
| UI-SP-02 | P1 | Positive | Sort control reorders the list | ≥3 notes with distinct titles | Choose title asc / desc in `#notes-search-sort` | Visible order updates accordingly | search-pagination.spec |
| UI-SP-03 | P1 | Positive | Paging changes the page | More notes than one page | Click `#notes-next-page` then `#notes-prev-page` | Different notes shown per page; `#notes-page-info` updates; returns to page 1 | search-pagination.spec |
| UI-SP-04 | P2 | Positive | Page-size control | ≥ (size+1) notes | Set `#notes-page-size` to a small value | Visible count ≤ that value; paging controls enable | search-pagination.spec |
| UI-SP-05 | P2 | Positive | Empty-results state | Notes exist | Search a term that matches nothing | List renders an empty / "no notes" state, no error | search-pagination.spec |
| UI-SP-06 | P1 | Security | 🐞 Rapid paging → phantom pages | Multi-page dataset (>2 pages) | Click `#notes-next-page` ~8× rapidly | **Defect (verified):** paging buttons aren't disabled in-flight → the client page counter races ahead to phantom pages ("Page 9/9", 0 notes) though the true last page is 3; recovery is one-Prev-at-a-time. *Expected:* buttons lock during fetch / counter clamps at the last real page | search-pagination.spec `@concurrency` |
| UI-SP-07 | P2 | Negative | 🐞 Total label shows page count, not total | >1 page of notes | Read `#notes-list-total` | **Defect (verified):** shows e.g. "20 notes" (the visible page length) when the account has 41 — reads as an absolute count. *Expected:* "Showing X" / "X on this page" (the API exposes no total by design — API-SCALE-07) | search-pagination.spec |

## Covered at API level instead

| Was (UI) | Why it's not UI | Owning API case(s) |
|---|---|---|
| `title` vs `content` field targeting | Query-param logic | API-SEARCH-04/05 |
| Case-insensitivity, special chars | Filter semantics | API-SEARCH-13/14 |
| Sort correctness (asc/desc values) | Ordering logic | API-SEARCH-08…10 |
| Max page size (50), non-overlap, owner scoping | Pagination logic | API-PAGE-02/03/08 |
| Combined search + sort | Query composition | API-SEARCH-11 |

> The UI cases assert the **control → re-render** wiring with one representative each; they do not
> re-verify the underlying query behavior.
