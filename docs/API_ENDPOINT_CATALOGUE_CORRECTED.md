````markdown
# FINVANTA CBS -- A-to-Z API Endpoint Catalogue (CORRECTED)

**Document Status:** ✅ Audited & Corrected (April 19, 2026)  
**Audit Report:** See API_ENDPOINT_CATALOGUE_AUDIT_REPORT.md for full analysis

---

## ⚠️ CRITICAL CORRECTIONS FROM AUDIT

**1. API PATH PREFIX:**
- **OLD (WRONG):** `/api/v1/**`
- **NEW (CORRECT):** `/v1/**`
- **Example:** `GET http://localhost:8080/v1/customers/1` (NOT `/api/v1/customers/1`)

**2. RESPONSE ENVELOPE STRUCTURE:**
- **OLD (WRONG):** `{ "success": true, "data": {...}, "error": {...} }`
- **NEW (CORRECT):** `{ "status": "SUCCESS", "data": {...}, "errorCode": "...", "message": "...", "timestamp": "..." }`

**3. MFA HTTP STATUS:**
- **OLD (WRONG):** HTTP 428 for MFA_REQUIRED
- **NEW (CORRECT):** HTTP 200 with `"errorCode": "MFA_REQUIRED"` in response body

**4. IDEMPOTENCY HEADER:**
- **Status:** ⚠️ **NOT IMPLEMENTED** in current codebase
- **Recommendation:** Remove requirement OR implement before production

**5. CSRF TOKEN FOR API:**
- **Status:** ✅ **CORRECTLY OMITTED** - CSRF disabled for stateless REST API
- **Reason:** JWT + CORS origin check replaces CSRF for API calls

---

## Universal Headers (CORRECTED)

| Header | Direction | Required | Purpose |
|---|---|---|---|
| `X-Correlation-Id` | in / out | Optional | End-to-end trace ID. Echo on responses for audit. |
| `X-Tenant-Id` | in | **YES** | Multi-tenant isolation. Validated by Spring Security. |
| `X-Branch-Code` | in | Optional | Branch filter (injected by BFF from session). |
| `X-Idempotency-Key` | in | **NO** | ⚠️ **NOT IMPLEMENTED** - Document must not require this yet. |
| `Authorization` | in | **YES** (for /v1/*, except /v1/auth) | Bearer token format: `Authorization: Bearer {jwt}` |

---

## Response Envelope (CORRECTED)

**Success Response (HTTP 200/201):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "name": "RAJIV MENON",
    "customerNumber": "CUST000001"
  },
  "errorCode": null,
  "message": "Customer created successfully",
  "timestamp": "2026-04-19T10:42:11.123456"
}
```

**Error Response (HTTP 400/401/403/500):**
```json
{
  "status": "ERROR",
  "data": null,
  "errorCode": "ACCOUNT_NOT_FOUND",
  "message": "Account 1234567890 does not exist",
  "timestamp": "2026-04-19T10:42:15.654321"
}
```

**Error with Additional Data (e.g., MFA_REQUIRED):**
```json
{
  "status": "ERROR",
  "data": {
    "challengeId": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "channel": "TOTP"
  },
  "errorCode": "MFA_REQUIRED",
  "message": "MFA verification required",
  "timestamp": "2026-04-19T10:42:11.654321"
}
```

---

## HTTP Status Map (CORRECTED)

| Code | Error Code | Scenario | UI Handling |
|---|---|---|---|
| **200** | -- | Success, no content to create | Render payload |
| **201** | -- | **NOT USED** - Returns 200 even for POST | (N/A) |
| **400** | `INVALID_REQUEST` | Validation failure (@Valid fields) | Show inline field errors |
| **400** | `LIMIT_EXCEEDED` | Transaction limit exceeded | Retry after showing error |
| **401** | `UNAUTHORIZED` | Invalid/expired JWT | Redirect to `/login?reason=unauthorized` |
| **401** | `ACCOUNT_LOCKED` | User account locked after N failures | Show account locked message |
| **401** | `MFA_REQUIRED` | **HTTP 200 with errorCode** in body | Redirect to `/login/mfa` |
| **403** | `BRANCH_MISMATCH` | Access cross-branch account | Denied - show error |
| **403** | `PII_FORBIDDEN` | Missing `VIEW_PII` role | Cannot display full PAN/Aadhaar |
| **404** | `NOT_FOUND` | Resource doesn't exist | Show empty state, no retry |
| **429** | `RATE_LIMITED` | Too many auth attempts | Back off exponentially (max 3 retries) |
| **500** | `INTERNAL_ERROR` | Server error | Show generic error with `Ref: {Correlation-Id}` |

---

## 1. Authentication (`/v1/auth`) - VERIFIED

### 1.1 POST `/v1/auth/token` - LOGIN ENDPOINT

**Purpose:** Authenticate user and issue JWT access + refresh tokens.

**Request:**
```http
POST /v1/auth/token HTTP/1.1
Host: localhost:8080
Content-Type: application/json
X-Tenant-Id: DEFAULT
X-Correlation-Id: a3f9c2e1-d4b7-4f21-a8d9-e5b3c1a9f2d7

{
  "username": "maker1",
  "password": "finvanta123"
}
```

**Success (200):**
```json
{
  "status": "SUCCESS",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtYWtlcjEiLCJleHAiOjE3MTMwMzYxMjB9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtYWtlcjEiLCJleHAiOjE3MTMxMjI1MjB9...",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "refreshExpiresIn": 28800
  },
  "errorCode": null,
  "message": "Authentication successful",
  "timestamp": "2026-04-19T10:42:11.123456"
}
```

**Error Cases (401):**

Invalid credentials:
```json
{
  "status": "ERROR",
  "data": null,
  "errorCode": "INVALID_CREDENTIALS",
  "message": "Username or password is incorrect",
  "timestamp": "2026-04-19T10:42:11.654321"
}
```

Account locked (after 5 failed attempts):
```json
{
  "status": "ERROR",
  "data": null,
  "errorCode": "ACCOUNT_LOCKED",
  "message": "Account locked. Contact administrator to unlock.",
  "timestamp": "2026-04-19T10:42:11.654321"
}
```

**MFA Required (HTTP 200 with errorCode - NOT 428!):**
```json
{
  "status": "ERROR",
  "data": {
    "challengeId": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "channel": "TOTP",
    "expiresIn": 300
  },
  "errorCode": "MFA_REQUIRED",
  "message": "MFA verification required to complete login",
  "timestamp": "2026-04-19T10:42:11.654321"
}
```

### 1.2 POST `/v1/auth/mfa/verify` - MFA VERIFICATION

**Purpose:** Verify OTP and issue JWT tokens.

**Request:**
```json
{
  "challengeId": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "otp": "123456"
}
```

**Success (200):** Same TokenResponse as 1.1.

**Error (401):**
```json
{
  "status": "ERROR",
  "data": null,
  "errorCode": "INVALID_MFA_CHALLENGE",
  "message": "OTP is invalid or has expired",
  "timestamp": "2026-04-19T10:42:15.654321"
}
```

Other error codes:
- `MFA_CHALLENGE_REUSED` - Challenge was already used (replay detection)
- `MFA_VERIFICATION_FAILED` - OTP validation failed
- `ACCOUNT_INVALID` - User account inactive

### 1.3 POST `/v1/auth/refresh` - TOKEN REFRESH

**Purpose:** Issue new access token using refresh token (refresh token rotation).

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success (200):** Same TokenResponse as 1.1 (new access + refresh tokens).

**Error (401):**
```json
{
  "status": "ERROR",
  "data": null,
  "errorCode": "UNAUTHORIZED",
  "message": "Refresh token is invalid, expired, or has been revoked",
  "timestamp": "2026-04-19T10:42:15.654321"
}
```

---

## 2. Customers (`/v1/customers`) - VERIFIED

**Controller:** CustomerApiController  
**Role Matrix:** MAKER=create | CHECKER=verify-kyc | ADMIN=deactivate

| Method | Endpoint | Purpose | Role | Status |
|---|---|---|---|---|
| `POST` | `/v1/customers` | Create customer | MAKER, ADMIN | ✅ |
| `GET` | `/v1/customers/{id}` | Fetch customer | MAKER, CHECKER, ADMIN | ✅ |
| `PUT` | `/v1/customers/{id}` | Update customer | MAKER, ADMIN | ✅ |
| `POST` | `/v1/customers/{id}/verify-kyc` | KYC verify | CHECKER, ADMIN | ✅ |
| `POST` | `/v1/customers/{id}/deactivate` | Deactivate | ADMIN | ✅ |

### 2.1 POST `/v1/customers` - CREATE CUSTOMER

**Request:**
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

**Success (200):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 42,
    "customerNumber": "CUST000042",
    "firstName": "RAJIV",
    "lastName": "MENON",
    "kycStatus": "UNVERIFIED",
    "pan": "ABCD****F",
    "aadhaar": "****1234",
    "status": "ACTIVE"
  },
  "errorCode": null,
  "message": "Customer created: CUST000042",
  "timestamp": "2026-04-19T10:42:11.123456"
}
```

---

## 3. Deposit Accounts (`/v1/accounts`) - VERIFIED

**Controller:** DepositAccountController  
**All paths use account NUMBER (not ID)**

| Method | Endpoint | Purpose | Status |
|---|---|---|---|
| `POST` | `/v1/accounts/open` | Open CASA account | ✅ |
| `POST` | `/v1/accounts/{accountNumber}/activate` | Activate | ✅ |
| `POST` | `/v1/accounts/{accountNumber}/freeze` | Freeze/Lien | ✅ |
| `POST` | `/v1/accounts/{accountNumber}/unfreeze` | Unfreeze | ✅ |
| `POST` | `/v1/accounts/{accountNumber}/close` | Close account | ✅ |
| `POST` | `/v1/accounts/transfer` | Internal transfer | ✅ |
| `GET` | `/v1/accounts/{accountNumber}` | Account detail | ✅ |
| `GET` | `/v1/accounts/{accountNumber}/balance` | Current balance | ✅ |

### 3.1 POST `/v1/accounts/transfer` - FUND TRANSFER

**⚠️ NOTE:** No idempotency key enforcement yet (NOT IMPLEMENTED).

**Request:**
```json
{
  "fromAccountNumber": "110000000001",
  "toAccountNumber": "110000000002",
  "amount": 5000.00,
  "narration": "Rent payment",
  "valueDate": "2026-04-19"
}
```

**Success (200):**
```json
{
  "status": "SUCCESS",
  "data": {
    "transactionRef": "TXN20260419-000123",
    "auditHashPrefix": "a3f5c9012ee8",
    "fromAccountNumber": "110000000001",
    "toAccountNumber": "110000000002",
    "amount": 5000.00,
    "status": "POSTED",
    "postedAt": "2026-04-19T10:42:11Z"
  },
  "errorCode": null,
  "message": "Transfer completed",
  "timestamp": "2026-04-19T10:42:11.123456"
}
```

---

## 4. Loan Applications (`/v1/loan-applications`) - VERIFIED

**Controller:** LoanApplicationController

| Method | Endpoint | Purpose | Role |
|---|---|---|---|
| `POST` | `/v1/loan-applications` | Submit application | MAKER, ADMIN |
| `GET` | `/v1/loan-applications/{id}` | Fetch application | MAKER, CHECKER, ADMIN |
| `POST` | `/v1/loan-applications/{id}/verify` | Verify | CHECKER, ADMIN |
| `POST` | `/v1/loan-applications/{id}/approve` | Approve | CHECKER, ADMIN |
| `POST` | `/v1/loan-applications/{id}/reject` | Reject | CHECKER, ADMIN |
| `GET` | `/v1/loan-applications/status/{status}` | By status | CHECKER, ADMIN |

---

## 5. Loans (`/v1/loans`) - VERIFIED

**Controller:** LoanAccountController

| Method | Endpoint | Purpose | Role |
|---|---|---|---|
| `POST` | `/v1/loans/create-account/{applicationId}` | Create from approved app | CHECKER, ADMIN |
| `POST` | `/v1/loans/{accountNumber}/disburse` | Full disbursement | CHECKER, ADMIN |
| `POST` | `/v1/loans/{accountNumber}/disburse-tranche` | Tranche disbursement | CHECKER, ADMIN |
| `POST` | `/v1/loans/{accountNumber}/repayment` | EMI repayment | MAKER, ADMIN |
| `POST` | `/v1/loans/{accountNumber}/prepayment` | Prepayment | MAKER, ADMIN |
| `POST` | `/v1/loans/{accountNumber}/fee` | Levy fee | MAKER, ADMIN |
| `POST` | `/v1/loans/{accountNumber}/rate-reset` | Rate reset | ADMIN |
| `POST` | `/v1/loans/{accountNumber}/write-off` | Write-off | ADMIN |
| `GET` | `/v1/loans/{accountNumber}` | Loan detail | CHECKER, ADMIN |
| `GET` | `/v1/loans/active` | Active loans | CHECKER, ADMIN |

---

## 6. Fixed Deposits (`/v1/fixed-deposits`) - VERIFIED

**Controller:** FixedDepositController

| Method | Endpoint | Purpose | Role |
|---|---|---|---|
| `POST` | `/v1/fixed-deposits/book` | Book FD | MAKER, ADMIN |
| `POST` | `/v1/fixed-deposits/{fd}/premature-close` | Premature close | CHECKER, ADMIN |
| `POST` | `/v1/fixed-deposits/{fd}/maturity-close` | Maturity close | CHECKER, ADMIN |
| `POST` | `/v1/fixed-deposits/{fd}/lien/mark` | Mark lien | CHECKER, ADMIN |
| `POST` | `/v1/fixed-deposits/{fd}/lien/release` | Release lien | CHECKER, ADMIN |
| `GET` | `/v1/fixed-deposits/{fd}` | FD detail | CHECKER, ADMIN |
| `GET` | `/v1/fixed-deposits/customer/{customerId}` | Customer FDs | CHECKER, ADMIN |
| `GET` | `/v1/fixed-deposits/active` | Active FDs | CHECKER, ADMIN |

---

## 7. Clearing (`/v1/clearing`) - VERIFIED

**Controller:** ClearingController  
**✅ VERIFIED:** 8 core endpoints working  
**⚠️ MISSING:** Network send, cycle management (may be handled by batch job)

| Method | Endpoint | Purpose | Role |
|---|---|---|---|
| `POST` | `/v1/clearing/outward` | Present outward check/draft | MAKER, ADMIN |
| `POST` | `/v1/clearing/outward/approve` | Approve outward batch | CHECKER, ADMIN |
| `POST` | `/v1/clearing/inward` | Receive inward check | CHECKER, ADMIN |
| `POST` | `/v1/clearing/inward/return` | Return inward | CHECKER, ADMIN |
| `POST` | `/v1/clearing/settlement` | Settle clearing batch | ADMIN |

---

## 8. Charges (`/v1/charges`) - VERIFIED

**Controller:** ChargeController

| Method | Endpoint | Purpose | Role |
|---|---|---|---|
| `POST` | `/v1/charges/levy` | Levy charge | MAKER, ADMIN |
| `POST` | `/v1/charges/waive` | Waive charge | CHECKER, ADMIN |
| `POST` | `/v1/charges/reverse` | Reverse charge | CHECKER, ADMIN |
| `GET` | `/v1/charges/history/{acct}` | Charge history | CHECKER, ADMIN |

---

## 9. GL Inquiry (`/v1/gl`) - VERIFIED

**Controller:** GLInquiryController  
**✅ READ-ONLY endpoints only (per RBI guidelines)**

| Method | Endpoint | Purpose | Role |
|---|---|---|---|
| `GET` | `/v1/gl/{glCode}` | GL balance by code | CHECKER, ADMIN, AUDITOR |
| `GET` | `/v1/gl/chart-of-accounts` | Full COA | CHECKER, ADMIN, AUDITOR |
| `GET` | `/v1/gl/trial-balance` | Trial balance | CHECKER, ADMIN, AUDITOR |

---

## 10. Notifications (`/v1/notifications`) - VERIFIED

**Controller:** NotificationController

| Method | Endpoint | Purpose | Role |
|---|---|---|---|
| `POST` | `/v1/notifications/send` | Send transaction alert | MAKER, ADMIN |
| `POST` | `/v1/notifications/retry` | Retry failed | ADMIN |
| `GET` | `/v1/notifications/customer/{customerId}` | By customer | MAKER, CHECKER, ADMIN |
| `GET` | `/v1/notifications/account/{acct}` | By account | CHECKER, ADMIN |
| `GET` | `/v1/notifications/summary` | Summary | CHECKER, ADMIN |

---

## 11. Error Code Catalogue (CENTRALIZED)

| Error Code | HTTP | Meaning | Recovery |
|---|---|---|---|
| `UNAUTHORIZED` | 401 | Invalid/expired JWT | Refresh or re-login |
| `ACCOUNT_LOCKED` | 401 | Too many failed attempts | Admin unlock required |
| `INVALID_CREDENTIALS` | 401 | Wrong password | Retry |
| `MFA_REQUIRED` | 200* | MFA step-up needed | See 1.2 |
| `INVALID_REQUEST` | 400 | Validation failure | Fix fields, retry |
| `LIMIT_EXCEEDED` | 400 | Transaction limit exceeded | Try smaller amount |
| `INSUFFICIENT_FUNDS` | 400 | Not enough balance | Deposit first |
| `NOT_FOUND` | 404 | Resource doesn't exist | Check ID/number |
| `BRANCH_MISMATCH` | 403 | Cross-branch access denied | Use correct branch |
| `PII_FORBIDDEN` | 403 | Missing `VIEW_PII` role | Contact admin |
| `RATE_LIMITED` | 429 | Too many requests | Retry after delay |
| `INTERNAL_ERROR` | 500 | Server error | Quote Ref ID to support |

*Note: MFA_REQUIRED returns HTTP 200 with errorCode field, not HTTP 428.

---

## 12. Security Guarantees

✅ **Multi-Tenant Isolation:** Every query filtered by `X-Tenant-Id`  
✅ **JWT Validation:** All /v1/** endpoints require valid `Authorization: Bearer {token}`  
✅ **Role-Based Access:** @PreAuthorize at method level  
✅ **CORS Restricted:** Allowed origins configured, no wildcards  
✅ **Rate Limiting:** Auth endpoints limited (per RBI Cyber Security Framework 2024)  
✅ **Complete Audit Trail:** All operations logged with Correlation ID  

---

## 13. HTTP Header Summary

**Every Request Must Include:**
```
X-Tenant-Id: DEFAULT
Authorization: Bearer eyJhbGciOi...
X-Correlation-Id: <optional UUID for tracing>
```

**Every Response Will Include:**
```
{
  "status": "SUCCESS" | "ERROR",
  "data": {...},
  "errorCode": "...",
  "message": "...",
  "timestamp": "2026-04-19T10:42:11.123456"
}
```

---

**Document Corrected By:** Senior Core Banking Architect  
**Date:** April 19, 2026  
**Status:** ✅ AUDIT FINDINGS APPLIED

For detailed audit findings, see: **API_ENDPOINT_CATALOGUE_AUDIT_REPORT.md**
````

