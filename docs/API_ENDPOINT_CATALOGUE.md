# FINVANTA CBS -- A-to-Z API Endpoint Catalogue

**Scope.** This document is the authoritative map from every screen in
the React + Next.js UI to the Spring Boot endpoint it invokes, with the
request / response shape operators and QA engineers can rely on.
Two categories are covered:

1. **REST (`/api/v1/**`)** -- JSON endpoints consumed by the Next.js
   BFF on behalf of the browser.  These are the contracts the BFF
   proxy (`/api/cbs/[...path]`) forwards to.
2. **Server-rendered (`/deposit/**`, `/loan/**`, `/admin/**`, ...)** --
   surfaces that are still JSP-rendered and accessed through the
   legacy bridge (`/legacy/[...slug]` -> `/legacy/...`).  The React UI
   hosts these inside a same-origin iframe during migration so every
   flow is reachable from day 1.

**Universal headers.**

| Header | Direction | Purpose |
|---|---|---|
| `X-Correlation-Id` | in / out | End-to-end trace id, seeded by BFF, echoed by Spring. Operators quote the "Ref" shown on errors. |
| `X-Tenant-Id` | in | Multi-tenant filter; BFF injects from session -- browser cannot override. |
| `X-Branch-Code` | in | Branch filter; BFF injects from session. |
| `X-Idempotency-Key` | in | Required for all financial POSTs; enables safe retry. |
| `X-CSRF-Token` | in | Double-submit token from `fv_csrf` cookie; required on mutating calls to BFF. |
| `Authorization` | in (BFF -> Spring only) | `Bearer <access-token>`; never reaches the browser. |

**Response envelope (Spring).**

```json
{ "success": true, "data": { "...payload..." }, "error": null }
```

Error:

```json
{
  "success": false,
  "data": null,
  "error": { "code": "VERSION_CONFLICT", "message": "Record changed" }
}
```

**HTTP status map.**

| Status | Meaning | UI handling |
|---|---|---|
| 200 | OK | Render payload. |
| 201 | Created | Render payload, show "created" toast with `Ref`. |
| 400 | Validation | Inline field errors from `error.fields[]`. |
| 401 | Session invalid | BFF clears cookies, redirect `/login?reason=session_expired`. |
| 403 | RBAC / PII denied | Inline notice; no retry. |
| 404 | Not found | Empty state; no retry. |
| 409 | `VERSION_CONFLICT` | Refresh record, re-prompt. |
| 412 | N/A | -- |
| 428 | `MFA_REQUIRED` | Browser redirects to `/login/mfa` -- `fv_mfa` cookie set by BFF. |
| 429 | Rate-limited | Client backs off with exponential jitter (max 3). |
| 500 | Server error | Show generic error with `Ref`; never show stack trace. |

---

## 1. Authentication (`/api/v1/auth`)

### 1.1 POST `/api/v1/auth/token`

**BFF:** `POST /api/cbs/auth/login`   **UI:** `/login`

Request:

```http
POST /api/v1/auth/token
Content-Type: application/json
X-Tenant-Id: DEFAULT
X-Correlation-Id: 4c2c7d...ae9f

{ "username": "maker1", "password": "finvanta123" }
```

Success (200):

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

MFA step-up (428):

```json
{
  "success": false,
  "error": {
    "code": "MFA_REQUIRED",
    "message": "MFA step-up required to complete sign-in"
  },
  "data": { "challengeId": "eyJhbGciOi...", "channel": "TOTP" }
}
```

### 1.2 POST `/api/v1/auth/mfa/verify`

**BFF:** `POST /api/cbs/auth/mfa/verify`   **UI:** `/login/mfa`

Request:

```json
{ "challengeId": "eyJhbGciOi...", "otp": "123456" }
```

The `challengeId` is read from the BFF-set HttpOnly `fv_mfa` cookie --
the browser never sees it.  Success returns the same shape as 1.1.

Error codes: `INVALID_MFA_CHALLENGE`, `MFA_CHALLENGE_REUSED`,
`MFA_VERIFICATION_FAILED`, `ACCOUNT_INVALID`.

### 1.3 POST `/api/v1/auth/refresh`

**BFF:** performed silently on near-expiry; browser never sees tokens.

Request:

```json
{ "refreshToken": "eyJhbGciOi..." }
```

Success (200): same `TokenResponse`.

### 1.4 BFF-only: `POST /api/cbs/auth/logout`

Clears `fv_sid`, `fv_csrf`, `fv_mfa` cookies and (best-effort) revokes
the refresh token server-side.

### 1.5 BFF-only: `GET /api/cbs/auth/me`

Returns `{ user, expiresAt, csrfToken }` from the encrypted session.

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
