# FINVANTA CORE BANKING SYSTEM - COMPLETE REST API CATALOGUE

**For React + Next.js Frontend Implementation**

**Date:** April 2026  
**Version:** 1.0  
**Status:** Production Ready  
**Architect:** Senior Core Banking Architect & Tier-1 CBS UI Architect

---

## TABLE OF CONTENTS

1. [API Standards & Authentication](#api-standards--authentication)
2. [Authentication Module](#authentication-module)
3. [Customer Module (CIF)](#customer-module-cif)
4. [Deposit Accounts Module (CASA)](#deposit-accounts-module-casa)
5. [Loan Application Module](#loan-application-module)
6. [Loan Account Module](#loan-account-module)
7. [Fixed Deposit Module](#fixed-deposit-module)
8. [Clearing Module](#clearing-module)
9. [Charge/Fee Module](#chargefee-module)
10. [Notification Module](#notification-module)
11. [GL Inquiry Module](#gl-inquiry-module)
12. [Actuator Health Check Module](#actuator-health-check-module)

---

## API STANDARDS & AUTHENTICATION

### Base URL
```
http://localhost:8080/api/v1  (Development)
https://api.finvanta.com/api/v1  (Production)
```

### Common Headers (All Requests)
```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
X-Tenant-Id: DEFAULT
Content-Type: application/json
```

### HTTP Status Codes
- **200 OK** - Successful GET/POST/PUT
- **201 CREATED** - Resource created (rare; we use 200 with ApiResponse)
- **400 BAD REQUEST** - Invalid input validations
- **401 UNAUTHORIZED** - Invalid/expired tokens
- **403 FORBIDDEN** - Insufficient permissions
- **404 NOT FOUND** - Resource not found
- **428 PRECONDITION REQUIRED** - MFA Required (see Auth section)
- **500 INTERNAL SERVER ERROR** - Server-side error

### Standard Response Envelope (ApiResponse)

All endpoints return:
```json
{
  "status": "SUCCESS" | "ERROR",
  "data": { /* Response object or null */ },
  "errorCode": "ERROR_CODE_IF_ERROR",
  "message": "Human-readable message",
  "error": { /* Detailed error info */ }
}
```

#### Success Response (200 OK)
```json
{
  "status": "SUCCESS",
  "data": { /* Response payload */ },
  "errorCode": null,
  "message": "Success message",
  "error": null
}
```

#### Error Response (400/401/403/500)
```json
{
  "status": "ERROR",
  "data": null,
  "errorCode": "INVALID_CREDENTIALS",
  "message": "Invalid username or password",
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid username or password",
    "remainingAttempts": 3
  }
}
```

### Role-Based Access Control

All API endpoints enforce role-based authorization via `@PreAuthorize`:

| Role | Permissions |
|------|-------------|
| **MAKER** | Create/submit operations (applications, deposits, transfers) |
| **CHECKER** | Verification, approval, reconciliation operations |
| **ADMIN** | All MAKER + CHECKER + administrative operations |
| **AUDITOR** | Read-only access to GL and audit data |
| **TELLER** | Limited CASA operations (deposits/withdrawals) |

**Unauthorized access returns 403 FORBIDDEN:**
```json
{
  "status": "ERROR",
  "errorCode": "ACCESS_DENIED",
  "message": "Insufficient permissions for this operation"
}
```

### Tenant Context

All API calls are tenant-scoped via `X-Tenant-Id` header:
- Required on every request
- Filters all data to the authenticated tenant
- Default tenant: `DEFAULT`

---

## AUTHENTICATION MODULE

**Base Path:** `/api/v1/auth`

### 1. POST `/token` - User Login

**Purpose:** Authenticate user and issue JWT tokens (access + refresh).

**Method:** `POST`

**Authentication:** None (this endpoint issues tokens)

**Request Body:**
```json
{
  "username": "maker1",
  "password": "SecurePassword123!"
}
```

**Request Validation:**
- `username`: Required, non-blank string
- `password`: Required, non-blank string

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "businessDate": "2026-04-20",
    "user": {
      "id": "1",
      "username": "maker1",
      "firstName": "Rajiv",
      "lastName": "Menon",
      "email": "maker1@finvanta.com",
      "roles": ["MAKER", "TELLER"],
      "branchCode": "HQ001",
      "branchName": "Head Office",
      "tenantId": "DEFAULT",
      "mfaEnrolled": true
    }
  },
  "message": "Login successful",
  "errorCode": null
}
```

**Error Responses:**

Invalid Credentials (401):
```json
{
  "status": "ERROR",
  "errorCode": "INVALID_CREDENTIALS",
  "message": "Invalid username or password. 3 attempts remaining.",
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid username or password",
    "remainingAttempts": 3
  }
}
```

Account Disabled (401):
```json
{
  "status": "ERROR",
  "errorCode": "ACCOUNT_DISABLED",
  "message": "Account is disabled"
}
```

Account Locked (401):
```json
{
  "status": "ERROR",
  "errorCode": "ACCOUNT_LOCKED",
  "message": "Account locked for 15 minutes. Try again later or contact administrator."
}
```

Password Expired (403):
```json
{
  "status": "ERROR",
  "errorCode": "PASSWORD_EXPIRED",
  "message": "Password expired. Change via UI settings before API access."
}
```

MFA Required (428):
```json
{
  "status": "ERROR",
  "errorCode": "MFA_REQUIRED",
  "message": "MFA step-up required to complete sign-in",
  "error": {
    "challengeId": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "method": "TOTP",
    "message": "MFA step-up required"
  }
}
```

**Frontend Implementation Notes:**
- Store `accessToken` and `refreshToken` in secure storage (HttpOnly cookies or secure state)
- Use `accessToken` in `Authorization: Bearer` header for all subsequent API calls
- Token expires in 900 seconds (15 minutes)
- If MFA is enrolled, handle 428 response and redirect to MFA verification screen
- Implement token refresh before expiry (see `/refresh` endpoint)

---

### 2. POST `/mfa/verify` - MFA Step-Up Verification

**Purpose:** Complete MFA step-up login using TOTP code from 428 challenge.

**Method:** `POST`

**Authentication:** None (uses challengeId from previous `/token` response)

**Request Body:**
```json
{
  "challengeId": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "otp": "123456"
}
```

**Request Validation:**
- `challengeId`: Required, non-blank JWT challenge token from `/token` 428 response
- `otp`: Required, non-blank 6-digit OTP code from TOTP app

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "businessDate": "2026-04-20",
    "user": { /* User profile */ }
  },
  "message": "MFA verification successful",
  "errorCode": null
}
```

**Error Responses:**

Invalid MFA Challenge (401):
```json
{
  "status": "ERROR",
  "errorCode": "INVALID_MFA_CHALLENGE",
  "message": "MFA challenge invalid or expired. Please sign in again."
}
```

MFA Challenge Reused (401):
```json
{
  "status": "ERROR",
  "errorCode": "MFA_CHALLENGE_REUSED",
  "message": "This MFA challenge has already been used."
}
```

Invalid OTP (401):
```json
{
  "status": "ERROR",
  "errorCode": "MFA_VERIFICATION_FAILED",
  "message": "Invalid OTP code"
}
```

---

### 3. POST `/refresh` - Token Refresh

**Purpose:** Exchange valid refresh token for new access token (implements refresh token rotation).

**Method:** `POST`

**Authentication:** None (uses refreshToken from previous `/token` or `/refresh` response)

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Request Validation:**
- `refreshToken`: Required, non-blank JWT refresh token

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "businessDate": "2026-04-20",
    "user": { /* Updated user profile */ }
  },
  "message": "Token refreshed successfully",
  "errorCode": null
}
```

**Error Responses:**

Invalid/Expired Refresh Token (401):
```json
{
  "status": "ERROR",
  "errorCode": "INVALID_REFRESH_TOKEN",
  "message": "Refresh token invalid or expired"
}
```

Refresh Token Reused/Stolen (401):
```json
{
  "status": "ERROR",
  "errorCode": "REFRESH_TOKEN_REUSED",
  "message": "Refresh token has already been used. Re-authenticate via /api/v1/auth/token."
}
```

Legacy Token (401):
```json
{
  "status": "ERROR",
  "errorCode": "LEGACY_REFRESH_TOKEN",
  "message": "Refresh token predates rotation policy. Please re-authenticate via /api/v1/auth/token."
}
```

**Frontend Implementation Notes:**
- Implement automatic token refresh 60 seconds before expiry
- Always use the **new** refresh token returned by `/refresh` for the next refresh cycle (refresh token rotation)
- If you receive **REFRESH_TOKEN_REUSED**, immediately redirect to login (possible token theft)
- Update user profile and business date from refresh response

---

## CUSTOMER MODULE (CIF)

**Base Path:** `/v1/customers` (NOTE: `/v1` not `/api/v1`)

### 1. POST `/` - Create Customer

**Purpose:** Create new customer with auto-generated CIF number.

**Method:** `POST`

**Authorization:** MAKER, ADMIN

**Request Body:**
```json
{
  "firstName": "Rajesh",
  "lastName": "Kumar",
  "dateOfBirth": "1980-05-15",
  "panNumber": "ABCPK1234A",
  "aadhaarNumber": "123456789012",
  "mobileNumber": "9876543210",
  "email": "rajesh.kumar@example.com",
  "address": "123 Main Street",
  "city": "Mumbai",
  "state": "MH",
  "pinCode": "400001",
  "customerType": "INDIVIDUAL",
  "branchId": 1,
  "gender": "M",
  "fatherName": "Suresh Kumar",
  "motherName": "Priya Kumar",
  "spouseName": "Asha Kumar",
  "nationality": "INDIAN",
  "maritalStatus": "MARRIED",
  "occupationCode": "SALARIED",
  "annualIncomeBand": "25L-50L",
  "kycRiskCategory": "MEDIUM",
  "pep": false,
  "kycMode": "ONLINE",
  "photoIdType": "PASSPORT",
  "photoIdNumber": "F1234567",
  "addressProofType": "UTILITY_BILL",
  "addressProofNumber": "MHPWR123456",
  "permanentAddress": "123 Main Street",
  "permanentCity": "Mumbai",
  "permanentState": "MH",
  "permanentPinCode": "400001",
  "permanentCountry": "INDIA",
  "addressSameAsPermanent": true,
  "monthlyIncome": 150000,
  "maxBorrowingLimit": 5000000,
  "employmentType": "SALARIED",
  "employerName": "Tech Corp Ltd",
  "cibilScore": 750,
  "nomineeDob": "1982-06-20",
  "nomineeAddress": "456 Side Street, Mumbai",
  "nomineeGuardianName": "Ramesh Kumar"
}
```

**Request Validation:**
- `firstName`: Required, non-blank string
- `lastName`: Required, non-blank string
- `dateOfBirth`: LocalDate (YYYY-MM-DD)
- `branchId`: Required, positive integer (branch must exist)
- `panNumber`: Optional, max 10 characters
- `aadhaarNumber`: Optional, max 12 characters
- `pep`: Optional, Boolean wrapper (null = not provided)
- `addressSameAsPermanent`: Optional, Boolean wrapper
- `monthlyIncome`: Optional, positive BigDecimal
- `maxBorrowingLimit`: Optional, positive BigDecimal
- `cibilScore`: Optional, integer

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "customerNumber": "CUST001",
    "firstName": "Rajesh",
    "lastName": "Kumar",
    "maskedPan": "****1234A",
    "maskedAadhaar": "****6789012",
    "maskedMobile": "****3210",
    "email": "rajesh.kumar@example.com",
    "customerType": "INDIVIDUAL",
    "gender": "M",
    "dateOfBirth": "1980-05-15",
    "maritalStatus": "MARRIED",
    "fatherName": "Suresh Kumar",
    "motherName": "Priya Kumar",
    "nationality": "INDIAN",
    "occupationCode": "SALARIED",
    "annualIncomeBand": "25L-50L",
    "kycVerified": false,
    "kycRiskCategory": "MEDIUM",
    "kycExpiryDate": null,
    "rekycDue": false,
    "pep": false,
    "ckycStatus": "NOT_SUBMITTED",
    "ckycNumber": null,
    "kycMode": "ONLINE",
    "address": "123 Main Street",
    "city": "Mumbai",
    "state": "MH",
    "pinCode": "400001",
    "monthlyIncome": 150000,
    "maxBorrowingLimit": 5000000,
    "employmentType": "SALARIED",
    "employerName": "Tech Corp Ltd",
    "cibilScore": 750,
    "active": true,
    "branchCode": "HQ001",
    "createdAt": "2026-04-20T10:30:00"
  },
  "message": "Customer created: CUST001",
  "errorCode": null
}
```

**Error Responses:**

Duplicate Customer (400):
```json
{
  "status": "ERROR",
  "errorCode": "DUPLICATE_CUSTOMER",
  "message": "Customer with this PAN/Aadhaar already exists"
}
```

Branch Not Found (404):
```json
{
  "status": "ERROR",
  "errorCode": "BRANCH_NOT_FOUND",
  "message": "Branch with ID 999 not found"
}
```

Validation Error (400):
```json
{
  "status": "ERROR",
  "errorCode": "VALIDATION_ERROR",
  "message": "firstName: must not be blank"
}
```

---

### 2. GET `/{id}` - Get Customer

**Purpose:** Retrieve customer details by ID.

**Method:** `GET`

**Authorization:** MAKER, CHECKER, ADMIN

**URL Parameters:**
- `id`: Long (customer database ID)

**Example:** `GET /v1/customers/1`

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "customerNumber": "CUST001",
    "firstName": "Rajesh",
    "lastName": "Kumar",
    "maskedPan": "****1234A",
    "maskedAadhaar": "****6789012",
    "maskedMobile": "****3210",
    "email": "rajesh.kumar@example.com",
    /* ... other fields ... */
    "active": true,
    "branchCode": "HQ001",
    "createdAt": "2026-04-20T10:30:00"
  },
  "message": null,
  "errorCode": null
}
```

**Error Response:**

Not Found (404):
```json
{
  "status": "ERROR",
  "errorCode": "CUSTOMER_NOT_FOUND",
  "message": "Customer with ID 999 not found"
}
```

---

### 3. PUT `/{id}` - Update Customer

**Purpose:** Update mutable customer fields (PAN/Aadhaar/Customer# are immutable).

**Method:** `PUT`

**Authorization:** MAKER, ADMIN

**URL Parameters:**
- `id`: Long (customer database ID)

**Request Body:**
```json
{
  "firstName": "Rajesh",
  "lastName": "Kumar",
  "email": "newemail@example.com",
  "mobileNumber": "9876543210",
  "address": "456 New Street",
  "city": "Bangalore",
  "state": "KA",
  "pinCode": "560001",
  "monthlyIncome": 200000,
  "maxBorrowingLimit": 7000000,
  /* ... other mutable fields ... */
}
```

**Important:**
- Do **NOT** send `panNumber` or `aadhaarNumber` in update request; they are immutable
- If you send them, the API will reject with 400 error:

```json
{
  "status": "ERROR",
  "errorCode": "IMMUTABLE_FIELD",
  "message": "PAN number is immutable after creation. Cannot be changed via update."
}
```

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "customerNumber": "CUST001",
    /* ... updated fields ... */
  },
  "message": "Customer updated: CUST001",
  "errorCode": null
}
```

---

### 4. POST `/{id}/verify-kyc` - Verify KYC

**Purpose:** Verify customer KYC (CHECKER/ADMIN only).

**Method:** `POST`

**Authorization:** CHECKER, ADMIN

**URL Parameters:**
- `id`: Long (customer database ID)

**Request Body:** Empty (no body required)

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "customerNumber": "CUST001",
    "kycVerified": true,
    "kycExpiryDate": "2029-04-20",
    /* ... other fields ... */
  },
  "message": "KYC verified",
  "errorCode": null
}
```

---

### 5. POST `/{id}/deactivate` - Deactivate Customer

**Purpose:** Deactivate customer account (ADMIN only).

**Method:** `POST`

**Authorization:** ADMIN

**URL Parameters:**
- `id`: Long (customer database ID)

**Request Body:** Empty

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "customerNumber": "CUST001",
    "active": false,
    /* ... other fields ... */
  },
  "message": "Customer deactivated",
  "errorCode": null
}
```

---

### 6. GET `/search` - Search Customers

**Purpose:** Search customers by name, CIF, or mobile (branch-scoped for MAKER/CHECKER).

**Method:** `GET`

**Authorization:** MAKER, CHECKER, ADMIN

**Query Parameters:**
- `q`: Required, search query string (min 2 chars)

**Example:** `GET /v1/customers/search?q=rajesh`

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": [
    {
      "id": 1,
      "customerNumber": "CUST001",
      "firstName": "Rajesh",
      "lastName": "Kumar",
      "maskedPan": "****1234A",
      "maskedMobile": "****3210",
      "branchCode": "HQ001",
      "active": true
      /* ... other fields ... */
    }
  ],
  "message": null,
  "errorCode": null
}
```

**Search Fields:** firstName, lastName, customerNumber, mobileNumber

---

## DEPOSIT ACCOUNTS MODULE (CASA)

**Base Path:** `/v1/accounts`

### 1. POST `/open` - Open Deposit Account

**Purpose:** Open new savings/current account in PENDING_ACTIVATION status.

**Method:** `POST`

**Authorization:** MAKER, ADMIN

**Request Body:**
```json
{
  "customerId": 1,
  "branchId": 1,
  "accountType": "SAVINGS",
  "productCode": "SAV001",
  "initialDeposit": 10000,
  "nomineeName": "Priya Kumar",
  "nomineeRelationship": "SPOUSE"
}
```

**Request Validation:**
- `customerId`: Required, positive Long
- `branchId`: Required, positive Long
- `accountType`: Required, string (SAVINGS|CURRENT|OVERDRAFT|etc.)
- `productCode`: Optional, defaults to accountType
- `initialDeposit`: Optional, non-negative BigDecimal
- `nomineeName`: Optional, string
- `nomineeRelationship`: Optional, string

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "accountNumber": "CASA0001",
    "accountType": "SAVINGS",
    "productCode": "SAV001",
    "status": "PENDING_ACTIVATION",
    "branchCode": "HQ001",
    "currencyCode": "INR",
    "ledgerBalance": 10000,
    "availableBalance": 10000,
    "holdAmount": 0,
    "odLimit": 0,
    "interestRate": 3.5,
    "accruedInterest": 0,
    "openedDate": "2026-04-20",
    "lastTransactionDate": null,
    "nomineeName": "Priya Kumar",
    "chequeBookEnabled": false,
    "debitCardEnabled": false
  },
  "message": "Account opened in PENDING_ACTIVATION",
  "errorCode": null
}
```

---

### 2. POST `/{accountNumber}/activate` - Activate Account

**Purpose:** Activate PENDING_ACTIVATION account (CHECKER/ADMIN only).

**Method:** `POST`

**Authorization:** CHECKER, ADMIN

**URL Parameters:**
- `accountNumber`: String (e.g., CASA0001)

**Request Body:** Empty

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "accountNumber": "CASA0001",
    "status": "ACTIVE",
    /* ... other fields ... */
  },
  "message": "Account activated",
  "errorCode": null
}
```

---

### 3. POST `/{accountNumber}/freeze` - Freeze Account

**Purpose:** Freeze account (block all transactions). ADMIN only.

**Method:** `POST`

**Authorization:** ADMIN

**URL Parameters:**
- `accountNumber`: String

**Request Body:**
```json
{
  "freezeType": "REGULATORY",
  "reason": "Court order received"
}
```

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "accountNumber": "CASA0001",
    "status": "FROZEN",
    /* ... other fields ... */
  },
  "message": "Account frozen: REGULATORY",
  "errorCode": null
}
```

---

### 4. POST `/{accountNumber}/unfreeze` - Unfreeze Account

**Purpose:** Unfreeze frozen account. ADMIN only.

**Method:** `POST`

**Authorization:** ADMIN

**URL Parameters:**
- `accountNumber`: String

**Request Body:** Empty

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "accountNumber": "CASA0001",
    "status": "ACTIVE",
    /* ... other fields ... */
  },
  "message": "Account unfrozen",
  "errorCode": null
}
```

---

### 5. POST `/{accountNumber}/close` - Close Account

**Purpose:** Close account (moved to CLOSED status). CHECKER/ADMIN only.

**Method:** `POST`

**Authorization:** CHECKER, ADMIN

**URL Parameters:**
- `accountNumber`: String

**Request Body:**
```json
{
  "reason": "Customer requested closure"
}
```

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "accountNumber": "CASA0001",
    "status": "CLOSED",
    /* ... other fields ... */
  },
  "message": "Account closed",
  "errorCode": null
}
```

---

### 6. POST `/{accountNumber}/deposit` - Deposit Cash

**Purpose:** Post deposit transaction (GL: DR CASA / CR CUSTOMER GL).

**Method:** `POST`

**Authorization:** MAKER, ADMIN

**URL Parameters:**
- `accountNumber`: String

**Request Body:**
```json
{
  "amount": 50000,
  "narration": "Cash deposited at counter",
  "idempotencyKey": "DEP20260420001",
  "channel": "COUNTER"
}
```

**Request Validation:**
- `amount`: Required, positive BigDecimal
- `narration`: Optional, string
- `idempotencyKey`: Optional, unique identifier for idempotency
- `channel`: Optional, defaults to "API"

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "transactionRef": "TXN0001",
    "transactionType": "DEPOSIT",
    "debitCredit": "CR",
    "amount": 50000,
    "balanceAfter": 60000,
    "valueDate": "2026-04-20",
    "postingDate": "2026-04-20",
    "narration": "Cash deposited at counter",
    "counterpartyAccount": null,
    "channel": "COUNTER",
    "voucherNumber": "DEP0001",
    "branchCode": "HQ001",
    "reversed": false
  },
  "message": null,
  "errorCode": null
}
```

---

### 7. POST `/{accountNumber}/withdraw` - Withdraw Cash

**Purpose:** Post withdrawal transaction.

**Method:** `POST`

**Authorization:** MAKER, ADMIN

**URL Parameters:**
- `accountNumber`: String

**Request Body:**
```json
{
  "amount": 25000,
  "narration": "Counter withdrawal",
  "idempotencyKey": "WTH20260420001",
  "channel": "COUNTER"
}
```

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 2,
    "transactionRef": "TXN0002",
    "transactionType": "WITHDRAWAL",
    "debitCredit": "DR",
    "amount": 25000,
    "balanceAfter": 35000,
    "valueDate": "2026-04-20",
    "postingDate": "2026-04-20",
    "narration": "Counter withdrawal",
    "counterpartyAccount": null,
    "channel": "COUNTER",
    "voucherNumber": "WTH0001",
    "branchCode": "HQ001",
    "reversed": false
  },
  "message": null,
  "errorCode": null
}
```

---

### 8. POST `/transfer` - Transfer Funds

**Purpose:** Transfer funds between accounts (GL: DR FROM / CR TO).

**Method:** `POST`

**Authorization:** MAKER, ADMIN

**Request Body:**
```json
{
  "fromAccount": "CASA0001",
  "toAccount": "CASA0002",
  "amount": 10000,
  "narration": "Inter-account transfer",
  "idempotencyKey": "TRF20260420001"
}
```

**Request Validation:**
- `fromAccount`: Required, non-blank string
- `toAccount`: Required, non-blank string
- `amount`: Required, positive BigDecimal
- `narration`: Optional, string
- `idempotencyKey`: Optional, unique identifier

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 3,
    "transactionRef": "TXN0003",
    "transactionType": "TRANSFER",
    "debitCredit": "DR",
    "amount": 10000,
    "balanceAfter": 25000,
    "valueDate": "2026-04-20",
    "postingDate": "2026-04-20",
    "narration": "Inter-account transfer",
    "counterpartyAccount": "CASA0002",
    "channel": "API",
    "voucherNumber": "TRF0001",
    "branchCode": "HQ001",
    "reversed": false
  },
  "message": null,
  "errorCode": null
}
```

---

### 9. POST `/reversal/{transactionRef}` - Reverse Transaction

**Purpose:** Reverse a posted transaction (posts symmetric contra booking). CHECKER/ADMIN only.

**Method:** `POST`

**Authorization:** CHECKER, ADMIN

**URL Parameters:**
- `transactionRef`: String (e.g., TXN0003)

**Request Body:**
```json
{
  "reason": "Posted in error"
}
```

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 4,
    "transactionRef": "TXN0003R",
    "transactionType": "REVERSAL",
    "debitCredit": "CR",
    "amount": 10000,
    "balanceAfter": 35000,
    "valueDate": "2026-04-20",
    "postingDate": "2026-04-20",
    "narration": "Reversal of TXN0003",
    "counterpartyAccount": null,
    "channel": "API",
    "voucherNumber": "REV0001",
    "branchCode": "HQ001",
    "reversed": true
  },
  "message": "Transaction reversed",
  "errorCode": null
}
```

---

### 10. GET `/{accountNumber}` - Get Account

**Purpose:** Retrieve account details.

**Method:** `GET`

**Authorization:** MAKER, CHECKER, ADMIN

**URL Parameters:**
- `accountNumber`: String

**Example:** `GET /v1/accounts/CASA0001`

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "accountNumber": "CASA0001",
    "accountType": "SAVINGS",
    "productCode": "SAV001",
    "status": "ACTIVE",
    "branchCode": "HQ001",
    "currencyCode": "INR",
    "ledgerBalance": 60000,
    "availableBalance": 60000,
    "holdAmount": 0,
    "odLimit": 0,
    "interestRate": 3.5,
    "accruedInterest": 150,
    "openedDate": "2026-04-20",
    "lastTransactionDate": "2026-04-20",
    "nomineeName": "Priya Kumar",
    "chequeBookEnabled": false,
    "debitCardEnabled": false
  },
  "message": null,
  "errorCode": null
}
```

---

### 11. GET `/{accountNumber}/balance` - Get Balance (Real-time)

**Purpose:** Get real-time balance for UPI/IMPS integration.

**Method:** `GET`

**Authorization:** MAKER, CHECKER, ADMIN

**URL Parameters:**
- `accountNumber`: String

**Example:** `GET /v1/accounts/CASA0001/balance`

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "accountNumber": "CASA0001",
    "status": "ACTIVE",
    "ledgerBalance": 60000,
    "availableBalance": 60000,
    "holdAmount": 0,
    "unclearedAmount": 0,
    "odLimit": 0,
    "effectiveAvailable": 60000
  },
  "message": null,
  "errorCode": null
}
```

---

### 12. GET `/{accountNumber}/mini-statement` - Mini Statement

**Purpose:** Get last N transactions (default 10, max 50).

**Method:** `GET`

**Authorization:** MAKER, CHECKER, ADMIN

**URL Parameters:**
- `accountNumber`: String
- `count`: Optional Query Param, integer (default 10, max 50)

**Example:** `GET /v1/accounts/CASA0001/mini-statement?count=20`

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": [
    {
      "id": 3,
      "transactionRef": "TXN0003",
      "transactionType": "TRANSFER",
      "debitCredit": "DR",
      "amount": 10000,
      "balanceAfter": 25000,
      "valueDate": "2026-04-20",
      "postingDate": "2026-04-20",
      "narration": "Inter-account transfer",
      "counterpartyAccount": "CASA0002",
      "channel": "API",
      "voucherNumber": "TRF0001",
      "branchCode": "HQ001",
      "reversed": false
    },
    {
      "id": 2,
      "transactionRef": "TXN0002",
      "transactionType": "WITHDRAWAL",
      "debitCredit": "DR",
      "amount": 25000,
      "balanceAfter": 35000,
      "valueDate": "2026-04-20",
      "postingDate": "2026-04-20",
      "narration": "Counter withdrawal",
      "counterpartyAccount": null,
      "channel": "COUNTER",
      "voucherNumber": "WTH0001",
      "branchCode": "HQ001",
      "reversed": false
    }
  ],
  "message": null,
  "errorCode": null
}
```

---

### 13. GET `/{accountNumber}/statement` - Statement

**Purpose:** Get statement for date range.

**Method:** `GET`

**Authorization:** MAKER, CHECKER, ADMIN

**URL Parameters:**
- `accountNumber`: String
- `fromDate`: Required Query Param, string (YYYY-MM-DD)
- `toDate`: Required Query Param, string (YYYY-MM-DD)

**Example:** `GET /v1/accounts/CASA0001/statement?fromDate=2026-04-01&toDate=2026-04-20`

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "accountNumber": "CASA0001",
    "accountType": "SAVINGS",
    "fromDate": "2026-04-01",
    "toDate": "2026-04-20",
    "ledgerBalance": 60000,
    "availableBalance": 60000,
    "transactionCount": 2,
    "transactions": [
      /* Transaction list as above */
    ]
  },
  "message": null,
  "errorCode": null
}
```

---

### 14. GET `/customer/{customerId}` - Get Accounts by Customer

**Purpose:** Get all accounts for a customer.

**Method:** `GET`

**Authorization:** MAKER, CHECKER, ADMIN

**URL Parameters:**
- `customerId`: Long

**Example:** `GET /v1/accounts/customer/1`

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": [
    {
      "id": 1,
      "accountNumber": "CASA0001",
      "accountType": "SAVINGS",
      "status": "ACTIVE",
      /* ... other fields ... */
    },
    {
      "id": 2,
      "accountNumber": "CASA0002",
      "accountType": "CURRENT",
      "status": "ACTIVE",
      /* ... other fields ... */
    }
  ],
  "message": null,
  "errorCode": null
}
```

---

### 15. GET `/` - List Accounts (Paginated)

**Purpose:** List accounts for branch (branch-scoped for MAKER/CHECKER).

**Method:** `GET`

**Authorization:** MAKER, CHECKER, ADMIN

**Query Parameters:**
- `branchId`: Optional Long (ADMIN can cross-branch; MAKERs limited to home branch)
- `page`: Optional integer (default 0)
- `size`: Optional integer (default 20, max 200)

**Example:** `GET /v1/accounts?page=0&size=20`

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "content": [
      {
        "id": 1,
        "accountNumber": "CASA0001",
        "accountType": "SAVINGS",
        "status": "ACTIVE",
        /* ... */
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 150
  },
  "message": null,
  "errorCode": null
}
```

---

## LOAN APPLICATION MODULE

**Base Path:** `/v1/loan-applications`

### 1. POST `/` - Submit Loan Application

**Purpose:** Submit new loan application (auto-generates application number).

**Method:** `POST`

**Authorization:** MAKER, ADMIN

**Request Body:**
```json
{
  "customerId": 1,
  "branchId": 1,
  "productType": "PERSONAL_LOAN",
  "requestedAmount": 500000,
  "interestRate": 12.5,
  "tenureMonths": 60,
  "purpose": "Home renovation",
  "collateralReference": "COLLATERAL001",
  "disbursementAccountNumber": "CASA0001",
  "penalRate": 2.5
}
```

**Request Validation:**
- `customerId`: Required, positive Long
- `branchId`: Required, positive Long
- `productType`: Required, non-blank string
- `requestedAmount`: Required, positive BigDecimal
- `interestRate`: Required, positive BigDecimal (percentage)
- `tenureMonths`: Required, positive integer
- `purpose`: Optional, string
- `collateralReference`: Optional, string
- `disbursementAccountNumber`: Optional, string
- `penalRate`: Optional, positive BigDecimal

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "applicationNumber": "APP00001",
    "status": "SUBMITTED",
    "productType": "PERSONAL_LOAN",
    "requestedAmount": 500000,
    "approvedAmount": null,
    "interestRate": 12.5,
    "tenureMonths": 60,
    "purpose": "Home renovation",
    "customerNumber": "CUST001",
    "branchCode": "HQ001",
    "applicationDate": "2026-04-20",
    "verifiedBy": null,
    "approvedBy": null,
    "rejectionReason": null
  },
  "message": "Application submitted: APP00001",
  "errorCode": null
}
```

---

### 2. GET `/{id}` - Get Application

**Purpose:** Retrieve loan application by ID.

**Method:** `GET`

**Authorization:** MAKER, CHECKER, ADMIN

**URL Parameters:**
- `id`: Long (application database ID)

**Example:** `GET /v1/loan-applications/1`

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "applicationNumber": "APP00001",
    "status": "SUBMITTED",
    /* ... other fields ... */
  },
  "message": null,
  "errorCode": null
}
```

---

### 3. POST `/{id}/verify` - Verify Application

**Purpose:** Verify loan application (CHECKER/ADMIN only). Requires remarks.

**Method:** `POST`

**Authorization:** CHECKER, ADMIN

**URL Parameters:**
- `id`: Long

**Request Body:**
```json
{
  "remarks": "Documents verified. Customer eligible. Recommend for approval."
}
```

**Request Validation:**
- `remarks`: Required, non-blank string

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "applicationNumber": "APP00001",
    "status": "VERIFIED",
    "verifiedBy": "checker1",
    /* ... other fields ... */
  },
  "message": "Application verified",
  "errorCode": null
}
```

**RBI Maker-Checker Rule:**
- The application MAKER cannot verify their own application (enforced in service layer)
- Attempting to do so returns 400 error

---

### 4. POST `/{id}/approve` - Approve Application

**Purpose:** Approve loan application (CHECKER/ADMIN only).

**Method:** `POST`

**Authorization:** CHECKER, ADMIN

**URL Parameters:**
- `id`: Long

**Request Body:**
```json
{
  "remarks": "Approved by credit committee. Proceed to account creation."
}
```

**Request Validation:**
- `remarks`: Required, non-blank string

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "applicationNumber": "APP00001",
    "status": "APPROVED",
    "approvedAmount": 500000,
    "approvedBy": "checker1",
    /* ... other fields ... */
  },
  "message": "Application approved",
  "errorCode": null
}
```

---

### 5. POST `/{id}/reject` - Reject Application

**Purpose:** Reject loan application (CHECKER/ADMIN only). Requires mandatory reason.

**Method:** `POST`

**Authorization:** CHECKER, ADMIN

**URL Parameters:**
- `id`: Long

**Request Body:**
```json
{
  "reason": "Inadequate income documentation. Annual income unverifiable."
}
```

**Request Validation:**
- `reason`: Required, non-blank string

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "applicationNumber": "APP00001",
    "status": "REJECTED",
    "rejectionReason": "Inadequate income documentation. Annual income unverifiable.",
    /* ... other fields ... */
  },
  "message": "Application rejected",
  "errorCode": null
}
```

---

### 6. GET `/customer/{customerId}` - Get Applications by Customer

**Purpose:** Get all loan applications for a customer.

**Method:** `GET`

**Authorization:** MAKER, CHECKER, ADMIN

**URL Parameters:**
- `customerId`: Long

**Example:** `GET /v1/loan-applications/customer/1`

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": [
    {
      "id": 1,
      "applicationNumber": "APP00001",
      "status": "APPROVED",
      /* ... */
    }
  ],
  "message": null,
  "errorCode": null
}
```

---

### 7. GET `/status/{status}` - Get Applications by Status

**Purpose:** Get applications by status (SUBMITTED|VERIFIED|APPROVED|REJECTED).

**Method:** `GET`

**Authorization:** CHECKER, ADMIN

**URL Parameters:**
- `status`: String (SUBMITTED|VERIFIED|APPROVED|REJECTED)

**Example:** `GET /v1/loan-applications/status/APPROVED`

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": [
    {
      "id": 1,
      "applicationNumber": "APP00001",
      "status": "APPROVED",
      /* ... */
    }
  ],
  "message": null,
  "errorCode": null
}
```

---

## LOAN ACCOUNT MODULE

**Base Path:** `/v1/loans`

### 1. POST `/create-account/{applicationId}` - Create Loan Account

**Purpose:** Create loan account from approved application (CHECKER/ADMIN only).

**Method:** `POST`

**Authorization:** CHECKER, ADMIN

**URL Parameters:**
- `applicationId`: Long (approved loan application ID)

**Request Body:** Empty

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "accountNumber": "LOAN0001",
    "status": "CREATED",
    "productType": "PERSONAL_LOAN",
    "currencyCode": "INR",
    "sanctionedAmount": 500000,
    "disbursedAmount": 0,
    "outstandingPrincipal": 0,
    "outstandingInterest": 0,
    "totalOutstanding": 0,
    "interestRate": 12.5,
    "daysPastDue": 0,
    "branchCode": "HQ001",
    "disbursementDate": null,
    "maturityDate": "2030-04-20",
    "fullyDisbursed": false
  },
  "message": "Loan account created",
  "errorCode": null
}
```

---

### 2. POST `/{accountNumber}/disburse` - Disburse Full Loan

**Purpose:** Disburse full loan amount (CHECKER/ADMIN only).

**Method:** `POST`

**Authorization:** CHECKER, ADMIN

**URL Parameters:**
- `accountNumber`: String

**Request Body:** Empty

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "accountNumber": "LOAN0001",
    "status": "ACTIVE",
    "disbursedAmount": 500000,
    "outstandingPrincipal": 500000,
    "totalOutstanding": 500000,
    "disbursementDate": "2026-04-20",
    "fullyDisbursed": true,
    /* ... other fields ... */
  },
  "message": "Loan disbursed",
  "errorCode": null
}
```

---

### 3. POST `/{accountNumber}/disburse-tranche` - Disburse Tranche

**Purpose:** Disburse partial amount for multi-tranche products (CHECKER/ADMIN only).

**Method:** `POST`

**Authorization:** CHECKER, ADMIN

**URL Parameters:**
- `accountNumber`: String

**Request Body:**
```json
{
  "amount": 100000,
  "narration": "First tranche disbursed"
}
```

**Request Validation:**
- `amount`: Required, positive BigDecimal
- `narration`: Optional, string

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "accountNumber": "LOAN0001",
    "disbursedAmount": 100000,
    "outstandingPrincipal": 100000,
    "fullyDisbursed": false,
    /* ... other fields ... */
  },
  "message": "Tranche disbursed",
  "errorCode": null
}
```

---

### 4. POST `/{accountNumber}/repayment` - Process Loan Repayment

**Purpose:** Process EMI or ad-hoc repayment (MAKER/ADMIN).

**Method:** `POST`

**Authorization:** MAKER, ADMIN

**URL Parameters:**
- `accountNumber`: String

**Request Body:**
```json
{
  "amount": 10000,
  "idempotencyKey": "REP20260420001"
}
```

**Request Validation:**
- `amount`: Required, positive BigDecimal
- `idempotencyKey`: Optional, unique identifier

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "transactionRef": "LNTXN0001",
    "transactionType": "REPAYMENT",
    "amount": 10000,
    "valueDate": "2026-04-20",
    "narration": "EMI repayment",
    "voucherNumber": "REP0001"
  },
  "message": null,
  "errorCode": null
}
```

---

### 5. POST `/{accountNumber}/prepayment` - Process Prepayment/Foreclosure

**Purpose:** Prepay full amount (RBI Fair Lending Code 2023: no penalty on floating rate).

**Method:** `POST`

**Authorization:** MAKER, ADMIN

**URL Parameters:**
- `accountNumber`: String

**Request Body:**
```json
{
  "amount": 500000,
  "idempotencyKey": "PREP20260420001"
}
```

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "transactionRef": "LNTXN0002",
    "transactionType": "PREPAYMENT",
    "amount": 500000,
    "valueDate": "2026-04-20",
    "narration": "Full prepayment",
    "voucherNumber": "PREP0001"
  },
  "message": "Prepayment processed",
  "errorCode": null
}
```

---

### 6. POST `/{accountNumber}/fee` - Charge Fee

**Purpose:** Charge processing/documentation/other fees (MAKER/ADMIN).

**Method:** `POST`

**Authorization:** MAKER, ADMIN

**URL Parameters:**
- `accountNumber`: String

**Request Body:**
```json
{
  "amount": 5000,
  "feeType": "PROCESSING_FEE"
}
```

**Request Validation:**
- `amount`: Required, positive BigDecimal
- `feeType`: Required, non-blank string

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "transactionRef": "LNTXN0003",
    "transactionType": "FEE",
    "amount": 5000,
    "valueDate": "2026-04-20",
    "narration": "Processing fee",
    "voucherNumber": "FEE0001"
  },
  "message": null,
  "errorCode": null
}
```

---

### 7. POST `/reversal/{transactionRef}` - Reverse Loan Transaction

**Purpose:** Reverse loan transaction (CHECKER/ADMIN only).

**Method:** `POST`

**Authorization:** CHECKER, ADMIN

**URL Parameters:**
- `transactionRef`: String

**Request Body:**
```json
{
  "reason": "Posted in error"
}
```

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "transactionRef": "LNTXN0003R",
    "transactionType": "REVERSAL",
    "amount": 5000,
    "valueDate": "2026-04-20",
    "narration": "Reversal of fee",
    "voucherNumber": "REV0001"
  },
  "message": "Transaction reversed",
  "errorCode": null
}
```

---

### 8. POST `/{accountNumber}/rate-reset` - Floating Rate Reset

**Purpose:** Reset floating rate per RBI EBLR/MCLR framework (ADMIN only).

**Method:** `POST`

**Authorization:** ADMIN

**URL Parameters:**
- `accountNumber`: String

**Request Body:**
```json
{
  "newBenchmarkRate": 8.5
}
```

**Request Validation:**
- `newBenchmarkRate`: Required, positive BigDecimal

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "accountNumber": "LOAN0001",
    "interestRate": 21.5,
    /* ... other fields ... */
  },
  "message": "Rate reset applied",
  "errorCode": null
}
```

---

### 9. POST `/{accountNumber}/write-off` - Write-Off NPA Loss

**Purpose:** Write-off NPA Loss account per RBI IRAC (ADMIN only).

**Method:** `POST`

**Authorization:** ADMIN

**URL Parameters:**
- `accountNumber`: String

**Request Body:** Empty

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "accountNumber": "LOAN0001",
    "status": "WRITTEN_OFF",
    /* ... other fields ... */
  },
  "message": "Account written off",
  "errorCode": null
}
```

---

### 10. GET `/{accountNumber}` - Get Loan Account

**Purpose:** Retrieve loan account details.

**Method:** `GET`

**Authorization:** MAKER, CHECKER, ADMIN

**URL Parameters:**
- `accountNumber`: String

**Example:** `GET /v1/loans/LOAN0001`

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "accountNumber": "LOAN0001",
    "status": "ACTIVE",
    "productType": "PERSONAL_LOAN",
    "currencyCode": "INR",
    "sanctionedAmount": 500000,
    "disbursedAmount": 500000,
    "outstandingPrincipal": 490000,
    "outstandingInterest": 5000,
    "totalOutstanding": 495000,
    "interestRate": 12.5,
    "daysPastDue": 0,
    "branchCode": "HQ001",
    "disbursementDate": "2026-04-20",
    "maturityDate": "2030-04-20",
    "fullyDisbursed": true
  },
  "message": null,
  "errorCode": null
}
```

---

### 11. GET `/active` - Get Active Loan Accounts

**Purpose:** Get all active loan accounts (dashboard summary).

**Method:** `GET`

**Authorization:** MAKER, CHECKER, ADMIN

**Example:** `GET /v1/loans/active`

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": [
    {
      "id": 1,
      "accountNumber": "LOAN0001",
      "status": "ACTIVE",
      /* ... */
    }
  ],
  "message": null,
  "errorCode": null
}
```

---

## FIXED DEPOSIT MODULE

**Base Path:** `/v1/fixed-deposits`

### 1. POST `/book` - Book Fixed Deposit

**Purpose:** Book FD from linked CASA (GL: DR CASA / CR FD).

**Method:** `POST`

**Authorization:** MAKER, ADMIN

**Request Body:**
```json
{
  "customerId": 1,
  "branchId": 1,
  "linkedAccountNumber": "CASA0001",
  "principalAmount": 500000,
  "interestRate": 6.5,
  "tenureDays": 365,
  "interestPayoutMode": "MATURITY",
  "autoRenewalMode": "NO",
  "nomineeName": "Priya Kumar",
  "nomineeRelationship": "SPOUSE"
}
```

**Request Validation:**
- `customerId`: Required, positive Long
- `branchId`: Required, positive Long
- `linkedAccountNumber`: Required, non-blank string
- `principalAmount`: Required, positive BigDecimal
- `interestRate`: Required, positive BigDecimal (percentage)
- `tenureDays`: Required, positive integer
- `interestPayoutMode`: Optional, string (MATURITY|QUARTERLY|MONTHLY)
- `autoRenewalMode`: Optional, string (YES|NO)
- `nomineeName`: Optional, string
- `nomineeRelationship`: Optional, string

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "fdAccountNumber": "FD0001",
    "status": "ACTIVE",
    "principalAmount": 500000,
    "currentPrincipal": 500000,
    "interestRate": 6.5,
    "effectiveRate": 6.5,
    "interestPayoutMode": "MATURITY",
    "accruedInterest": 0,
    "totalInterestPaid": 0,
    "maturityAmount": 532500,
    "tenureDays": 365,
    "bookingDate": "2026-04-20",
    "maturityDate": "2027-04-20",
    "closureDate": null,
    "linkedAccountNumber": "CASA0001",
    "autoRenewalMode": "NO",
    "renewalCount": 0,
    "lienMarked": false,
    "lienAmount": 0,
    "customerNumber": "CUST001",
    "branchCode": "HQ001"
  },
  "message": "FD booked: FD0001",
  "errorCode": null
}
```

---

### 2. POST `/{fdNumber}/premature-close` - Premature Closure

**Purpose:** Close FD before maturity (penalty applies).

**Method:** `POST`

**Authorization:** CHECKER, ADMIN

**URL Parameters:**
- `fdNumber`: String

**Request Body:**
```json
{
  "reason": "Customer requested"
}
```

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "fdAccountNumber": "FD0001",
    "status": "CLOSED",
    "closureDate": "2026-04-20",
    /* ... other fields ... */
  },
  "message": "FD premature closed",
  "errorCode": null
}
```

---

### 3. POST `/{fdNumber}/maturity-close` - Maturity Closure

**Purpose:** Close FD at maturity (full interest credited).

**Method:** `POST`

**Authorization:** CHECKER, ADMIN

**URL Parameters:**
- `fdNumber`: String

**Request Body:** Empty

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "fdAccountNumber": "FD0001",
    "status": "MATURED",
    "closureDate": "2027-04-20",
    /* ... other fields ... */
  },
  "message": "FD maturity closed",
  "errorCode": null
}
```

---

### 4. POST `/{fdNumber}/lien/mark` - Mark Lien

**Purpose:** Mark FD as collateral for loan (blocks withdrawal).

**Method:** `POST`

**Authorization:** CHECKER, ADMIN

**URL Parameters:**
- `fdNumber`: String

**Request Body:**
```json
{
  "lienAmount": 200000,
  "loanAccountNumber": "LOAN0001"
}
```

**Request Validation:**
- `lienAmount`: Required, positive BigDecimal
- `loanAccountNumber`: Required, non-blank string

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "fdAccountNumber": "FD0001",
    "lienMarked": true,
    "lienAmount": 200000,
    /* ... other fields ... */
  },
  "message": "Lien marked",
  "errorCode": null
}
```

---

### 5. POST `/{fdNumber}/lien/release` - Release Lien

**Purpose:** Release FD lien mark.

**Method:** `POST`

**Authorization:** CHECKER, ADMIN

**URL Parameters:**
- `fdNumber`: String

**Request Body:** Empty

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "fdAccountNumber": "FD0001",
    "lienMarked": false,
    "lienAmount": 0,
    /* ... other fields ... */
  },
  "message": "Lien released",
  "errorCode": null
}
```

---

### 6. GET `/{fdNumber}` - Get Fixed Deposit

**Purpose:** Retrieve FD details.

**Method:** `GET`

**Authorization:** MAKER, CHECKER, ADMIN

**URL Parameters:**
- `fdNumber`: String

**Example:** `GET /v1/fixed-deposits/FD0001`

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "fdAccountNumber": "FD0001",
    "status": "ACTIVE",
    /* ... full FD details ... */
  },
  "message": null,
  "errorCode": null
}
```

---

### 7. GET `/customer/{customerId}` - Get FDs by Customer

**Purpose:** Get all FDs for a customer.

**Method:** `GET`

**Authorization:** MAKER, CHECKER, ADMIN

**URL Parameters:**
- `customerId`: Long

**Example:** `GET /v1/fixed-deposits/customer/1`

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": [
    {
      "id": 1,
      "fdAccountNumber": "FD0001",
      "status": "ACTIVE",
      /* ... */
    }
  ],
  "message": null,
  "errorCode": null
}
```

---

### 8. GET `/active` - Get Active FDs

**Purpose:** Get active FDs (dashboard summary).

**Method:** `GET`

**Authorization:** CHECKER, ADMIN

**Example:** `GET /v1/fixed-deposits/active`

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": [
    {
      "id": 1,
      "fdAccountNumber": "FD0001",
      "status": "ACTIVE",
      /* ... */
    }
  ],
  "message": null,
  "errorCode": null
}
```

---

## CLEARING MODULE

**Base Path:** `/v1/clearing`

### 1. POST `/outward` - Initiate Outward Clearing

**Purpose:** Initiate outward payment through NEFT/RTGS/IMPS.

**Method:** `POST`

**Authorization:** MAKER, ADMIN

**Request Body:**
```json
{
  "extRef": "EXT20260420001",
  "rail": "NEFT",
  "amount": 100000,
  "customerAccount": "CASA0001",
  "counterpartyIfsc": "HDFC0000001",
  "counterpartyAccount": "123456789012",
  "counterpartyName": "John Doe",
  "narration": "Salary payment",
  "branchId": 1
}
```

**Request Validation:**
- `extRef`: Required, non-blank string
- `rail`: Required, string (NEFT|RTGS|IMPS)
- `amount`: Required, positive BigDecimal
- `customerAccount`: Required, non-blank string
- `counterpartyIfsc`: Required, non-blank string
- `counterpartyAccount`: Required, non-blank string
- `counterpartyName`: Required, non-blank string
- `narration`: Optional, string
- `branchId`: Required, positive Long

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "extRef": "EXT20260420001",
    "utr": null,
    "rail": "NEFT",
    "direction": "OUTWARD",
    "amount": 100000,
    "status": "INITIATED",
    "customerAccount": "CASA0001",
    "branchCode": "HQ001",
    "initiatedAt": "2026-04-20T10:30:00",
    "completedAt": null
  },
  "message": null,
  "errorCode": null
}
```

---

### 2. POST `/outward/approve` - Approve Outward Payment

**Purpose:** Approve pending outward payment (CHECKER/ADMIN only, maker-checker).

**Method:** `POST`

**Authorization:** CHECKER, ADMIN

**Request Body:**
```json
{
  "extRef": "EXT20260420001",
  "workflowId": 1,
  "remarks": "Approved for processing"
}
```

**Request Validation:**
- `extRef`: Required, non-blank string
- `workflowId`: Required, positive Long
- `remarks`: Optional, string

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "extRef": "EXT20260420001",
    "status": "APPROVED",
    /* ... other fields ... */
  },
  "message": null,
  "errorCode": null
}
```

---

### 3. POST `/inward` - Process Inward Clearing

**Purpose:** Process inward payment from NEFT/RTGS/IMPS.

**Method:** `POST`

**Authorization:** MAKER, ADMIN

**Request Body:**
```json
{
  "extRef": "EXT20260420002",
  "utr": "HDFC1234567890",
  "rail": "NEFT",
  "amount": 50000,
  "beneficiaryAccount": "CASA0001",
  "remitterIfsc": "SBI0000001",
  "remitterAccount": "987654321012",
  "remitterName": "Jane Smith",
  "narration": "Bonus payment",
  "branchId": 1
}
```

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 2,
    "extRef": "EXT20260420002",
    "utr": "HDFC1234567890",
    "rail": "NEFT",
    "direction": "INWARD",
    "amount": 50000,
    "status": "RECEIVED",
    "customerAccount": "CASA0001",
    "branchCode": "HQ001",
    "initiatedAt": "2026-04-20T11:00:00",
    "completedAt": "2026-04-20T11:05:00"
  },
  "message": null,
  "errorCode": null
}
```

---

### 4. POST `/settlement` - Confirm Settlement

**Purpose:** Confirm outward settlement (CHECKER/ADMIN only).

**Method:** `POST`

**Authorization:** CHECKER, ADMIN

**Request Body:**
```json
{
  "extRef": "EXT20260420001",
  "rbiRef": "RBINET20260420001"
}
```

**Request Validation:**
- `extRef`: Required, non-blank string
- `rbiRef`: Required, non-blank string

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "extRef": "EXT20260420001",
    "status": "SETTLED",
    /* ... other fields ... */
  },
  "message": null,
  "errorCode": null
}
```

---

### 5. POST `/reverse` - Reverse Clearing Transaction

**Purpose:** Reverse clearing transaction (CHECKER/ADMIN only).

**Method:** `POST`

**Authorization:** CHECKER, ADMIN

**Request Body:**
```json
{
  "extRef": "EXT20260420001",
  "reason": "Duplicate payment"
}
```

**Request Validation:**
- `extRef`: Required, non-blank string
- `reason`: Required, non-blank string

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "extRef": "EXT20260420001",
    "status": "REVERSED",
    /* ... other fields ... */
  },
  "message": null,
  "errorCode": null
}
```

---

### 6. POST `/inward/return` - Return Inward Payment

**Purpose:** Return inward payment (CHECKER/ADMIN only).

**Method:** `POST`

**Authorization:** CHECKER, ADMIN

**Request Body:**
```json
{
  "extRef": "EXT20260420002",
  "reason": "Account closed"
}
```

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 2,
    "extRef": "EXT20260420002",
    "status": "RETURNED",
    /* ... other fields ... */
  },
  "message": null,
  "errorCode": null
}
```

---

### 7. POST `/cycle/close` - Close Clearing Cycle

**Purpose:** Close NEFT cycle (ADMIN only).

**Method:** `POST`

**Authorization:** ADMIN

**Query Parameters:**
- `cycleId`: Required Long

**Example:** `POST /v1/clearing/cycle/close?cycleId=1`

**Request Body:** Empty

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "cycleNumber": "CYCLE001",
    "status": "CLOSED",
    "openedAt": "2026-04-20T09:00:00",
    "closedAt": "2026-04-20T17:00:00"
  },
  "message": null,
  "errorCode": null
}
```

---

## CHARGE/FEE MODULE

**Base Path:** `/v1/charges`

### 1. POST `/levy` - Levy Charge

**Purpose:** Levy charge on account (auto-calculates fee + GST).

**Method:** `POST`

**Authorization:** MAKER, ADMIN

**Request Body:**
```json
{
  "eventType": "ACCOUNT_MAINTENANCE",
  "accountNumber": "CASA0001",
  "customerGlCode": "1001",
  "transactionAmount": 100000,
  "productCode": "SAV001",
  "sourceModule": "CASO",
  "sourceRef": "TXN0001",
  "branchCode": "HQ001",
  "customerStateCode": "MH"
}
```

**Request Validation:**
- `eventType`: Required, non-blank string
- `accountNumber`: Required, non-blank string
- `customerGlCode`: Required, non-blank string
- `transactionAmount`: Required, positive BigDecimal
- `productCode`: Optional, string
- `sourceModule`: Required, non-blank string
- `sourceRef`: Required, non-blank string
- `branchCode`: Required, non-blank string
- `customerStateCode`: Optional, string (for GST intra/inter-state split)

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "chargeDefinitionId": 1,
    "baseFee": 500,
    "gstAmount": 90,
    "totalDebit": 590,
    "journalEntryId": 1,
    "voucherNumber": "CHG0001"
  },
  "message": null,
  "errorCode": null
}
```

Response if no charge applicable:
```json
{
  "status": "SUCCESS",
  "data": null,
  "message": "No charge applicable",
  "errorCode": null
}
```

---

### 2. POST `/waive` - Waive Charge

**Purpose:** Waive previously levied charge (income giveup).

**Method:** `POST`

**Authorization:** CHECKER, ADMIN

**Request Body:**
```json
{
  "chargeTransactionId": 1,
  "reason": "Customer goodwill"
}
```

**Request Validation:**
- `chargeTransactionId`: Required, positive Long
- `reason`: Required, non-blank string

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "chargeTransactionId": 1,
    "eventType": "ACCOUNT_MAINTENANCE",
    "totalWaived": 590,
    "waivedBy": "checker1",
    "reason": "Customer goodwill"
  },
  "message": null,
  "errorCode": null
}
```

---

### 3. POST `/reverse` - Reverse Charge

**Purpose:** Reverse previously levied charge (posts symmetric contra journal).

**Method:** `POST`

**Authorization:** CHECKER, ADMIN

**Request Body:**
```json
{
  "chargeTransactionId": 1,
  "reason": "Posted in error"
}
```

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "chargeTransactionId": 1,
    "eventType": "ACCOUNT_MAINTENANCE",
    "totalReversed": 590,
    "reversedBy": "checker1",
    "reason": "Posted in error",
    "reversalVoucherNumber": "REV0001"
  },
  "message": null,
  "errorCode": null
}
```

---

### 4. GET `/history/{accountNumber}` - Get Charge History

**Purpose:** Get charges levied on account for date range.

**Method:** `GET`

**Authorization:** MAKER, CHECKER, ADMIN

**URL Parameters:**
- `accountNumber`: String
- `fromDate`: Required Query Param, string (YYYY-MM-DD)
- `toDate`: Required Query Param, string (YYYY-MM-DD)

**Example:** `GET /v1/charges/history/CASA0001?fromDate=2026-04-01&toDate=2026-04-20`

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": [
    {
      "id": 1,
      "eventType": "ACCOUNT_MAINTENANCE",
      "baseFee": 500,
      "gstAmount": 90,
      "totalDebit": 590,
      "waived": false,
      "valueDate": "2026-04-20",
      "sourceModule": "CASO",
      "sourceRef": "TXN0001"
    }
  ],
  "message": null,
  "errorCode": null
}
```

---

## NOTIFICATION MODULE

**Base Path:** `/v1/notifications`

### 1. POST `/send` - Send Transaction Alert

**Purpose:** Manually send transaction alert/SMS/email.

**Method:** `POST`

**Authorization:** MAKER, ADMIN

**Request Body:**
```json
{
  "eventType": "DEPOSIT",
  "customerId": 1,
  "accountNumber": "CASA0001",
  "transactionRef": "TXN0001",
  "amount": 50000,
  "balanceAfter": 60000,
  "productCode": "SAV001",
  "sourceModule": "CASA",
  "narration": "Cash deposit"
}
```

**Request Validation:**
- `eventType`: Required, non-blank string
- `customerId`: Required, positive Long
- `accountNumber`: Required, non-blank string
- `transactionRef`: Optional, string
- `amount`: Optional, positive BigDecimal
- `balanceAfter`: Optional, positive BigDecimal
- `productCode`: Optional, string
- `sourceModule`: Required, non-blank string
- `narration`: Optional, string

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": "Notification dispatched",
  "message": "Alert sent for DEPOSIT",
  "errorCode": null
}
```

---

### 2. POST `/retry` - Retry Failed Notifications

**Purpose:** Retry failed notifications (ADMIN only).

**Method:** `POST`

**Authorization:** ADMIN

**Request Body:** Empty

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "retriedCount": 5
  },
  "message": "5 notifications retried",
  "errorCode": null
}
```

---

### 3. GET `/customer/{customerId}` - Get Customer Notifications

**Purpose:** Get notification history for customer.

**Method:** `GET`

**Authorization:** MAKER, CHECKER, ADMIN

**URL Parameters:**
- `customerId`: Long

**Example:** `GET /v1/notifications/customer/1`

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": [
    {
      "id": 1,
      "eventType": "DEPOSIT",
      "channel": "SMS",
      "customerId": 1,
      "customerName": "Rajesh Kumar",
      "accountReference": "CASA0001",
      "transactionReference": "TXN0001",
      "amount": 50000,
      "balanceAfter": 60000,
      "recipient": "****3210",
      "messageContent": "You have deposited Rs. 50000",
      "deliveryStatus": "DELIVERED",
      "dispatchedAt": "2026-04-20T10:30:00",
      "deliveredAt": "2026-04-20T10:30:15",
      "failureReason": null,
      "gatewayReference": "MSG123456",
      "sourceModule": "CASA",
      "retryCount": 0,
      "createdAt": "2026-04-20T10:30:00"
    }
  ],
  "message": null,
  "errorCode": null
}
```

---

### 4. GET `/account/{accountNumber}` - Get Account Notifications

**Purpose:** Get notification history for account.

**Method:** `GET`

**Authorization:** MAKER, CHECKER, ADMIN

**URL Parameters:**
- `accountNumber`: String

**Example:** `GET /v1/notifications/account/CASA0001`

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": [
    {
      "id": 1,
      "eventType": "DEPOSIT",
      /* ... notification fields ... */
    }
  ],
  "message": null,
  "errorCode": null
}
```

---

### 5. GET `/summary` - Get Delivery Status Summary

**Purpose:** Get notification delivery summary for dashboard.

**Method:** `GET`

**Authorization:** CHECKER, ADMIN

**Query Parameters:**
- `hoursBack`: Optional integer (default 24, look back hours)

**Example:** `GET /v1/notifications/summary?hoursBack=24`

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": [
    ["DELIVERED", 250],
    ["FAILED", 5],
    ["PENDING", 3]
  ],
  "message": null,
  "errorCode": null
}
```

---

## GL INQUIRY MODULE

**Base Path:** `/v1/gl`

### 1. GET `/{glCode}` - Get GL Balance

**Purpose:** Get GL balance by code (read-only inquiry).

**Method:** `GET`

**Authorization:** CHECKER, ADMIN, AUDITOR

**URL Parameters:**
- `glCode`: String (e.g., 1001, 2001)

**Example:** `GET /v1/gl/1001`

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "glCode": "1001",
    "glName": "Cash in Hand",
    "accountType": "ASSET",
    "debitBalance": 1000000,
    "creditBalance": 0,
    "netBalance": 1000000,
    "headerAccount": false,
    "parentGlCode": "1000",
    "glLevel": 2
  },
  "message": null,
  "errorCode": null
}
```

---

### 2. GET `/chart-of-accounts` - Chart of Accounts

**Purpose:** Get all active GLs ordered by code.

**Method:** `GET`

**Authorization:** CHECKER, ADMIN, AUDITOR

**Example:** `GET /v1/gl/chart-of-accounts`

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": [
    {
      "glCode": "1000",
      "glName": "Assets",
      "accountType": "ASSET",
      "debitBalance": 5000000,
      "creditBalance": 0,
      "netBalance": 5000000,
      "headerAccount": true,
      "parentGlCode": null,
      "glLevel": 1
    },
    {
      "glCode": "1001",
      "glName": "Cash in Hand",
      "accountType": "ASSET",
      "debitBalance": 1000000,
      "creditBalance": 0,
      "netBalance": 1000000,
      "headerAccount": false,
      "parentGlCode": "1000",
      "glLevel": 2
    }
  ],
  "message": null,
  "errorCode": null
}
```

---

### 3. GET `/trial-balance` - Trial Balance

**Purpose:** Get trial balance with all postable GLs and variance check.

**Method:** `GET`

**Authorization:** CHECKER, ADMIN, AUDITOR

**Example:** `GET /v1/gl/trial-balance`

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": {
    "totalDebit": 5000000,
    "totalCredit": 5000000,
    "variance": 0,
    "balanced": true,
    "accountCount": 45,
    "accounts": [
      {
        "glCode": "1001",
        "glName": "Cash in Hand",
        "accountType": "ASSET",
        "debitBalance": 1000000,
        "creditBalance": 0,
        "netBalance": 1000000,
        /* ... */
      }
    ]
  },
  "message": null,
  "errorCode": null
}
```

---

### 4. GET `/type/{accountType}` - GLs by Account Type

**Purpose:** Get GLs filtered by type (ASSET|LIABILITY|EQUITY|INCOME|EXPENSE).

**Method:** `GET`

**Authorization:** CHECKER, ADMIN, AUDITOR

**URL Parameters:**
- `accountType`: String (ASSET|LIABILITY|EQUITY|INCOME|EXPENSE)

**Example:** `GET /v1/gl/type/ASSET`

**Success Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data": [
    {
      "glCode": "1001",
      "glName": "Cash in Hand",
      "accountType": "ASSET",
      /* ... */
    }
  ],
  "message": null,
  "errorCode": null
}
```

---

## ACTUATOR HEALTH CHECK MODULE

**Base Path:** `/actuator` (unprotected, no JWT required)

**Purpose:** Spring Boot Actuator endpoints for infrastructure health checks, Kubernetes liveness/readiness probes, and container orchestration monitoring. These endpoints are **intentionally without authentication** per Docker/Kubernetes best practices.

**Configuration (application-prod.properties):**
```properties
management.endpoints.web.exposure.include=health,info
management.endpoint.health.show-details=never
management.endpoint.health.probes.enabled=true
```

**Development Mode:** In dev profile, additional endpoints are exposed (metrics, env, etc.). Production exposes only `health` and `info`.

### 1. GET `/actuator/health` - Application Health

**Purpose:** Liveness probe — returns application health status for K8s/Docker.

**Method:** `GET`

**Authentication:** None (public, no JWT required)

**URL:** `http://localhost:8080/actuator/health`

**Success Response (200 OK - UP):**
```json
{
  "status": "UP",
  "components": {
    "db": {
      "status": "UP",
      "details": {
        "database": "SQL Server",
        "hello": 1
      }
    },
    "diskSpace": {
      "status": "UP",
      "details": {
        "total": 107374182400,
        "free": 53687091200,
        "threshold": 10485760,
        "exists": true
      }
    },
    "livenessState": {
      "status": "UP"
    },
    "readinessState": {
      "status": "UP"
    }
  }
}
```

**Health States:**

| Status | HTTP | Meaning | Action |
|--------|------|---------|--------|
| **UP** | 200 | Application healthy, all components operational | Continue serving requests |
| **DOWN** | 503 | Critical service unavailable (DB, disk, etc.) | Remove from LB, start failover |
| **UNKNOWN** | 200 | Component state undetermined | Investigate component status |
| **OUT_OF_SERVICE** | 503 | Application gracefully shutdown | Drain requests, do not accept new |

**Database Failure Response (503 SERVICE UNAVAILABLE):**
```json
{
  "status": "DOWN",
  "components": {
    "db": {
      "status": "DOWN",
      "details": {
        "error": "Cannot get a connection, pool error Timeout waiting for idle object"
      }
    },
    "diskSpace": {
      "status": "UP"
    }
  }
}
```

**Disk Space Critical Response (503 SERVICE UNAVAILABLE):**
```json
{
  "status": "DOWN",
  "components": {
    "diskSpace": {
      "status": "DOWN",
      "details": {
        "total": 107374182400,
        "free": 5000000,
        "threshold": 10485760,
        "status": "THRESHOLD_EXCEEDED"
      }
    }
  }
}
```

**Frontend/DevOps Implementation Notes:**

- **Kubernetes Liveness Probe:** Restart pod if returns 503 for 3 consecutive checks (30s)
- **Kubernetes Readiness Probe:** Remove from service if returns 503 for 1 check (10s)
- **Docker Health Check:** 
  ```dockerfile
  HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8080/actuator/health || exit 1
  ```
- **Load Balancer:** Implement connection draining (30s) before shutdown if health check fails

---

### 2. GET `/actuator/info` - Application Information

**Purpose:** Metadata about the application (version, build info, etc.).

**Method:** `GET`

**Authentication:** None (public, no JWT required)

**URL:** `http://localhost:8080/actuator/info`

**Success Response (200 OK):**
```json
{
  "app": {
    "name": "finvanta",
    "description": "Finvanta Systems - Tier-1 CBS Grade Loan and Accounting Engine",
    "version": "0.0.1-SNAPSHOT",
    "encoding": "UTF-8",
    "java": {
      "version": "17.0.8"
    }
  },
  "build": {
    "artifact": "finvanta",
    "name": "finvanta",
    "time": 1713607200000,
    "version": "0.0.1-SNAPSHOT",
    "group": "com.finvanta"
  }
}
```

**Build Info Available Fields (populated by Maven):**
- `artifact`: Maven artifact ID
- `name`: Project name
- `version`: Project version
- `group`: Maven group ID
- `time`: Build timestamp (epoch millis)

**Frontend Use Cases:**
- Display app version in UI footer/about dialog
- Verify deployment version matches expected release
- Log version info in error reports for troubleshooting

---

## RESPONSE ERROR CODES REFERENCE

| Error Code | HTTP Status | Description |
|-----------|------------|-------------|
| INVALID_CREDENTIALS | 401 | Username/password invalid or user not found |
| ACCOUNT_DISABLED | 401 | User account is disabled |
| ACCOUNT_LOCKED | 401 | User account locked due to failed login attempts |
| PASSWORD_EXPIRED | 403 | User password has expired |
| MFA_REQUIRED | 428 | MFA step-up required; see challenge in error.challengeId |
| INVALID_MFA_CHALLENGE | 401 | MFA challenge invalid/expired/tampered |
| MFA_CHALLENGE_REUSED | 401 | MFA challenge already consumed (replay protection) |
| MFA_VERIFICATION_FAILED | 401 | Invalid OTP code |
| INVALID_REFRESH_TOKEN | 401 | Refresh token invalid/expired |
| REFRESH_TOKEN_REUSED | 401 | Refresh token replayed (possible theft) |
| LEGACY_REFRESH_TOKEN | 401 | Token predates rotation policy; re-authenticate |
| ACCESS_DENIED | 403 | Insufficient permissions for operation |
| IMMUTABLE_FIELD | 400 | Attempt to modify immutable field (e.g., PAN) |
| DUPLICATE_CUSTOMER | 400 | Customer with PAN/Aadhaar already exists |
| CUSTOMER_NOT_FOUND | 404 | Customer ID not found |
| BRANCH_NOT_FOUND | 404 | Branch ID not found |
| ACCOUNT_NOT_FOUND | 404 | Account number not found |
| GL_NOT_FOUND | 404 | GL code not found |
| VALIDATION_ERROR | 400 | Request body validation failed |
| BUSINESS_RULE_VIOLATION | 400 | Business rule violated (e.g., insufficient balance) |
| INSUFFICIENT_PERMISSIONS | 403 | Role lacks permissions |

---

## FRONTEND IMPLEMENTATION CHECKLIST

- [ ] Implement token storage (HttpOnly cookies recommended)
- [ ] Implement automatic token refresh (60s before expiry)
- [ ] Handle 401/403 errors → redirect to login
- [ ] Handle 428 MFA_REQUIRED → redirect to MFA screen
- [ ] Implement debounce/throttle on form submissions
- [ ] Validate request bodies before API call
- [ ] Implement idempotencyKey for financial transactions (POST deposit/withdraw/transfer/etc.)
- [ ] Mask sensitive data (PAN, Aadhaar, mobile) in UI
- [ ] Implement role-based UI visibility (MAKER/CHECKER/ADMIN buttons)
- [ ] Handle error responses per error code (friendly UI messages)
- [ ] Implement pagination for list endpoints
- [ ] Implement date range filters for statement/history endpoints
- [ ] Cache customer/branch lookups locally
- [ ] Display business date from authentication response in UI header

---

**End of REST API Catalogue**

---

### Document Metadata

- **Author Role:** Senior Core Banking Architect & Tier-1 CBS UI Architect
- **Target Audience:** React + Next.js Frontend Development Team
- **API Version:** 1.0 (Core v1)
- **Backend:** Spring Boot 3.3.13, Java 17
- **Frontend Tech Stack:** React 18+, Next.js 14+, TypeScript
- **Database:** Multi-tenant, branch-scoped MSSQL Server
- **Authentication:** JWT with MFA support (TOTP)
- **Compliance:** RBI IT Governance Direction 2023, Fair Practices Code 2023, CERSAI v2.0
- **Last Updated:** April 2026

