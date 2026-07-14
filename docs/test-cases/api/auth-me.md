# API — Profile (`GET /api/auth/me`)

**User story:** _As an authenticated user, I want to fetch my profile so that the app can show
who I am._

**Rules:** requires `ROLE_USER` (Bearer JWT) · success `200 {id, email}` · missing token
`401 {code, message:"JWT Token not found"}` · invalid token `401 {code, message:"Invalid JWT Token"}`.

## Test cases

| ID | Pri | Type | Title | Preconditions | Steps / Data | Expected result | Coverage |
|---|---|---|---|---|---|---|---|
| API-ME-01 | P0 | Positive | Get own profile | Valid JWT | GET with `Authorization: Bearer <token>` | `200`, body **exactly** `{id, email}`; values match the signed-in user | auth-me.spec |
| API-ME-02 | P1 | Negative | Missing Authorization header | — | GET with no header | `401`, `{code:401, message:"JWT Token not found"}` | auth-me.spec |
| API-ME-03 | P1 | Negative | Malformed / garbage token | — | GET `Authorization: Bearer not.a.jwt` | `401`, `{code:401, message:"Invalid JWT Token"}` | auth-me.spec |
| API-ME-04 | P2 | Negative | Wrong auth scheme | — | GET `Authorization: Basic dXNlcjpwYXNz` | `401` | auth-me.spec |
| API-ME-05 | P2 | Negative | Expired token | Token past its `exp` _(time-dependent — manual or short-lived token)_ | GET with expired token | `401` (expired) | manual |
| API-ME-06 | P2 | Contract | Exact shape | Valid JWT | GET `/me` | Body keys **exactly** `id` + `email` (broken mode emits `user_id`/`mail`/`profile`) | auth-me.spec |
| API-ME-07 | P2 | Security | Token of deleted user | User deleted after issuing token _(if deletion available)_ | GET with old token | `401` / access denied | manual |
| API-ME-08 | P3 | Negative | Empty Bearer value | — | GET `Authorization: Bearer ` | `401` | auth-me.spec |
| API-ME-09 | P2 | Security | 🐞 Token still valid after logout | Signed in; JWT captured | Log out (client clears `localStorage`), then GET `/me` with the captured token | **Defect (verified):** `200 {id,email}` — logout is client-side only, no server-side revocation; token works for its full ~60-min TTL. *Expected:* revoked token → `401` | auth-me.spec |

**Notes:** `id` should be a UUID v4 and `email` the normalized (lower-cased) address.

**Schema check:** the `/me` body is *additionally* validated strictly against `{id,email}` in the
dedicated contract spec (this is the API-CONTRACT-06 broken-mode gate) — see
`tests/api/contract.spec.ts`.
