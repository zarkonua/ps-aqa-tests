# API — Notes authorization & ownership

**User story:** _As a user, I want my notes to be private so that no other user can read or change
them._

**Rules:** every `/api/notes*` route requires `ROLE_USER` · notes are owner-scoped by
`NoteOwnerExtension` · accessing another user's note returns **`404`** (existence is hidden — no
`403` info leak) · a user's list/search contains only their own notes.

## Test cases

| ID | Pri | Type | Title | Preconditions | Steps / Data | Expected result | Coverage |
|---|---|---|---|---|---|---|---|
| API-AUTHZ-01 | P0 | Security | List requires auth | — | GET `/api/notes` with no token | `401`, `{code:401, message:"JWT Token not found"}` | notes-authz.spec |
| API-AUTHZ-02 | P0 | Security | Create requires auth | — | POST `/api/notes` with no token | `401` | notes-authz.spec |
| API-AUTHZ-03 | P0 | Security | Get/Put/Delete require auth | Some note id | Each verb on `/api/notes/{id}` with no token | `401` | notes-authz.spec |
| API-AUTHZ-04 | P0 | Security | User B cannot read A's note | A created a note; B authed | B GET `/api/notes/{A_note_id}` | `404` (not `403`, not `200`) | notes-authz.spec |
| API-AUTHZ-05 | P0 | Security | User B cannot update A's note | as above | B PUT `/api/notes/{A_note_id}` `{title,content}` | `404`; A's note unchanged | notes-authz.spec |
| API-AUTHZ-06 | P0 | Security | User B cannot delete A's note | as above | B DELETE `/api/notes/{A_note_id}` | `404`; A's note still exists | notes-authz.spec |
| API-AUTHZ-07 | P1 | Security | List is owner-scoped | A and B each created notes | A GET `/api/notes` | Only A's notes returned; none of B's | notes-authz.spec |
| API-AUTHZ-08 | P1 | Negative | Get non-existent note | Authed user | GET `/api/notes/<random-uuid>` | `404` (indistinguishable from "not owner") | notes-authz.spec |
| API-AUTHZ-09 | P2 | Security | Invalid/expired token on notes | Malformed token | GET `/api/notes` | `401 Invalid JWT Token` | notes-authz.spec |
| API-AUTHZ-10 | P2 | Security | Search is owner-scoped | A and B have notes matching a term | A searches `q=<term>` | Only A's matches (see search doc) | notes-authz.spec |
| API-AUTHZ-11 | P3 | Security | Malformed note id | Authed user | GET `/api/notes/not-a-uuid` | `404` (or `400`), no server error/stack trace | notes-authz.spec |

**Key assertion:** cross-user access consistently returns `404` — verified in `healthy` mode. Any
`403`/`200` here would be a critical ownership-leak defect.
