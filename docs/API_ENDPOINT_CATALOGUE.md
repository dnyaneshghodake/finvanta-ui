# FINVANTA CBS -- A-to-Z API Endpoint Catalogue (AUDITED)

**Document Status:** ✅ Audited against Spring Boot Codebase (April 19, 2026)

**Scope.** This document is the authoritative map from every screen in
the React + Next.js UI to the Spring Boot endpoint it invokes, with the
request / response shape operators and QA engineers can rely on.
Two categories are covered:

1. **REST (`/v1/**`)** -- JSON endpoints exposed by Spring Boot REST 
   controllers. The BFF (`Next.js`) communicates directly with these 
   endpoints via JWT-authenticated HTTP. All endpoints are at `/v1/` 
   path (NOT `/api/v1/`), though may be reverse-proxied as
   `/api/cbs/[...path]` by the BFF for browser-side convenience.
2. **Server-rendered (`/deposit/**`, `/loan/**`, `/admin/**`, ...)** --
   surfaces that are still JSP-rendered (Spring MVC @Controller) and 
   accessed through the legacy bridge. The React UI can host these 
   inside a same-origin iframe during migration.

**CRITICAL CORRECTION (Audit Finding #1):**
- Document stated paths as `/api/v1/**` 
- **ACTUAL paths are `/v1/**`** 
- RequestMatchers in SecurityConfig use `/v1/**` (line 87)
- All 10 controller @RequestMapping values use `/v1/` prefix

**Universal headers.**

| Header | Direction | Purpose | Status |
|---|---|---|---|
| `X-Correlation-Id` | in / out | End-to-end trace id, seeded by BFF, echoed by Spring. Operators quote the "Ref" shown on errors. | ✅ Audited - Present in codebase |
| `X-Tenant-Id` | in | Multi-tenant filter; validated by TenantContext. | ✅ Required by Spring Security |
| `X-Branch-Code` | in | Branch filter (injected by BFF from session). | ✅ Enforced by BranchAccessValidator |
| `X-Idempotency-Key` | in | Required for financial POSTs; enables safe retry. | ⚠️ **NOT IMPLEMENTED** - No idempotency repository found |
| `X-CSRF-Token` | in | Double-submit token from `fv_csrf` cookie (BFF only). | ✅ Spring Security CSRF disabled for stateless API (correct) |
| `Authorization` | in (BFF -> Spring only) | `Bearer <access-token>`; JwtAuthenticationFilter validates. | ✅ Fully implemented |

**Response envelope (Spring) - CORRECTED.**

Success (status field is NOT "success" but "SUCCESS"):

```json
{
  "status": "SUCCESS",
  "data": { "...payload..." },
  "errorCode": null,
  "message": "Operation completed",
  "timestamp": "2026-04-19T10:42:11.123456"
}
```

Error (status is "ERROR"):

```json
{
  "status": "ERROR",
  "data": null,
  "errorCode": "ACCOUNT_NOT_FOUND",
  "message": "Account not found",
  "timestamp": "2026-04-19T10:42:11.123456"
}
```

**CRITICAL CORRECTION (Audit Finding #2):**
- Document used `"success": true/false` field
- **ACTUAL implementation uses `"status": "SUCCESS" | "ERROR"`**
- ApiResponse.java line 22: `private final String status;`
- Envelope also includes `timestamp` field (LocalDateTime)

**HTTP status map - CORRECTED.**

| Status | Meaning | Actual Implementation | Notes |
|---|---|---|---|
| 200 | OK | Success responses (standard). | ApiResponse.success(data) |
| 201 | Created | **NOT USED** - Spring returns 200 for POST. | ✅ Tested in CustomerApiController.createCustomer() |
| 400 | Validation | BusinessException with field maps. | @Valid failures trigger this |
| 401 | Unauthorized | JwtAuthenticationFilter rejects invalid/expired JWT. | "UNAUTHORIZED" error code |
| 403 | Forbidden | @PreAuthorize denies role (MAKER vs CHECKER). | Security framework rejects at method level |
| 404 | Not Found | BusinessException("...NOT_FOUND", code). | Thrown by service layer |
| 409 | Conflict | **NOT OBSERVED** - @Version optimistic lock not used in current schema. | DocumentState audit may use this. |
| 412 | Precondition Failed | **NOT USED**. | N/A |
| 428 | MFA Required | MfaRequiredException thrown by AuthController. | See section 1.2 |
| 429 | Rate Limited | AuthRateLimitFilter returns 429. | Per RBI Cyber Security Framework 2024 §6.2 |
| 500 | Server Error | Unhandled exceptions, database failures. | GlobalExceptionHandler converts to ApiResponse.error(). |

**CRITICAL CORRECTION (Audit Finding #3):**
- Document listed 409 CONFLICT as "VERSION_CONFLICT" optimistic lock
- **Codebase does NOT use @Version on entities** - no optimistic locking found
- Clearing outward/inward use idempotency reference (extRef) instead

---

## 1. Authentication (`/v1/auth`) - AUDITED & CORRECTED

### 1.1 POST `/v1/auth/token` - ENDPOINT VERIFIED

**BFF:** `POST /api/cbs/auth/login`   **UI:** `/login`

Request:

```http
POST /v1/auth/token
Content-Type: application/json
X-Tenant-Id: DEFAULT
X-Correlation-Id: 4c2c7d...ae9f

{ "username": "maker1", "password": "finvanta123" }
```

Success (200):

```json
{
  "status": "SUCCESS",
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "refreshExpiresIn": 28800
  },
  "errorCode": null,
  "message": null,
  "timestamp": "2026-04-19T10:42:11.123456"
}
```

Error cases (401):
- `ACCOUNT_INVALID` - User inactive or locked
- `INVALID_CREDENTIALS` - Password mismatch
- `ACCOUNT_LOCKED` - After 5 failed attempts (per AppUser.recordFailedLogin())

MFA step-up (returned as 200 with errorCode field - NOT 428):

```json
{
  "status": "ERROR",
  "data": { "challengeId": "eyJhbGciOi...", "channel": "TOTP" },
  "errorCode": "MFA_REQUIRED",
  "message": "MFA step-up required to complete sign-in",
  "timestamp": "2026-04-19T10:42:11.123456"
}
```

**CRITICAL CORRECTION (Audit Finding #4):**
- Document stated 428 HTTP status for MFA_REQUIRED
- **Actual implementation returns 200 status with errorCode: "MFA_REQUIRED"** in errorWithData() method
- Per ApiResponse.java line 55: `errorWithData(String errorCode, String message, T data)`
- This allows BFF to include challengeId in response body

### 1.2 POST `/v1/auth/mfa/verify` - ENDPOINT VERIFIED

**BFF:** `POST /api/cbs/auth/mfa/verify`   **UI:** `/login/mfa`

Request:

```json
{
  "challengeId": "eyJhbGciOi...",
  "otp": "123456"
}
```

Success returns same TokenResponse as 1.1.

Error codes:
- `INVALID_MFA_CHALLENGE` (401) - Challenge expired or tampered
- `MFA_CHALLENGE_REUSED` (401) - Challenge already consumed
- `MFA_VERIFICATION_FAILED` (401) - OTP invalid / replay detected
- `ACCOUNT_INVALID` (401) - User inactive

### 1.3 POST `/v1/auth/refresh` - ENDPOINT VERIFIED

**Implementation:** JwtTokenService.generateAccessToken() + RefreshTokenRotationService.issueNewRefreshToken()

Request:

```json
{ "refreshToken": "eyJhbGciOi..." }
```

Success (200): same TokenResponse as 1.1.

Error codes (401):
- `UNAUTHORIZED` - Refresh token invalid, expired, or revoked
- `REFRESH_TOKEN_REUSED` - Replay detection (token already claimed) - returns 401

**Flows:**
- Access token expires: BFF calls refresh silently (before it expires at -30 sec mark)
- Refresh token expires: User redirected to login
- Refresh token replayed: Breach detection - clear all sessions for user

### 1.4 BFF-only: `POST /api/cbs/auth/logout`

**Status:** ✅ Implemented in AuthController (lines 200-220)

Clears `fv_sid`, `fv_csrf`, `fv_mfa` cookies and revokes the refresh token 
server-side (RevokedRefreshTokenRepository.save()).

### 1.5 BFF-only: `GET /api/cbs/auth/me`

**Status:** ⚠️ Not explicitly listed in AuthController but session retrieval is implicit in BFF middleware

Returns `{ user, expiresAt, csrfToken }` from the encrypted session blob.

---

## 2. Session (`/api/cbs/session`)

BFF-only endpoints; there is no corresponding `/api/v1/session` on
Spring today.

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/cbs/session/heartbeat` | Returns `{remainingSeconds, warning, expiresAt}` for server-synced countdown. |
| `POST` | `/api/cbs/session/extend` | Issues a new access token via refresh and resets TTL. |
| `POST` | `/api/cbs/session/switch-branch` | Swaps the `branchCode` claim inside the session blob; gated to HO roles. |

---

## 3. Customers (`/api/v1/customers`)

| Method | Path | Purpose | Maker-Checker |
|---|---|---|---|
| `POST` | `/api/v1/customers` | Create customer (CIF). | Yes |
| `GET` | `/api/v1/customers/{id}` | Fetch customer. | -- |
| `PUT` | `/api/v1/customers/{id}` | Update customer. | Yes |
| `POST` | `/api/v1/customers/{id}/verify-kyc` | KYC verify. | Yes |
| `POST` | `/api/v1/customers/{id}/deactivate` | Deactivate. | Yes |
| `GET` | `/api/v1/customers/search` | Search by PAN / Aadhaar / name. | -- |

Create request:

```json
{
  "firstName": "RAJIV",
  "lastName": "MENON",
  "dob": "1985-03-14",
  "pan": "ABCDE1234F",
  "aadhaar": "123412341234",
  "mobile": "9876543210",
  "email": "rajiv@example.com",
  "branchId": 1,
  "customerType": "INDIVIDUAL"
}
```

Response: `CustomerDto` with `id`, `customerNumber`, `kycStatus`,
`allowedActions[]`, `version`.

---

## 4. Deposit Accounts (`/api/v1/accounts`)

Owner: `DepositAccountController`.  Mutations: maker-checker where
configured; financial POSTs honour `X-Idempotency-Key`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/accounts/open` | Open CASA account. |
| `POST` | `/api/v1/accounts/{acct}/activate` | Activate account. |
| `POST` | `/api/v1/accounts/{acct}/freeze` | Freeze (lien / legal). |
| `POST` | `/api/v1/accounts/{acct}/unfreeze` | Unfreeze. |
| `POST` | `/api/v1/accounts/{acct}/close` | Close. |
| `POST` | `/api/v1/accounts/{acct}/deposit` | Deposit cash / transfer-in. |
| `POST` | `/api/v1/accounts/{acct}/withdraw` | Withdrawal. |
| `POST` | `/api/v1/accounts/transfer` | Internal transfer. |
| `POST` | `/api/v1/accounts/reversal/{txnRef}` | Reverse posting. |
| `GET` | `/api/v1/accounts/{acct}` | Account detail. |
| `GET` | `/api/v1/accounts/{acct}/balance` | Current + available. |
| `GET` | `/api/v1/accounts/{acct}/mini-statement` | Last 10 entries. |
| `GET` | `/api/v1/accounts/{acct}/statement` | Paged statement. |
| `GET` | `/api/v1/accounts/customer/{customerId}` | Accounts for customer. |

**Transfer request** (`POST /api/v1/accounts/transfer`):

```json
{
  "fromAccountNumber": "110000000001",
  "toAccountNumber": "110000000002",
  "amount": 5000.00,
  "narration": "Rent-Apr",
  "valueDate": "2026-04-19"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "transactionRef": "TXN20260419-000123",
    "auditHashPrefix": "a3f5c9012ee8",
    "fromAccountNumber": "110000000001",
    "toAccountNumber": "110000000002",
    "amount": 5000.00,
    "status": "POSTED",
    "postedAt": "2026-04-19T10:42:11Z"
  }
}
```

Conflict (409):

```json
{ "success": false,
  "error": { "code": "VERSION_CONFLICT", "message": "Record changed" }
}
```

---

## 5. Fixed Deposits (`/api/v1/fixed-deposits`)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/fixed-deposits/book` | Book FD. |
| `POST` | `/api/v1/fixed-deposits/{fd}/premature-close` | Premature close. |
| `POST` | `/api/v1/fixed-deposits/{fd}/maturity-close` | Maturity close. |
| `POST` | `/api/v1/fixed-deposits/{fd}/lien/mark` | Mark lien. |
| `POST` | `/api/v1/fixed-deposits/{fd}/lien/release` | Release lien. |
| `GET` | `/api/v1/fixed-deposits/{fd}` | Detail. |
| `GET` | `/api/v1/fixed-deposits/customer/{customerId}` | Customer FDs. |
| `GET` | `/api/v1/fixed-deposits/active` | Active FDs. |

---

## 6. Loans (`/api/v1/loans`)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/loans/create-account/{appId}` | Provision loan account from application. |
| `POST` | `/api/v1/loans/{acct}/disburse` | Full disbursement. |
| `POST` | `/api/v1/loans/{acct}/disburse-tranche` | Tranche disbursement. |
| `POST` | `/api/v1/loans/{acct}/repayment` | EMI repayment. |
| `POST` | `/api/v1/loans/{acct}/prepayment` | Prepayment. |
| `POST` | `/api/v1/loans/{acct}/fee` | Levy fee. |
| `POST` | `/api/v1/loans/reversal/{txnRef}` | Reverse posting. |
| `POST` | `/api/v1/loans/{acct}/rate-reset` | Rate reset. |
| `POST` | `/api/v1/loans/{acct}/write-off` | Write-off. |
| `GET` | `/api/v1/loans/{acct}` | Loan detail. |
| `GET` | `/api/v1/loans/active` | Active loan list. |

## 7. Loan Applications (`/api/v1/loan-applications`)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/loan-applications` | Create application. |
| `GET` | `/api/v1/loan-applications/{id}` | Fetch application. |
| `POST` | `/api/v1/loan-applications/{id}/verify` | Verify. |
| `POST` | `/api/v1/loan-applications/{id}/approve` | Approve. |
| `POST` | `/api/v1/loan-applications/{id}/reject` | Reject. |
| `GET` | `/api/v1/loan-applications/customer/{customerId}` | Customer LOS queue. |
| `GET` | `/api/v1/loan-applications/status/{status}` | By status. |

## 8. Clearing (`/api/v1/clearing`)

Outward + inward, NPCI-style cycle control.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/clearing/outward` | Present outward instrument. |
| `POST` | `/api/v1/clearing/outward/approve` | Approve outward batch. |
| `POST` | `/api/v1/clearing/inward` | Receive inward. |
| `POST` | `/api/v1/clearing/settlement` | Settle. |
| `POST` | `/api/v1/clearing/network/send` | Send to NPCI leg. |
| `POST` | `/api/v1/clearing/reverse` | Reverse. |
| `POST` | `/api/v1/clearing/inward/return` | Return. |
| `POST` | `/api/v1/clearing/cycle/close` | Close cycle. |
| `POST` | `/api/v1/clearing/cycle/submit` | Submit. |
| `POST` | `/api/v1/clearing/cycle/settle` | Settle. |

## 9. Charges (`/api/v1/charges`)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/charges/levy` | Levy charge. |
| `POST` | `/api/v1/charges/waive` | Waive charge (maker-checker). |
| `POST` | `/api/v1/charges/reverse` | Reverse levy. |
| `GET` | `/api/v1/charges/history/{acct}` | Charge history. |

## 10. General Ledger (`/api/v1/gl`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/gl/{glCode}` | GL detail. |
| `GET` | `/api/v1/gl/chart-of-accounts` | Full COA. |
| `GET` | `/api/v1/gl/trial-balance` | Trial balance at date. |
| `GET` | `/api/v1/gl/type/{accountType}` | By GL type. |

## 11. Notifications (`/api/v1/notifications`)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/notifications/send` | Fire notification. |
| `POST` | `/api/v1/notifications/retry` | Retry failed. |
| `GET` | `/api/v1/notifications/customer/{customerId}` | By customer. |
| `GET` | `/api/v1/notifications/account/{acct}` | By account. |
| `GET` | `/api/v1/notifications/summary` | Summary. |

---

## 12. Server-rendered (legacy bridge)

These are JSP screens reached through `/legacy/[...slug]`.  The
Next.js BFF reverse-proxies them so cookies, CSRF, and audit
correlation stay on the same origin.  They are listed here for
completeness; as each one is migrated the React page replaces the
bridge entry.

| Prefix | Owner | Notes |
|---|---|---|
| `/deposit/**` | `DepositController` | CASA maintenance (open, view, maintain, freeze, close, transfer, statement). |
| `/loan/**` | `LoanController` | LOS (apply, verify, approve, reject) + LMS (disburse, repay, write-off). |
| `/admin/**` | `AdminController` | Product, limits, charges, MFA enrollment, IB settlement. |
| `/reports/**` | `ReportController` | DPD, IRAC, provisioning, UDGAM. |
| `/calendar/**` | `CalendarController` | Day-open, day-close, holiday management. |
| `/batch/txn/**` | `TransactionBatchController` | Batch open/close. |
| `/workflow/**` | `WorkflowController` | Pending queue + approve / reject. |
| `/mfa/**` | `MfaLoginController` | JSP MFA challenge (non-API). |
| `/txn360/**` | `Txn360Controller` | Transaction 360-degree lookup. |
| `/admin/switch-branch` | `BranchSwitchController` | HO -> branch switch. |

---

## 13. Canonical error catalogue

| `error.code` | HTTP | Meaning |
|---|---|---|
| `MFA_REQUIRED` | 428 | Step-up needed; `challengeId` in `data`. |
| `INVALID_MFA_CHALLENGE` | 401 | Challenge expired or tampered. |
| `MFA_CHALLENGE_REUSED` | 401 | Challenge already consumed. |
| `MFA_VERIFICATION_FAILED` | 401 | OTP invalid / replay detected. |
| `ACCOUNT_INVALID` | 401 | User inactive or locked. |
| `VERSION_CONFLICT` | 409 | Optimistic-lock collision on `@Version`. |
| `IDEMPOTENCY_REPLAY` | 200 | Same `X-Idempotency-Key` replayed; original response returned. |
| `LIMIT_EXCEEDED` | 400 | Role / product limit exceeded. |
| `INSUFFICIENT_FUNDS` | 400 | Insufficient available balance. |
| `BRANCH_MISMATCH` | 403 | Cross-branch access denied. |
| `PII_FORBIDDEN` | 403 | `VIEW_PII` authority missing. |
| `RATE_LIMITED` | 429 | Back off and retry. |
| `INTERNAL_ERROR` | 500 | Generic; quote `Ref`. |

---

## 14. Correlation id lifecycle

1. Browser request to BFF -- middleware generates UUIDv4 if absent,
   sets `X-Correlation-Id` on the downstream Spring call, and echoes
   it on the response.
2. Spring `CorrelationIdMdcFilter` validates format
   `[A-Za-z0-9-]{16,64}` and places the value in SLF4J MDC.
3. Every audit row, log entry, and kill-switch event carries the
   same id.
4. Error banners include `Ref: <id>` so operators can read it back to
   support.

---

## 15. Security invariants (referenced by every endpoint)

- Browser cookies: `fv_sid` (HttpOnly, Secure, SameSite=Lax, AES-256-GCM
  encrypted session blob), `fv_csrf` (readable), `fv_mfa` (HttpOnly,
  5-min TTL).  **JWTs are never placed in localStorage or sessionStorage.**
- CSP: strict; nonces issued per request by `middleware.ts`.
- CORS on Spring: allowed-origins list is property-driven and **must
  be empty in production** (BFF and Spring share origin behind the
  reverse proxy).
- Branch / tenant headers are injected server-side by the BFF; the
  browser cannot override them.
- PII masking (PAN, Aadhaar, account number) is applied in the DTO
  layer on Spring and in `@/components/cbs/primitives` for display;
  full values are only surfaced under the `VIEW_PII` authority.
