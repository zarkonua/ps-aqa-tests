# API — Notes search, filter & sort (`GET /api/notes`)

**User story:** _As a user with many notes, I want to search and sort them so that I can find the
right note quickly._

**Query parameters:** `q` (free-text over `title` + `content`, partial) · `title` (partial) ·
`content` (partial) · `sort[updatedAt]` (`asc`/`desc`) · `sort[title]` (`asc`/`desc`). All results
are owner-scoped.

## Test cases

| ID | Pri | Type | Title | Preconditions | Steps / Data | Expected result | Coverage |
|---|---|---|---|---|---|---|---|
| API-SEARCH-01 | P1 | Positive | `q` matches title | Note titled `"Alpha <tkn>"` exists | GET `?q=<tkn>` | Array contains that note | notes-search.spec |
| API-SEARCH-02 | P1 | Positive | `q` matches content | Note with `<tkn>` in content | GET `?q=<tkn>` | Note returned | notes-search.spec |
| API-SEARCH-03 | P1 | Positive | `q` partial match | Note title `"Meeting notes"` | GET `?q=eeti` | Note returned (substring match) | notes-search.spec |
| API-SEARCH-04 | P1 | Positive | `title` filter targets title only | Note A has `<tkn>` in title; Note B has `<tkn>` only in content | GET `?title=<tkn>` | Returns A, **not** B | notes-search.spec |
| API-SEARCH-05 | P1 | Positive | `content` filter targets content only | as above | GET `?content=<tkn>` | Returns B, **not** A | notes-search.spec |
| API-SEARCH-06 | P1 | Security | Search is owner-scoped | A and B both have a note with `<tkn>` | A GET `?q=<tkn>` | Only A's note; none of B's | notes-search.spec |
| API-SEARCH-07 | P2 | Negative | No matches | No note contains `<rare>` | GET `?q=<rare>` | `200`, empty array `[]` | notes-search.spec |
| API-SEARCH-08 | P1 | Positive | Sort by title ascending | Notes `"Banana","Apple","Cherry"` | GET `?sort[title]=asc` | Titles ordered `Apple, Banana, Cherry` | notes-search.spec |
| API-SEARCH-09 | P1 | Positive | Sort by title descending | as above | GET `?sort[title]=desc` | `Cherry, Banana, Apple` | notes-search.spec |
| API-SEARCH-10 | P1 | Positive | Sort by updatedAt | 3 notes updated in known order | GET `?sort[updatedAt]=desc` | Most-recently-updated first | notes-search.spec |
| API-SEARCH-11 | P2 | Positive | Search + sort combined | Several matching notes | GET `?q=<tkn>&sort[title]=asc` | Matches only, sorted by title | notes-search.spec |
| API-SEARCH-12 | P2 | Boundary | Empty `q` | Notes exist | GET `?q=` | Returns notes (empty filter → all owned), no error | notes-search.spec |
| API-SEARCH-13 | P2 | Positive | Case-insensitivity | Note `"Alpha"` | GET `?q=alpha` | Note returned (document actual behavior if case-sensitive) | notes-search.spec |
| API-SEARCH-14 | P3 | Negative | Special characters in `q` | Authed user | GET `?q=%25_'` | `200`, no server error; treated as literal | notes-search.spec |
| API-SEARCH-15 | P3 | Negative | Unknown sort direction | Notes exist | GET `?sort[title]=sideways` | Handled gracefully (default order or ignored), no `500` | notes-search.spec |
