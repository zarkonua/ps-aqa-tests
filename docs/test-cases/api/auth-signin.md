# API — Sign in (`POST /api/auth/signin`)

**User story:** _As a verified user, I want to sign in with my email and password so that I
receive a JWT to access my notes._

**Rules (json_login / lexik JWT):** success `200 {token}` · wrong password `401 Invalid credentials.` ·
unknown user `401 Invalid credentials.` (same message → no enumeration) · **unverified** user
`401 Email is not confirmed.` · email matched case-insensitively.

## Test cases

| ID | Pri | Type | Title | Preconditions | Steps / Data | Expected result | Coverage |
|---|---|---|---|---|---|---|---|
| API-SIGNIN-01 | P0 | Positive | Sign in with valid credentials | Verified user exists | POST `{email, password}` | `200`, body `{token:<JWT>}` | auth-signin.spec |
| API-SIGNIN-02 | P0 | Negative | Wrong password | Verified user exists | POST `{email, password:"wrongpass1"}` | `401`, `{code:401, message:"Invalid credentials."}` | auth-signin.spec |
| API-SIGNIN-03 | P1 | Negative | Unverified user cannot sign in | User signed up but not confirmed | POST `{email, password}` | `401`, `{code:401, message:"Email is not confirmed."}` | auth-signin.spec |
| API-SIGNIN-04 | P1 | Security | Unknown user — no enumeration | Email never registered | POST `{email:<random>, password}` | `401`, `{message:"Invalid credentials."}` — **identical** to wrong-password case | auth-signin.spec |
| API-SIGNIN-05 | P1 | Negative | Missing credentials | — | POST `{}` / only email / only password | `401` (or `400`), no token | auth-signin.spec |
| API-SIGNIN-06 | P2 | Positive | Token is usable | Signed in | Call `/api/auth/me` with returned token | `200 {id, email}` | auth-signin.spec |
| API-SIGNIN-07 | P2 | Positive | Email case-insensitive | Verified `user@example.com` | POST `{email:"USER@example.com", password}` | `200 {token}` | auth-signin.spec |
| API-SIGNIN-08 | P2 | Contract | Exact shape | Verified user | Valid sign in | Body is **exactly** `{token}` (no `message`, unlike confirm). Broken mode's `JwtAuthenticationSuccessSubscriber` emits `{jwt,message}`/`{access_token,status}` — caught here | auth-signin.spec |
| API-SIGNIN-09 | P3 | Negative | Wrong content type / form body | Verified user | POST as `application/x-www-form-urlencoded` | Rejected (`400`/`401`), no token | auth-signin.spec |
| API-SIGNIN-10 | P1 | Security | 🐞 No lockout / rate-limiting | Verified user | Fire ~20 wrong-password attempts, then a correct one | **Defect (verified):** all `401` (zero `429`, no delay), and the correct password logs in **immediately** after — unlimited brute-force. *Expected:* per-account/IP throttle or lockout after N failures | auth-signin.spec `@security` |

**Notes / risks:** the distinct `Email is not confirmed.` message reveals that an account exists
(partial enumeration) — record as a security observation. No lockout on repeated failures.
