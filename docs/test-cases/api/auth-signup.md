# API — Sign up (`POST /api/auth/signup`)

**User story:** _As a new visitor, I want to register with my email and password so that I can
receive a confirmation code and activate my account._

**Rules:** email required / valid / ≤190 / lower-cased+trimmed · password required / 8–255 ·
existing **verified** email rejected · existing **unverified** email allowed (re-issues code) ·
success `201 {message:"Confirmation code sent to email."}` · sends email to MailHog with a
6-digit code and a confirmation link (expires 10 min).

## Equivalence classes

**Email**

| Class | Type | Example | Expected |
|---|---|---|---|
| Standard | valid | `user@example.com` | 201 |
| Subdomain | valid | `user@mail.example.com` | 201 |
| Plus alias | valid | `user+tag@example.com` | 201 |
| Mixed case / spaces | valid (normalized) | `  User@Example.COM ` | 201, stored `user@example.com` |
| Missing `@` | invalid | `userexample.com` | 400 `Invalid email format.` |
| Missing domain | invalid | `user@` | 400 `Invalid email format.` |
| Missing local part | invalid | `@example.com` | 400 `Invalid email format.` |
| Empty | invalid | `` | 400 `Email is required.` |
| 190 chars | boundary (max) | `emailOfLength(190)` | 201 |
| 191 chars | invalid (above max) | `emailOfLength(191)` | 400 `Email is too long.` |

**Password (length boundaries)**

| Value | Type | Expected |
|---|---|---|
| 7 chars | invalid (below min) | 400 `Password must be at least 8 characters.` |
| 8 chars | boundary (min) | 201 |
| 255 chars | boundary (max) | 201 |
| 256 chars | invalid (above max) | 400 `Password is too long.` |
| empty | invalid | 400 `Password is required.` |

## Test cases

| ID | Pri | Type | Title | Preconditions | Steps / Data | Expected result | Coverage |
|---|---|---|---|---|---|---|---|
| API-SIGNUP-01 | P0 | Positive | Register a brand-new user | Email not registered | POST `{email:<unique>, password:"Password123!"}` | `201`, body exactly `{message:"Confirmation code sent to email."}` | auth-signup.spec |
| API-SIGNUP-02 | P0 | Positive | Confirmation email & link | — | After signup, query MailHog for recipient | Email present; contains a 6-digit code and a link whose **host is the app** (`…/app?confirm_email=<email>&confirm_code=<6 digits>`). Broken mode points the link at a bogus host — caught here | auth-signup.spec |
| API-SIGNUP-03 | P1 | Positive | Email is normalized | — | Signup with `  MiXed@Example.COM ` then confirm/sign in using `mixed@example.com` | Account usable via normalized email | auth-signup.spec |
| API-SIGNUP-04 | P1 | Negative | Duplicate verified user rejected | User already registered **and** confirmed | POST same email | `400`, `{error:"User already exists."}` | auth-signup.spec |
| API-SIGNUP-05 | P2 | Positive | Re-signup for unverified user allowed | User signed up but **not** confirmed | POST same email again | `201`; a fresh code is issued | auth-signup.spec |
| API-SIGNUP-06 | P1 | Negative | Missing email | — | POST `{password:"Password123!"}` | `400`, `{error:"Email is required."}` | auth-signup.spec |
| API-SIGNUP-07 | P1 | Negative | Missing password | — | POST `{email:<unique>}` | `400`, `{error:"Password is required."}` | auth-signup.spec |
| API-SIGNUP-08 | P1 | Negative | Invalid email format | — | POST each invalid email from EC table | `400`, `{error:"Invalid email format."}` | auth-signup.spec |
| API-SIGNUP-09 | P1 | Boundary | Password below minimum | — | POST password = 7 chars | `400`, `{error:"Password must be at least 8 characters."}` | auth-signup.spec |
| API-SIGNUP-10 | P1 | Boundary | Password at minimum | — | POST password = 8 chars | `201` | auth-signup.spec |
| API-SIGNUP-11a | P2 | Boundary | Password at maximum (255) accepted | — | POST password = 255 chars | `201` | auth-signup.spec |
| API-SIGNUP-11b | P2 | Boundary | Password over maximum (256) rejected | — | POST password = 256 chars | `400`, `{error:"Password is too long."}` | auth-signup.spec |
| API-SIGNUP-12a | P2 | Boundary | Email at maximum (190) accepted | — | POST email = exactly 190 chars | `201` | auth-signup.spec |
| API-SIGNUP-12b | P2 | Boundary | Email over maximum (191) rejected | — | POST email = exactly 191 chars | `400`, `{error:"Email is too long."}` | auth-signup.spec |
| API-SIGNUP-13 | P2 | Contract | Exact status & shape | — | Valid signup | Status is **exactly `201`**; body is **exactly** `{message:"Confirmation code sent to email."}` (no extra keys) | auth-signup.spec |
| API-SIGNUP-14 | P3 | Negative | Empty JSON body | — | POST `{}` | `400`, `{error:"Email is required."}` | auth-signup.spec |
| API-SIGNUP-15 | P2 | Security | Injection in email field | — | POST `email:"'; DROP TABLE users;--@x"` | `400 Invalid email format.`; no server error, DB intact | auth-signup.spec |
| API-SIGNUP-16 | P3 | Negative | Malformed JSON payload | — | POST body `not-json` with JSON content-type | `400`, `{error:"Invalid JSON payload."}`, no stack trace leaked | auth-signup.spec |
| API-SIGNUP-17 | P2 | Negative | Valid JSON but not an object | — | POST a bare scalar body `123` / `"x"` / `true` | `400`, `{error:"JSON payload must be an object."}`. _Note: a JSON **array** (`[1,2]`) passes PHP's `is_array` and instead yields `"Email is required."`_ (covers the `payload()` non-array branch — **GAP-2**) | auth-signup.spec |
| API-SIGNUP-18 | P2 | Negative | Mail delivery failure → 500 | MailHog/mailer unavailable | Stop the mailer, POST a valid signup | `500`, `{error:…}` (exercises the `Throwable → 500` path — **GAP-1**); no stack trace leaked | auth-signup.spec `@infra` |
| API-SIGNUP-19 | P0 | Security | 🐞 Double-submit race leaks raw SQL | Email not registered | Fire **two concurrent** `POST /signup` for the same new email | **Defect (verified):** one `201`, the other **`500`** with the **raw DB exception** (`SQLSTATE[23000]…Duplicate entry…'users.uniq_users_email'`). *Expected:* both handled gracefully (`201` + `400 "User already exists."`), **never** raw SQL. Exposes engine/table/constraint — info disclosure | auth-signup.spec `@concurrency` |
| API-SIGNUP-20 | P2 | Security | 🐞 Weak/whitespace password accepted | — | POST password `"        "` (8 spaces) or emoji `😀😀😀😀😀` | **Defect (verified):** `201` — only `minlength` is enforced; password is **not trimmed** and has no complexity/whitespace rule (an all-spaces password is valid) | auth-signup.spec |

**Notes / risks:** no rate limiting on signup observed — repeated signups are accepted; flag as a
security observation (potential email-bombing / user-enumeration surface).
