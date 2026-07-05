# API — Notes validation (`POST` / `PUT /api/notes`)

**User story:** _As a user, I want clear validation on note fields so that malformed notes are
rejected._

**Rules:** `title` NotBlank, 1–255 chars, trimmed · `content` NotBlank, 1–10 000 chars ·
violations → **`422 application/problem+json`**:

```json
{ "status": 422,
  "violations": [ { "propertyPath": "title", "message": "Title is required.", "code": "…" } ],
  "detail": "title: Title is required.",
  "title": "An error occurred" }
```

## Boundaries

| Field | Value | Type | Expected |
|---|---|---|---|
| title | 1 char | boundary (min) | 201 |
| title | 255 chars | boundary (max) | 201 |
| title | 256 chars | invalid (above max) | 422 `Title cannot be longer than 255 characters.` |
| title | `""` / missing | invalid | 422 `Title is required.` / `Title cannot be empty.` |
| title | `"   "` (spaces) | invalid (trimmed → empty) | 422 |
| content | 1 char | boundary (min) | 201 |
| content | 10 000 chars | boundary (max) | 201 |
| content | 10 001 chars | invalid (above max) | 422 `Content cannot be longer than 10000 characters.` |
| content | `""` / missing | invalid | 422 `Content is required.` |

## Test cases

| ID | Pri | Type | Title | Preconditions | Steps / Data | Expected result | Coverage |
|---|---|---|---|---|---|---|---|
| API-VAL-01 | P1 | Negative | Empty title | Authed | POST `{title:"", content:"x"}` | `422`; `violations[].propertyPath` includes `title`; message `Title is required.` | notes-validation.spec |
| API-VAL-02 | P1 | Negative | Missing title field | Authed | POST `{content:"x"}` | `422`, violation on `title` | notes-validation.spec |
| API-VAL-03 | P1 | Negative | Empty content | Authed | POST `{title:"ok", content:""}` | `422`, violation on `content` (`Content is required.`) | notes-validation.spec |
| API-VAL-04 | P1 | Negative | Missing content field | Authed | POST `{title:"ok"}` | `422`, violation on `content` | notes-validation.spec |
| API-VAL-05 | P1 | Boundary | Title min/max valid | Authed | title = 1 char; title = 255 chars | Both `201` | notes-validation.spec |
| API-VAL-06 | P1 | Boundary | Title above max | Authed | title = 256 chars | `422`, `Title cannot be longer than 255 characters.` | notes-validation.spec |
| API-VAL-07 | P1 | Boundary | Content min/max valid | Authed | content = 1 char; content = 10 000 chars | Both `201` | notes-validation.spec |
| API-VAL-08 | P1 | Boundary | Content above max | Authed | content = 10 001 chars | `422`, `Content cannot be longer than 10000 characters.` | notes-validation.spec |
| API-VAL-09 | P2 | Negative | Whitespace-only title | Authed | POST `{title:"   ", content:"x"}` | `422` (trimmed to empty) | notes-validation.spec |
| API-VAL-10 | P2 | Contract | Error envelope shape | Authed | Any invalid POST | `content-type: application/problem+json`; body has `status:422`, `violations[]` with `propertyPath`+`message`, `title:"An error occurred"` | notes-validation.spec |
| API-VAL-11 | P1 | Negative | Validation applies on update | Note exists | PUT `{title:"", content:""}` | `422` (same rules as create) | notes-validation.spec |
| API-VAL-12 | P2 | Positive | Title is trimmed | Authed | POST `{title:"  Hi  ", content:"x"}` | `201`; stored `title` = `"Hi"` | notes-validation.spec |
| API-VAL-13 | P3 | Negative | Wrong field types | Authed | POST `{title:123, content:true}` | `422`/`400`, no `500` | notes-validation.spec |
| API-VAL-14 | P2 | Security | Script/HTML accepted, escaped on render | Authed | POST `{title:"<script>alert(1)</script>", content:"x"}` | `201`; stored verbatim (escaping is the UI's job — cross-ref UI-NOTE-09) | notes-validation.spec |
| API-VAL-15 | P2 | Negative | Whitespace-only content asymmetry | Authed | POST `{title:"ok", content:"   "}` | **`201`** — `content` is **not trimmed** (unlike `title`, which would `422` when whitespace-only). Documents the inconsistency (**GAP-4**) | notes-validation.spec |

**Built-in schema check:** the `422` envelope in these cases is *additionally* validated against the
`ConstraintViolation`/`Error` schema inline (API-CONTRACT-05) — see [contract-schema.md](contract-schema.md).
