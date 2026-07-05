# API — Notes pagination (`GET /api/notes`)

**User story:** _As a user with many notes, I want the list paginated so that responses stay small
and navigable._

**Parameters:** `page` (1-based) · `itemsPerPage` (client-controlled) · **default 30**, **capped at
50**. The collection is a plain array with **no total/count field** — page size is observed via array
length and page navigation, and clients can only discover the end by paging to a short/empty page.

**Verified numbers (55-note set):** no params → 30 · `itemsPerPage=100` → 50 · `page=2` → 25 ·
`page=3` → 0.

## Boundaries — `itemsPerPage`

| Value | Type | Expected |
|---|---|---|
| 1 | boundary (min useful) | ≤ 1 item |
| 10 | valid (default-ish) | ≤ 10 items |
| 50 | boundary (max) | ≤ 50 items |
| 100 | above max | capped at **50** items |
| 0 / -1 / `abc` | invalid | graceful handling (default or `400`), no `500` |

## Test cases

| ID | Pri | Type | Title | Preconditions | Steps / Data | Expected result | Coverage |
|---|---|---|---|---|---|---|---|
| API-PAGE-01 | P1 | Positive | Page size honored | ≥ 5 notes owned | GET `?itemsPerPage=2` | Array length ≤ 2 | notes-pagination.spec |
| API-PAGE-02 | P1 | Positive | Page navigation, no overlap | ≥ 4 notes owned | GET `?itemsPerPage=2&page=1` then `page=2` | Disjoint id sets across pages | notes-pagination.spec |
| API-PAGE-03 | P1 | Boundary | Max page size enforced | ≥ 51 notes owned (seed) | GET `?itemsPerPage=100` | Array length ≤ **50** | notes-pagination.spec |
| API-PAGE-04 | P2 | Boundary | Page beyond last | Few notes owned | GET `?page=9999` | `200`, empty array `[]` | notes-pagination.spec |
| API-PAGE-05 | P2 | Positive | Default page size is 30 | ≤30 notes owned | GET `/api/notes` | `200`, array length ≤ 30 (the default `items_per_page`) | notes-pagination.spec |
| API-PAGE-06 | P2 | Boundary | Minimum page size | ≥ 2 notes | GET `?itemsPerPage=1` | Exactly 1 item per page | notes-pagination.spec |
| API-PAGE-07 | P3 | Negative | Invalid page/size values | Notes owned | GET `?page=-1&itemsPerPage=0` (and `abc`) | Graceful: default behavior or `400`; never `500` | notes-pagination.spec |
| API-PAGE-08 | P1 | Security | Pagination scoped to owner | A and B both have many notes | A paginates full list | Only A's notes counted/returned across pages | notes-pagination.spec |
| API-PAGE-09 | P3 | Positive | Full traversal covers all | N notes owned | Walk all pages accumulating ids | Union = all N ids, no duplicates | notes-pagination.spec |

**Note:** since the collection is a plain array with no pagination envelope, "total" is not
returned by the API — page-size and non-overlap assertions rely on array contents.

---

## Large dataset — list query at scale

Behaviors that only appear with **more notes than one page** (> 30). These prove that filtering,
sorting and paging happen **server-side across the whole set** and then paginate — not just within a
returned page.

### Seeding a large list

| Approach | Speed (55 notes) | Use when |
|---|---|---|
| API — sequential POSTs | ~7 s | small N; ordering by `created_at` matters (deterministic order) |
| **API — bounded pool (~20 workers)** | **~1.4 s** | black-box, N ≲ 100, order not asserted (or sorting by title) |
| **DB seam — bulk `INSERT`** (`@db`) | ~ms | large N (100s), or when timestamps must be controlled |

A `seedNotes(notesApi, count, build, concurrency = 20)` helper (bounded worker pool, reusing one
authenticated context) covers the API path. **Caveat:** concurrent creation makes `created_at`
order non-deterministic — for `sort[updatedAt]` assertions seed sequentially or set timestamps via
the DB seam ([advanced-gray-box.md](advanced-gray-box.md)); title-based sort is unaffected. Going
much wider than ~20 workers slows down (single Dockerized MySQL).

| ID | Pri | Type | Title | Preconditions | Steps | Expected result | Coverage |
|---|---|---|---|---|---|---|---|
| API-SCALE-01 | P1 | Boundary | Big list is capped at the default | ~40 notes owned | GET `/api/notes` (no params) | `200`, **exactly 30** returned — **not all 40** (the rest are on later pages) | notes-pagination.spec `@db` |
| API-SCALE-02 | P1 | Positive | Full traversal reconstructs the set | N = 55 notes owned | Page through with `itemsPerPage=50` (pages 1..2) | Page sizes `[50, 5]`; union of ids = all 55; **no overlap, none missing** | notes-pagination.spec `@db` |
| API-SCALE-03 | P1 | Positive | Needle in a haystack (search) | N notes, one with a unique marker | GET `?q=<marker>` | Exactly the 1 matching note, regardless of which page it would fall on | notes-search.spec `@db` |
| API-SCALE-04 | P2 | Positive | Sort is global, then paginated | N notes with ordered titles `Note 000…Note 054` | GET `?sort[title]=asc` | Page 1 **starts at the globally smallest** title (`Note 000`), not merely the first-created; ordering continues correctly across page boundaries | notes-search.spec `@db` |
| API-SCALE-05 | P2 | Performance | List & search respond at scale | N notes owned | Time GET list and GET `?q=<marker>` | Both complete within a soft threshold (e.g. < 1 s); recorded, non-blocking | notes-pagination.spec `@db` |
| API-SCALE-06 | P2 | Security | Scale is owner-scoped | A has many notes, B has many | A pages through the full list | Only A's notes across all pages; B's never appear | notes-pagination.spec `@db` |
| API-SCALE-07 | P3 | Contract | No total exposed | ≥ 31 notes owned | GET default page | Response is a bare array (no `total`/`count`/`next`) — client must page to a short/empty page to detect the end. **Documented limitation** | notes-pagination.spec |

> **Finding:** with no total/count and a bare-array response, a client cannot know how many notes
> exist or whether more pages remain without walking pages until one comes back short — worth
> flagging as a usability/contract limitation (the SPA's own Hydra-handling code is dead here).
