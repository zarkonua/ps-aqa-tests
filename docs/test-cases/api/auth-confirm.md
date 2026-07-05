# API — Confirm sign-up (`POST /api/auth/confirm`)

**User story:** _As a registered user, I want to confirm my account with the emailed code so that
I become verified and receive an access token._

**Rules:** email + code required · code must match `^\d{6}$` · user must exist · code must be
active (not used, not older than 10 min) · success `201 {token, message:"Account confirmed."}` ·
code is **single-use**; on success the user becomes verified.

## Equivalence classes — code

| Class | Type | Example | Expected |
|---|---|---|---|
| Correct active code | valid | `<real code>` | 201 + token |
| Wrong 6-digit code | invalid | `000000` (not the real one) | 400 `Invalid or expired confirmation code.` |
| 5 digits | invalid (format) | `12345` | 400 `Confirmation code must be exactly 6 digits.` |
| 7 digits | invalid (format) | `1234567` | 400 `Confirmation code must be exactly 6 digits.` |
| Non-numeric | invalid (format) | `12a456` | 400 `Confirmation code must be exactly 6 digits.` |
| Empty | invalid (format) | `` | 400 `Confirmation code must be exactly 6 digits.` |

## Test cases

| ID | Pri | Type | Title | Preconditions | Steps / Data | Expected result | Coverage |
|---|---|---|---|---|---|---|---|
| API-CONFIRM-01 | P0 | Positive | Confirm with valid code | User signed up; code read from MailHog | POST `{email, code:<real>}` | `201`, body `{token:<JWT>, message:"Account confirmed."}`; token works on `/me` | auth-confirm.spec |
| API-CONFIRM-02 | P0 | Positive | Account becomes verified | Confirmed via API-CONFIRM-01 | Sign in with same credentials | `200 {token}` (no "not confirmed") | auth-confirm.spec |
| API-CONFIRM-03 | P1 | Negative | Wrong code | User signed up | POST `{email, code:"000000"}` (≠ real) | `400`, `{error:"Invalid or expired confirmation code."}` | auth-confirm.spec |
| API-CONFIRM-04 | P1 | Negative | Code is single-use | Code already used successfully | POST same `{email, code}` again | `400`, `{error:"Invalid or expired confirmation code."}` | auth-confirm.spec |
| API-CONFIRM-05 | P1 | Boundary | Malformed code lengths/chars | User signed up | POST each invalid code from EC table | `400`, `{error:"Confirmation code must be exactly 6 digits."}` | auth-confirm.spec |
| API-CONFIRM-06 | P2 | Negative | Unknown email | No user for email | POST `{email:<random>, code:"123456"}` | `400`, `{error:"User not found."}` | auth-confirm.spec |
| API-CONFIRM-07 | P1 | Negative | Missing email or code | — | POST `{}` / `{email}` / `{code}` | `400` with relevant `{error}` | auth-confirm.spec |
| API-CONFIRM-08 | P1 | Negative | Expired code | Signed up | Force expiry via the DB seam, then POST `{email, code}` — see [advanced-gray-box.md](advanced-gray-box.md) | `400`, `{error:"Invalid or expired confirmation code."}` | auth-confirm.spec `@db` |
| API-CONFIRM-09 | P2 | Contract | 🔴 gate — exact status & shape | User signed up | Valid confirm | Status **exactly `201`**; body keys **exactly** `token` + `message` (broken mode emits `jwt`/`access_token`/`status`) | auth-confirm.spec |
| API-CONFIRM-10 | P2 | Positive | Re-issued code confirms | Unverified user re-signed up (new code) | Confirm with a re-issued code | `201`, verified | auth-confirm.spec |
| API-CONFIRM-11 | P2 | Security | Brute-force resistance observation | User signed up | Submit many wrong codes rapidly | Each `400`; **verified: no throttle/lockout** (risk) | auth-confirm.spec `@security` |
| API-CONFIRM-15 | P0 | Security | 🐞 No verified-guard — unused code mints JWT on verified account | User already verified & in use; a second unused code exists | POST `{email, <other unused code>}` | **Defect (verified):** `201` + a fresh valid `ROLE_USER` JWT even though the account is already active. *Expected:* `400 "Account already confirmed."` Any live code is effectively a bearer credential | auth-confirm.spec |
| API-CONFIRM-16 | P1 | Security | 🐞 Re-signup doesn't invalidate prior codes | Unverified user signed up twice (codes A, then B) | Confirm with the **older** code A after B was issued | **Defect (verified):** code A **still** confirms (`201`). Multiple codes are valid at once → enlarges brute-force surface. *Expected:* re-issue invalidates prior unused codes | auth-confirm.spec |

**Notes / risks:** `User not found.` on confirm is a mild user-enumeration signal; 6-digit codes
with no lockout are brute-forceable within the 10-min window — record as findings.

**Expiry / boundary cases** (`API-CONFIRM-08b`, `API-CONFIRM-13`) use a gray-box DB seam to reach
time-dependent states deterministically — see [advanced-gray-box.md](advanced-gray-box.md).
