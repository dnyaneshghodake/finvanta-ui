# FINVANTA CBS LOGIN API CONTRACT FOR REACT + NEXT.JS

**Version:** 2.0  
**Date:** April 20, 2026  
**Compliance:** RBI IT Governance Direction 2023, OWASP ASVS 2.2  
**Target**: React + Next.js Frontend Integration  

---

## 📋 OVERVIEW

This document specifies the **definitive API contract** for Finvanta CBS authentication endpoints. All requests/responses follow RFC 7231 (HTTP), RFC 6750 (Bearer tokens), and RFC 8297 (425 Precondition Required).

### Universal Rules

1. **HTTP Status**: Strictly follows RFC 7231; see error code mapping table below
2. **Response Format**: All responses wrapped in `ApiResponse<T>` envelope: `{ status, data?, errorCode?, message?, timestamp }`
3. **Data Serialization**: `@JsonInclude(NON_NULL)` suppresses null fields; never omit optional fields in docs
4. **Timestamps**: ISO 8601 format with milliseconds: `2026-04-20T10:30:45.123456`
5. **Error Codes**: Machine-readable, UPPERCASE_WITH_UNDERSCORES; see Error Code Reference table
6. **Headers**: All APIs require `X-Tenant-Id` header (defaults to "DEFAULT"); generated `X-Correlation-Id` on response
7. **Tokens**: Bearer scheme (RFC 6750); never include in response body metadata

---

## 📋 REQUIRED HTTP HEADERS (All Requests)

| Header | Value | Required | Example | Notes |
|--------|-------|----------|---------|-------|
| `Content-Type` | application/json | Yes | `application/json` | All requests must be JSON |
| `X-Tenant-Id` | String | Yes | `DEFAULT` | Tenant context; defaults to "DEFAULT"; injected by BFF |
| `X-Correlation-Id` | UUID v4 | No | `550e8400-e29b-41d4-a716-446655440000` | Optional on request; always echoed on response for audit trail |
| `User-Agent` | String | Yes | `Mozilla/5.0...` | Standard HTTP header |
| `Accept` | application/json | Yes | `application/json` | API responds with JSON only |

## 📋 RESPONSE HTTP HEADERS (All Responses)

| Header | Value | Notes |
|--------|-------|-------|
| `X-Correlation-Id` | UUID v4 | Generated if not in request; use for log lookup |
| `Retry-After` | Integer (seconds) | Only on HTTP 429; tells client when to retry |
| `Content-Type` | application/json; charset=UTF-8 | Standard |
| `Cache-Control` | no-store, no-cache, must-revalidate | Auth responses never cached per RFC 6235 |
| `Strict-Transport-Security` | max-age=31536000; includeSubDomains | HTTPS only; production: 1 year |
| `X-Content-Type-Options` | nosniff | Prevents MIME sniffing |
| `X-Frame-Options` | DENY | Prevents clickjacking |
| `Content-Security-Policy` | default-src 'self'; script-src 'self' | Per OWASP; tuned for Next.js |

---

## 🎯 ENDPOINT: POST /api/v1/auth/token

### Request

**HTTP Method:** `POST`  
**URL:** `https://api.finvanta.com/api/v1/auth/token`  
**Headers:** `Content-Type: application/json`, `X-Tenant-Id: DEFAULT`  

**Request Body:**

```json
{
  "username": "maker1",
  "password": "finvanta123"
}
```

**Field Definitions:**

| Field | Type | Required | Validation | Example |
|-------|------|----------|-----------|---------|
| `username` | String | Yes | 1-100 chars, alphanumeric + underscore | "maker1" |
| `password` | String | Yes | min 8 chars; transmitted encrypted over TLS 1.3 | "finvanta123" |

**Example cURL Request:**

```bash
curl -X POST "https://api.finvanta.com/api/v1/auth/token" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: DEFAULT" \
  -d '{
    "username": "maker1",
    "password": "finvanta123"
  }'
```

**Example React Hook (next-auth):**

```typescript
import { signIn } from "next-auth/react";

const response = await signIn("credentials", {
  redirect: false,
  username: "maker1",
  password: "finvanta123"
});

if (response?.ok) {
  router.push("/dashboard");
} else if (response?.error === "MFA_REQUIRED") {
  // Redirect to MFA verification page
  router.push("/auth/mfa");
} else {
  setError(response?.error || "Login failed");
}
```

---

### Response: Success (HTTP 200 OK)

**HTTP Status:** `200 OK`  
**Headers:** `Content-Type: application/json; charset=UTF-8`, `X-Correlation-Id: {uuid}`, `Cache-Control: no-store, no-cache`  

**Response Body:**

```json
{
  "status": "SUCCESS",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtYWtlcjEiLCJpc3MiOiJmaW52YW50YSIsImF1ZCI6ImNicy1hcGkiLCJpYXQiOjE3MTM2MjEwNDUsImV4cCI6MTcxMzYyMTk0NSwndHlwZSI6ImFjY2VzcyIsImp0aSI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMCIsInRlbmFudF9pZCI6IkRFRkFVTFQiLCJicmFuY2hfY29kZSI6IkhRMDAxIiwicm9sZSI6Ik1BS0VSIn0.signature",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtYWtlcjEiLCJpc3MiOiJmaW52YW50YSIsImF1ZCI6ImNicy1hcGkiLCJpYXQiOjE3MTM2MjEwNDUsImV4cCI6MTcxNjIxMzA0NSwndHlwZSI6InJlZnJlc2giLCJqdGkiOiJhM2Y1YzllMDEyZWUtNTUwZTg0MDAtZTI5Yi00MWQ0In0.signature",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "businessDate": "2026-04-20",
    "user": {
      "id": 1,
      "username": "maker1",
      "firstName": "Rajiv",
      "lastName": "Menon",
      "email": "maker1@finvanta.com",
      "roles": ["MAKER"],
      "branchCode": "HQ001",
      "branchName": "Head Office",
      "tenantId": "DEFAULT",
      "displayName": "Rajiv Menon",
      "mfaEnrolled": true
    }
  },
  "errorCode": null,
  "message": null,
  "timestamp": "2026-04-20T10:30:45.123456"
}
```

**Response Field Definitions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | String(`SUCCESS`) | Yes | Always "SUCCESS" for HTTP 200 |
| `data` | EnhancedTokenResponse | Yes | Token payload + user profile + businessDate |
| `data.accessToken` | String | Yes | JWT (15-min lifetime); decoded client-side; use in `Authorization: Bearer` header on subsequent requests |
| `data.refreshToken` | String | Yes | JWT (30-day lifetime, rotated on each use); store in HttpOnly secure cookie; never in localStorage |
| `data.tokenType` | String | Yes | Always "Bearer" per RFC 6750 §2.1 |
| `data.expiresIn` | Integer (seconds) | Yes | Time until accessToken expires (e.g., 900 = 15 min); use for UI session timeout warning at 80% |
| `data.businessDate` | String (YYYY-MM-DD) | Yes | CBS operational date; not system date; used for all transaction dating; update on every refresh; critical for MIS reports |
| `data.user.id` | Long | Yes | Internal RDBMS user ID; used for audit logging |
| `data.user.username` | String | Yes | Login username; displayed in UI header |
| `data.user.firstName` | String | Yes | User's first name from identity provider |
| `data.user.lastName` | String | Yes | User's last name |
| `data.user.email` | String | Yes | Email address for password reset flows |
| `data.user.roles` | String[] | Yes | RBAC roles; examples: ["MAKER"], ["CHECKER", "ADMIN"], ["TELLER", "RECONCILER"] |
| `data.user.branchCode` | String | Yes | Branch code; e.g., "HQ001", "BR002"; injected in all subsequent API calls via X-Branch-Code header |
| `data.user.branchName` | String | Yes | Branch display name; shown in UI header next to user name |
| `data.user.tenantId` | String | Yes | Multi-tenancy context; e.g., "DEFAULT", "ACME_BANK_PROD"; injected on X-Tenant-Id header |
| `data.user.displayName` | String | Yes | Computed as `firstName + " " + lastName`; for UI display |
| `data.user.mfaEnrolled` | Boolean | Yes | Whether MFA (TOTP) is active; if true, show reminder periodically |
| `errorCode` | null | Yes | Always null on success |
| `message` | null | Yes | Always null on success |
| `timestamp` | String (ISO 8601) | Yes | Server time; client uses for skew correction |

**React Integration Example:**

```typescript
// hooks/useLogin.ts
import { useState } from "react";
import { useRouter } from "next/router";

interface EnhancedTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  businessDate: string;
  user: UserInfoDto;
}

export function useLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (username: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/cbs/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (response.status === 428) {
        // MFA_REQUIRED
        router.push("/auth/mfa");
        return;
      }

      const data = await response.json();

      if (data.status === "SUCCESS") {
        const tokens = data.data as EnhancedTokenResponse;
        
        // Store in session context (managed by BFF)
        localStorage.setItem(
          "user",
          JSON.stringify(tokens.user)
        );
        localStorage.setItem(
          "businessDate",
          tokens.businessDate
        );

        // Schedule token refresh at 80% expiry
        scheduleRefresh(tokens.expiresIn);

        router.push("/dashboard");
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return { login, loading, error };
}
```

---

### Response: Invalid Credentials (HTTP 401 Unauthorized)

**HTTP Status:** `401 Unauthorized`  
**Headers:** `X-Correlation-Id: {uuid}`, `Cache-Control: no-store, no-cache`  

**Response Body:**

```json
{
  "status": "ERROR",
  "data": null,
  "errorCode": "INVALID_CREDENTIALS",
  "message": "Invalid username or password. 3 attempts remaining before account lock.",
  "timestamp": "2026-04-20T10:30:45.123456"
}
```

**Scenarios:**

1. **Username not found**: User does not exist in AppUser table
2. **Password incorrect**: Bcrypt hash does not match entered password

**Behavior:**

- Each failed attempt increments `AppUser.failedLoginAttempts` counter
- System calculates `remainingAttempts = 5 - failedLoginAttempts` and includes in message
- After 5 failed attempts, account transitions to LOCKED state
- Locked accounts cannot authenticate for 30 minutes (auto-unlock)
- Audit log entry: `LOGIN_FAILED`, username, IP, reason, correlation-id

**React Error Handling:**

```typescript
// components/LoginForm.tsx
const [attempts, setAttempts] = useState(5);

const handleLoginError = (response: ApiResponse<any>) => {
  if (response.errorCode === "INVALID_CREDENTIALS") {
    // Extract remaining attempts from message
    const match = response.message.match(/(\d+)\s+attempts remaining/);
    const remaining = match ? parseInt(match[1]) : attempts - 1;
    
    setAttempts(remaining);
    
    if (remaining === 0) {
      // Show account lock warning
      showAlert("Account will be locked after next attempt");
    } else if (remaining <= 2) {
      // Show warning badge
      showWarning(`${remaining} attempts before lock`);
    }
  }
};
```

**UI Display:**
- "Invalid username or password"
- Show countdown: "3 attempts remaining before account lock" (in warning badge)
- After 3 failures: Highlight attempt counter in red
- After 5 failures: Replace form with "Account locked for 30 minutes" message

---

### Response: Account Locked (HTTP 401 Unauthorized)

**HTTP Status:** `401 Unauthorized`  

**Response Body:**

```json
{
  "status": "ERROR",
  "data": null,
  "errorCode": "ACCOUNT_LOCKED",
  "message": "Account locked for 30 minutes. Try again later or contact administrator.",
  "timestamp": "2026-04-20T10:30:45.123456"
}
```

**Scenarios:**

1. `AppUser.failedLoginAttempts >= 5` AND lockout window has not elapsed
2. `AppUser.lockedUntilTime > now()` (auto-unlock via scheduler after 30 minutes)

**Lock Duration:** 30 minutes from first failed login attempt that triggered lock  
**Auto-Unlock:** Database scheduler runs every minute to detect and auto-unlock eligible accounts  
**Manual Unlock:** ADMIN role only; calls `PUT /api/v1/users/{userId}/unlock`  

**Audit Logging:**
- Event: `ACCOUNT_LOCKED`, username, IP, reason: "5 failed attempts", correlation-id
- Stored for 7 years per RBI guidelines

**React Error Handling:**

```typescript
const handleAccountLocked = (message: string) => {
  // Extract wait time from message (e.g., "30 minutes")
  const match = message.match(/(\d+)\s+minutes/);
  const waitMinutes = match ? parseInt(match[1]) : 30;
  
  // Start countdown timer
  const endTime = Date.now() + (waitMinutes * 60 * 1000);
  
  const interval = setInterval(() => {
    const remaining = Math.ceil((endTime - Date.now()) / 1000 / 60);
    if (remaining <= 0) {
      clearInterval(interval);
      setError("Account unlocked. Please try again.");
      setLocked(false);
    } else {
      setError(`Account locked. Try again in ${remaining} min`);
    }
  }, 30000); // Update every 30 seconds
};
```

**UI Display:**
- Red error banner: "Account locked for 30 minutes"
- Disable login form completely
- Show "(waiting until HH:MM)" in countdown timer
- "Contact administrator" link
- "Auto-unlock timer" visual gauge

---

### Response: Account Disabled (HTTP 401 Unauthorized)

**HTTP Status:** `401 Unauthorized`  

**Response Body:**

```json
{
  "status": "ERROR",
  "data": null,
  "errorCode": "ACCOUNT_DISABLED",
  "message": "Your account has been disabled. Contact your administrator for reactivation.",
  "timestamp": "2026-04-20T10:30:45.123456"
}
```

**Scenarios:**

- `AppUser.is_active = false` (deactivated by admin)
- Account was manually disabled via `PUT /api/v1/users/{userId}` with `active: false`

**Audit Logging:**
- Event: `ACCOUNT_DISABLED`, username, admin who disabled it, reason (if provided), correlation-id

**React Error Handling:**

```typescript
if (response.errorCode === "ACCOUNT_DISABLED") {
  showAlert("Your account has been disabled.");
  showAction("Contact your administrator for reactivation.");
  disableForm();
}
```

**UI Display:**
- "Your account has been disabled"
- Show contact info for administrator
- Disable login form
- Optionally show "Email support" link

---

### Response: Password Expired (HTTP 403 Forbidden)

**HTTP Status:** `403 Forbidden`  

**Response Body:**

```json
{
  "status": "ERROR",
  "data": null,
  "errorCode": "PASSWORD_EXPIRED",
  "message": "Your password has expired. Please change it before proceeding.",
  "timestamp": "2026-04-20T10:30:45.123456"
}
```

**Scenarios:**

- `AppUser.password_expiry_date < today()`
- Password is older than 90 days (RBI IT Governance §8.3.2 requirement)
- User has not changed password since it was initially set

**Password Policy:**

- Initial password: Set by admin (1 year expiry)
- User-changed password: 90-day rotation thereafter
- Grace period: 7 days before enforcement (warning starts at Day 84)

**React Handling:**

```typescript
if (response.errorCode === "PASSWORD_EXPIRED") {
  // Redirect to password change flow
  router.push("/auth/change-password", {
    redirectAfter: "/dashboard"
  });
}
```

**UI Display:**
- "Your password has expired"
- Redirect to password change form automatically
- Force user to change password before accessing dashboard
- Show password change form with current password + new password fields
- After successful change, retry login automatically

---

### Response: MFA Required (HTTP 428 Precondition Required)

**HTTP Status:** `428 Precondition Required` (RFC 8297)  
**Headers:** `X-Correlation-Id: {uuid}`  

**Response Body:**

```json
{
  "status": "ERROR",
  "data": {
    "challengeId": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtYWtlcjEiLCJpc3MiOiJmaW52YW50YSIsInR5cCI6Im1mYV9jaGFsbGVuZ2UiLCJleHAiOjE3MTM2MjEzNDUsImp0aSI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2In0.signature",
    "channel": "TOTP"
  },
  "errorCode": "MFA_REQUIRED",
  "message": "MFA verification required to complete sign-in",
  "timestamp": "2026-04-20T10:30:45.123456"
}
```

**Scenarios:**

- `AppUser.is_mfa_enabled = true` (MFA enrolled via TOTP)
- Password validated successfully but requires MFA step-up

**Challenge Token Details:**

| Property | Value | Notes |
|----------|-------|-------|
| `type` | "mfa_challenge" | JWT type claim |
| `subject` | username | Who this challenge is for |
| `expiry` | 5 minutes | After which re-authentication required |
| `jti` | UUID | Single-use identifier; burned after verification or expiry |
| `channel` | "TOTP" or "SMS" | How to deliver MFA code; currently TOTP only in v1 |

**Security Properties:**

- **Single-use**: jti is recorded in RevokedRefreshToken table after use; reuse attempt → HTTP 401 MFA_CHALLENGE_REUSED
- **Opaque**: Client cannot read or modify contents (JWT signature verification fails)
- **Stateless**: Challenge is self-contained; server validates signature only (no DB lookup required)
- **Rotation**: Each new login challenge has different jti

**React MFA Flow:**

```typescript
// pages/auth/mfa.tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

interface MfaStep {
  challengeId: string;
  channel: "TOTP" | "SMS";
}

export default function MfaPage() {
  const router = useRouter();
  const [mfa, setMfa] = useState<MfaStep>(
    router.query.mfa as MfaStep
  );
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");

  const handleMfaSubmit = async () => {
    const response = await fetch("/api/cbs/auth/mfa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challengeId: mfa.challengeId,
        otp: otp
      })
    });

    const data = await response.json();

    if (data.status === "SUCCESS") {
      // Store tokens (managed by BFF)
      router.push("/dashboard");
    } else if (response.status === 401) {
      setError("Invalid OTP code. Try again.");
    } else {
      setError("MFA verification failed. Please sign in again.");
      router.push("/auth/login");
    }
  };

  return (
    <div>
      <h1>Verify Your Identity</h1>
      <p>Enter the 6-digit code from your authenticator app:</p>
      
      <input
        type="text"
        maxLength={6}
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
        placeholder="000000"
      />
      
      <button onClick={handleMfaSubmit}>Verify</button>
      
      {error && <p className="error">{error}</p>}
    </div>
  );
}
```

**Next.js BFF Implementation (middleware):**

```typescript
// middleware/auth.ts
import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  // If 428 response received, redirect to MFA
  const response = NextResponse.next();
  
  if (req.headers.get("x-mfa-required") === "true") {
    return NextResponse.redirect(
      new URL("/auth/mfa", req.url)
    );
  }

  return response;
}

export const config = {
  matcher: ["/api/:path*"]
};
```

**UI Display:**
- Navigate to `/auth/mfa` (not error page)
- Show app icon + "Enter 6-digit code from Authenticator App"
- Input field (6 digits only)
- "Use backup codes" link (future feature)
- "Didn't receive code?" → retry (max 3 times)
- Auto-focus first field
- On 3 failed attempts: "MFA verification failed. Please sign in again." → redirect to `/auth/login`

---

### Response: Validation Error (HTTP 400 Bad Request)

**HTTP Status:** `400 Bad Request`  

**Response Body:**

```json
{
  "status": "ERROR",
  "data": null,
  "errorCode": "VALIDATION_ERROR",
  "message": "Request validation failed: username: Username is required; password: Password is required;",
  "timestamp": "2026-04-20T10:30:45.123456"
}
```

**Scenarios:**

1. `username` field is missing or blank
2. `password` field is missing or blank
3. `username` exceeds 100 characters
4. Request body is not valid JSON

**React Handling:**

```typescript
const handleValidationError = (message: string) => {
  // Parse field-level errors from message
  const errors = message.split(";")
    .filter(e => e.trim())
    .map(e => {
      const [field, msg] = e.split(":");
      return { field: field.trim(), message: msg.trim() };
    });
  
  // Display inline field errors
  errors.forEach(({ field, message }) => {
    setFieldError(field, message);
  });
};
```

**UI Display:**
- Inline field validation errors
- "Username is required"
- "Password is required"
- Red border on invalid fields

---

### Response: Rate Limited (HTTP 429 Too Many Requests)

**HTTP Status:** `429 Too Many Requests`  
**Headers:** `Retry-After: 60`, `X-Correlation-Id: {uuid}`, `RateLimit-Limit: 5`, `RateLimit-Remaining: 0`, `RateLimit-Reset: 1713621705`  

**Response Body:**

```json
{
  "status": "ERROR",
  "data": null,
  "errorCode": "RATE_LIMITED",
  "message": "Too many login attempts. Try again in 60 seconds.",
  "timestamp": "2026-04-20T10:30:45.123456"
}
```

**Rate Limit Policy:**

| Property | Value | Notes |
|----------|-------|-------|
| **Strategy** | Token Bucket (Guava RateLimiter) | Allows bursty traffic; resets gradually |
| **Limit** | 5 attempts per 15 minutes | = 0.0056 permits/second |
| **Scope** | Per IP address | Coarse; prevents botnet attacks |
| **Endpoint** | POST /api/v1/auth/token | Brute-force protection per RBI §6.2 |
| **Cache** | 30-min inactivity timeout | Limiter auto-cleaned if no requests |

**Example Timeline:**

```
Time    Request     Bucket      Result
00:00   Login 1     5/5 → 4/5   ✅ SUCCESS
00:05   Login 2     4/5 → 3/5   ✅ SUCCESS
00:10   Login 3     3/5 → 2/5   ✅ SUCCESS
00:15   Login 4     2/5 → 1/5   ✅ SUCCESS
00:20   Login 5     1/5 → 0/5   ✅ SUCCESS
00:25   Login 6     0/5 (wait)  ❌ 429 RATE_LIMITED
...
02:25   (60 min later) bucket refills, 1 permit available ✅ Can retry
```

**React Backoff Handling (with exponential jitter):**

```typescript
interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // ms
  maxDelay: number;
}

async function retryWithBackoff(
  fetchFn: () => Promise<Response>,
  config: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000
  }
) {
  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      const response = await fetchFn();
      
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const delay = Math.min(
          config.baseDelay * Math.pow(2, attempt) +
          Math.random() * 1000,
          config.maxDelay
        );
        
        if (retryAfter) {
          // Use server's retry-after
          await new Promise(r => setTimeout(r, parseInt(retryAfter) * 1000));
        } else {
          await new Promise(r => setTimeout(r, delay));
        }
        
        continue;
      }
      
      return response;
    } catch (err) {
      if (attempt === config.maxRetries - 1) throw err;
    }
  }
}
```

**UI Display:**
- "Too many login attempts"
- Show countdown timer from `Retry-After` header
- Disable login form for duration
- "Try again in 60 seconds" with automated retry
- Retry button (disabled) with countdown
- BFF handles retry silently in background (user sees "Retrying..." indicator)

---

### Response: Internal Server Error (HTTP 500 Internal Server Error)

**HTTP Status:** `500 Internal Server Error`  
**Headers:** `X-Correlation-Id: {uuid}`  

**Response Body:**

```json
{
  "status": "ERROR",
  "data": null,
  "errorCode": "INTERNAL_ERROR",
  "message": "An unexpected error occurred. Reference: 550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-04-20T10:30:45.123456"
}
```

**Scenarios:**

- Unexpected exception during authentication (NPE, database connection timeout, etc.)
- JWT service error (token generation failed)
- Multi-tenancy context resolution failed
- Rate limiter service error

**Guarantee:**
- **NO stack trace** exposed to client per RBI IT Governance §8.5
- Correlation ID always included for support team investigation
- Server logs contain full stack trace (searchable by correlation ID)

**Support Workflow:**

```bash
# Customer: "Login failed with reference 550e8400-e29b-41d4-a716-446655440000"

# Support agent queries logs:
$ grep -r "550e8400-e29b-41d4-a716-446655440000" /var/log/finvanta/
# Output shows:
# 2026-04-20 10:30:45.123 ERROR correlation_id=550e8400... java.lang.NullPointerException
# at com.finvanta.service.BusinessDateService.getCurrentBusinessDate(BusinessDateService.java:145)
```

**React Error Handling:**

```typescript
if (response.status === 500) {
  const data = await response.json();
  const correlationId = data.message.match(/Reference: (.+)$/)?.[1];
  
  showAlert(
    "An unexpected error occurred. Please contact support.",
    { supportId: correlationId }
  );
  
  // Log to error tracking service (Sentry, etc.)
  logError({
    severity: "error",
    message: "Login API returned 500",
    correlationId: correlationId,
    timestamp: new Date()
  });
}
```

**UI Display:**
- "An unexpected error occurred"
- Show support reference ID (in small text)
- "Please try again or contact support"
- Show support contact number/email

---

## 🔐 ENDPOINT: POST /api/v1/auth/mfa/verify

**HTTP Method:** `POST`  
**URL:** `https://api.finvanta.com/api/v1/auth/mfa/verify`  
**Headers:** `Content-Type: application/json`, `X-Tenant-Id: DEFAULT`  

### Request

**Request Body:**

```json
{
  "challengeId": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtYWtlcjEiLCJpc3MiOiJmaW52YW50YSIsInR5cCI6Im1mYV9jaGFsbGVuZ2UiLCJleHAiOjE3MTM2MjEzNDUsImp0aSI6IjU1MGU4NDAwIn0.signature",
  "otp": "123456"
}
```

**Field Definitions:**

| Field | Type | Required | Validation | Example |
|-------|------|----------|-----------|---------|
| `challengeId` | String | Yes | Valid JWT, type="mfa_challenge", not expired, jti not in revocation denylist | Opaque; provided by MFA_REQUIRED response |
| `otp` | String | Yes | Exactly 6 digits, computed by TOTP algorithm, not previously used (within 5-min window) | "123456" |

**Validation Details:**

- **challengeId JWT validation**:
  - Signature verified using HS256 secret
  - `type` claim = "mfa_challenge"
  - `exp` claim > now (not expired)
  - `jti` claim not in RevokedRefreshToken table (prevents replay)
  
- **OTP validation**:
  - Must be 6 digits (TOTP RFC 6238)
  - TOTP window: ±30 seconds (6 codes valid at any moment = 5 min buffer)
  - No TOTP replay: Used codes tracked in cache (prevents user repeating same code)

**Example cURL Request:**

```bash
curl -X POST "https://api.finvanta.com/api/v1/auth/mfa/verify" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: DEFAULT" \
  -d '{
    "challengeId": "eyJ...",
    "otp": "123456"
  }'
```

---

### Response: Success (HTTP 200 OK)

**HTTP Status:** `200 OK`  
**Response Body:** (Identical to POST /api/v1/auth/token success response)

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
      "id": 1,
      "username": "maker1",
      "firstName": "Rajiv",
      "lastName": "Menon",
      "email": "maker1@finvanta.com",
      "roles": ["MAKER"],
      "branchCode": "HQ001",
      "branchName": "Head Office",
      "tenantId": "DEFAULT",
      "displayName": "Rajiv Menon",
      "mfaEnrolled": true
    }
  },
  "errorCode": null,
  "message": null,
  "timestamp": "2026-04-20T10:30:45.123456"
}
```

**Key Differences from /api/v1/auth/token:**

- **Tokens are new**: Both access and refresh tokens rotated (not reused from challenge phase)
- **User info refreshed**: Re-fetched from database to capture any profile changes
- **Challenge burned**: Challenge jti recorded in RevokedRefreshToken table (single-use enforcement)

---

### Response: Invalid OTP (HTTP 401 Unauthorized)

**HTTP Status:** `401 Unauthorized`  

**Response Body:**

```json
{
  "status": "ERROR",
  "data": null,
  "errorCode": "MFA_VERIFICATION_FAILED",
  "message": "Invalid OTP code. Please try again.",
  "timestamp": "2026-04-20T10:30:45.123456"
}
```

**Scenarios:**

1. **TOTP code does not match**: Current TOTP window doesn't match user's secret
2. **OTP already used (replay attack)**: Code within 5-minute window but already verified
3. **Code format invalid**: Not 6 digits

**TOTP Algorithm Details (RFC 6238):**

- Base: User's TOTP secret (provisioned during MFA setup)
- Window: 30 seconds (current window + ±1 = 3 codes valid at any moment)
- Digits: 6 (TOTP generates 6-digit codes)
- Hash: HMAC-SHA1
- Epoch: Unix time in 30-second intervals

**Replay Protection:**

- Used OTP codes tracked in in-memory cache (expires after 5 minutes)
- Prevents user from submitting same code twice
- Detection: "OTP code already used within last 5 minutes"

**React Error Handling:**

```typescript
const [otpAttempts, setOtpAttempts] = useState(0);
const MAX_OTP_ATTEMPTS = 3;

const submitOtp = async (otp: string) => {
  const response = await fetch("/api/cbs/auth/mfa/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      challengeId: mfaChallenge.id,
      otp: otp
    })
  });

  if (response.status === 401) {
    const attempts = otpAttempts + 1;
    setOtpAttempts(attempts);

    if (attempts >= MAX_OTP_ATTEMPTS) {
      showError("Too many invalid attempts. Please sign in again.");
      router.push("/auth/login");
    } else {
      showError(`Invalid code. ${MAX_OTP_ATTEMPTS - attempts} attempts remaining.`);
      // Clear input
      setOtpInput("");
      // Re-focus
      otpInputRef.current?.focus();
    }
  }
};
```

**UI Display:**
- "Invalid OTP code"
- Show attempt counter: "2 attempts remaining"
- Keep OTP input focused
- After 3 failures: "Too many attempts. Please sign in again." → redirect to /auth/login

---

### Response: Challenge Reused (HTTP 401 Unauthorized)

**HTTP Status:** `401 Unauthorized`  

**Response Body:**

```json
{
  "status": "ERROR",
  "data": null,
  "errorCode": "MFA_CHALLENGE_REUSED",
  "message": "This MFA challenge has already been used. Please sign in again.",
  "timestamp": "2026-04-20T10:30:45.123456"
}
```

**Scenarios:**

- Challenge token's jti is in RevokedRefreshToken table (already burned)
- Challenge was previously exchanged for tokens
- Attacker attempting to replay captured challenge token

**Security Implication:**

- **MEDIUM severity**: Possible MFA bypass attempt detected
- Audit log: `MFA_CHALLENGE_REUSED`, username, jti, IP, correlation-id
- Operator should review logs for patterns (distributed attack vs. accidental resubmission)

**React Handling:**

```typescript
if (response.errorCode === "MFA_CHALLENGE_REUSED") {
  // Challenge expired or already used
  logSecurityEvent("MFA challenge reused", {
    username: currentUsername,
    correlationId: getCorrelationIdFromResponse()
  });
  
  showAlert("MFA verification failed. Please sign in again.");
  router.push("/auth/login");
}
```

**UI Display:**
- "MFA challenge expired"
- "Please sign in again to receive a new code"
- Redirect to /auth/login after 3 seconds (auto-redirect)

---

### Response: Invalid Challenge (HTTP 401 Unauthorized)

**HTTP Status:** `401 Unauthorized`  

**Response Body:**

```json
{
  "status": "ERROR",
  "data": null,
  "errorCode": "INVALID_MFA_CHALLENGE",
  "message": "MFA challenge invalid or expired. Please sign in again.",
  "timestamp": "2026-04-20T10:30:45.123456"
}
```

**Scenarios:**

1. **Malformed challenge**: Not a valid JWT or signature does not verify
2. **Challenge expired**: `exp` claim timestamp < now (older than 5 minutes)
3. **Challenge corrupted**: Header or payload tampered/altered
4. **Tenant mismatch**: Challenge was issued for different tenant (cross-tenant attack prevention)
5. **Type mismatch**: JWT `type` claim != "mfa_challenge"

**Attack Prevention Details:**

- **Tampering detection**: JWT signature verification fails → 401 INVALID_MFA_CHALLENGE
- **Expiry enforcement**: No 5-minute grace; exact comparison (exp ≤ now)
- **Tenant isolation**: Challenge tenant_id must match request X-Tenant-Id header
- **Type checking**: JWT must have `"type": "mfa_challenge"` claim

**React Handling:**

```typescript
if (response.errorCode === "INVALID_MFA_CHALLENGE") {
  logSecurityEvent("Invalid/expired MFA challenge", {
    username: currentUsername,
    reason: response.message
  });
  
  if (response.message.includes("expired")) {
    // Challenge token expired; need to re-login
    showAlert("Your code request has expired. Please sign in again.");
  } else {
    // Token tampered or corrupted
    showAlert("Security verification failed. Please sign in again.");
  }

  // Force re-authentication from scratch
  clearMfaState();
  router.push("/auth/login");
}
```

**UI Display:**
- "MFA challenge invalid or expired"
- Redirect to /auth/login to restart login flow

---

## 🔄 ENDPOINT: POST /api/v1/auth/refresh

**HTTP Method:** `POST`  
**URL:** `https://api.finvanta.com/api/v1/auth/refresh`  
**Headers:** `Content-Type: application/json`, `X-Tenant-Id: DEFAULT`  

### Request

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtYWtlcjEiLCJpc3MiOiJmaW52YW50YSIsImF1ZCI6ImNicy1hcGkiLCJpYXQiOjE3MTM2MjEwNDUsImV4cCI6MTcxNjIxMzA0NSwndHlwZSI6InJlZnJlc2giLCJqdGkiOiJhM2Y1YzllMDEyZWUtNTUwZTg0MDAtZTI5Yi00MWQ0In0.signature"
}
```

**Field Definitions:**

| Field | Type | Required | Validation | Notes |
|-------|------|----------|-----------|-------|
| `refreshToken` | String | Yes | Valid JWT, type="refresh", not expired, jti not in revocation denylist | Provided by login/prev-refresh response |

**Example cURL Request:**

```bash
curl -X POST "https://api.finvanta.com/api/v1/auth/refresh" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: DEFAULT" \
  -d '{
    "refreshToken": "eyJ..."
  }'
```

---

### Response: Success (HTTP 200 OK)

**HTTP Status:** `200 OK`  
**Response Body:** (Identical to POST /api/v1/auth/token success response)

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
      "id": 1,
      "username": "maker1",
      "firstName": "Rajiv",
      "lastName": "Menon",
      "email": "maker1@finvanta.com",
      "roles": ["MAKER"],
      "branchCode": "HQ001",
      "branchName": "Head Office",
      "tenantId": "DEFAULT",
      "displayName": "Rajiv Menon",
      "mfaEnrolled": true
    }
  },
  "errorCode": null,
  "message": null,
  "timestamp": "2026-04-20T10:30:45.123456"
}
```

**Token Rotation Guarantee:**

- **Old refresh jti is revoked**: Recorded in RevokedRefreshToken table
- **New refresh token issued**: Different jti; valid for 30 days from now
- **Reuse detection**: Any attempt to use old jti → HTTP 401 REFRESH_TOKEN_REUSED
- **Theft detection**: If old token used after new one issued, indicates token was stolen and replayed

**React BFF Implementation (auto-refresh):**

```typescript
// lib/apiClient.ts
import axios, { AxiosInstance } from "axios";

class CbsApiClient {
  private axios: AxiosInstance;
  private refreshing = false;
  private refreshQueue: Promise<void>[] = [];

  constructor() {
    this.axios = axios.create({
      baseURL: "/api/v1",
      headers: { "X-Tenant-Id": "DEFAULT" }
    });

    // Response interceptor for auto-refresh
    this.axios.interceptors.response.use(
      response => response,
      async error => {
        const originalRequest = error.config;

        // If access token expired
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          // Serialize refresh requests (first waiter starts refresh, others wait)
          if (!this.refreshing) {
            this.refreshing = true;

            try {
              // Get refreshToken from httpOnly cookie (via BFF)
              const response = await this.axios.post("/auth/refresh", {
                refreshToken: getRefreshTokenFromCookie()
              });

              // Update tokens in cookies (BFF handles this)
              setAccessToken(response.data.data.accessToken);
              setRefreshToken(response.data.data.refreshToken);

              // Queue retry of original request
              this.refreshQueue.forEach(q => q());
              this.refreshQueue = [];

              // Retry original request with new token
              return this.axios(originalRequest);
            } catch (refreshError) {
              // Refresh failed (invalid/reused token)
              if (refreshError.response?.errorCode === "REFRESH_TOKEN_REUSED") {
                // Token theft detected!
                logSecurityAlert("Token reuse detected - possible theft!");
              }

              // Force re-login
              clearSession();
              window.location.href = "/auth/login?reason=session_expired";
              return Promise.reject(refreshError);
            } finally {
              this.refreshing = false;
            }
          } else {
            // Wait for refresh to complete
            return new Promise(resolve => {
              this.refreshQueue.push(() => resolve(this.axios(originalRequest)));
            });
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async request(config: any) {
    return this.axios.request(config);
  }
}

export const cbsApi = new CbsApiClient();
```

---

### Response: Token Reused (HTTP 401 Unauthorized)

**HTTP Status:** `401 Unauthorized`  

**Response Body:**

```json
{
  "status": "ERROR",
  "data": null,
  "errorCode": "REFRESH_TOKEN_REUSED",
  "message": "Refresh token has already been used. Please sign in again.",
  "timestamp": "2026-04-20T10:30:45.123456"
}
```

**Meaning:**

- **Theft Detection Alert**: The refresh token's jti is in RevokedRefreshToken table
- Token was already exchanged for new tokens (rotation completes)
- OR token is being replayed (attacker has captured token)

**Security Implications:**

| Scenario | Likelihood | Action |
|----------|-----------|--------|
| Normal rotation race | Low | User retries request; succeeds with new token |
| Legitimate replay (page refresh) | Low | User retries; succeeds |
| **Token theft** | Medium | Attacker has token; replaying after legitimate use |
| Distributed attack | High | Multiple IPs using same token concurrently |

**Audit Logging:**

```
Event: REFRESH_TOKEN_REUSED
Username: maker1
Token JTI: a3f5c9e0-12ee-550e8400
IP Address: 192.168.1.100
Timestamp: 2026-04-20T10:30:45.123456
Correlation-Id: 550e8400-e29b-41d4-a716-446655440000
Severity: MEDIUM
```

**SOC/Operations Response:**

- Analyst queries event logs for jti
- Checks timestamps of concurrent reuse attempts
- Checks IP addresses (same vs. different = theft indicator)
- If distributed attack detected: Quarantine account, notify user

**React BFF Handling:**

```typescript
// This happens in axios interceptor (see refresh example above)
if (error.response?.errorCode === "REFRESH_TOKEN_REUSED") {
  // Possible token theft
  const auditEvent = {
    type: "SECURITY_ALERT",
    message: "Refresh token reused - possible theft",
    timestamp: new Date(),
    username: getCurrentUsername()
  };

  // Send to security monitoring service
  await fetch("/api/security/alert", {
    method: "POST",
    body: JSON.stringify(auditEvent)
  });

  // Force immediate re-authentication
  clearSession();
  window.location.href = "/auth/login?reason=session_compromised";
}
```

**UI Display:**
- "Your session has been interrupted"
- "For security, please sign in again"
- Redirect to /auth/login (no delay; immediate forced logout)

---

### Response: Invalid Refresh Token (HTTP 401 Unauthorized)

**HTTP Status:** `401 Unauthorized`  

**Response Body:**

```json
{
  "status": "ERROR",
  "data": null,
  "errorCode": "INVALID_REFRESH_TOKEN",
  "message": "Refresh token is invalid or has expired. Please sign in again.",
  "timestamp": "2026-04-20T10:30:45.123456"
}
```

**Scenarios:**

1. **Malformed JWT**: Token is not a valid JWT format
2. **Signature invalid**: JWT signature does not match (token tampered)
3. **Expired**: `exp` claim < now (older than 30 days)
4. **Wrong type**: JWT `type` claim != "refresh" (user submitted access token by mistake)
5. **Issued by different system**: JWT `iss` claim != "finvanta"

**React Handling:**

```typescript
if (error.errorCode === "INVALID_REFRESH_TOKEN") {
  // Refresh token is bad; clear and re-login
  console.warn("Refresh token invalid; clearing session");
  
  clearSession();
  
  // BFF redirects browser
  window.location.href = "/auth/login?reason=session_expired";
}
```

**UI Display:**
- "Your session has expired"
- "Please log in again to continue"
- Redirect automatically to /auth/login

---

### Response: Account No Longer Valid (HTTP 401 Unauthorized)

**HTTP Status:** `401 Unauthorized`  

**Response Body:**

```json
{
  "status": "ERROR",
  "data": null,
  "errorCode": "ACCOUNT_INVALID",
  "message": "Your account is no longer valid. Please contact your administrator.",
  "timestamp": "2026-04-20T10:30:45.123456"
}
```

**Scenarios:**

1. **Account deactivated**: User account was deactivated after token was issued
2. **Account locked**: User account was locked after token was issued
3. **User deleted**: Rare edge case; user record removed from database
4. **Branch deactivated**: User's branch was dissolved/deactivated
5. **Tenant deactivated**: User's tenant was suspended/deactivated

**Detection:**

During token refresh:
1. Extract username from refresh token JWT
2. Load AppUser from database
3. Check `is_active = true`
4. Check `is_locked = false`
5. Check branch exists and is active
6. If any check fails → ACCOUNT_INVALID

**React Handling:**

```typescript
if (error.response?.errorCode === "ACCOUNT_INVALID") {
  // Account no longer available
  logSecurityEvent("Account invalid during refresh", {
    username: getUsername(),
    reason: error.response.message
  });

  showAlert(
    "Your account is no longer available.",
    "Please contact your administrator."
  );

  // Clear session and redirect
  clearSession();
  window.location.href = "/auth/login?reason=account_invalid";
}
```

**UI Display:**
- "Your account is no longer available"
- Show contact information for administrator
- Disable all functionality
- Redirect to /auth/login after 5 seconds (with warning displayed)

---

---

## 📊 ERROR CODE REFERENCE TABLE

**Complete error code mapping for error handling logic:**

| Error Code | HTTP Status | Description | Recovery |
|-----------|-----------|-------------|-----------|
| `INVALID_CREDENTIALS` | 401 | Username/password incorrect | Show countdown; retry |
| `ACCOUNT_LOCKED` | 401 | 5 failed attempts; locked 30 min | Show timer; await auto-unlock |
| `ACCOUNT_DISABLED` | 401 | Admin deactivated account | Contact admin |
| `PASSWORD_EXPIRED` | 403 | 90-day policy enforcement | Redirect to change password |
| `MFA_REQUIRED` | 428 | Credentials valid; MFA step-up | Redirect to MFA page |
| `MFA_VERIFICATION_FAILED` | 401 | TOTP code invalid/reused | Retry OTP entry |
| `MFA_CHALLENGE_REUSED` | 401 | Challenge already used | Redirect to login |
| `INVALID_MFA_CHALLENGE` | 401 | Challenge expired/tampered | Redirect to login |
| `VALIDATION_ERROR` | 400 | Missing/invalid fields | Show field errors |
| `RATE_LIMITED` | 429 | 5+ attempts in 15 min | Retry after exponential backoff |
| `REFRESH_TOKEN_REUSED` | 401 | Token theft detected | Force logout; alert security |
| `INVALID_REFRESH_TOKEN` | 401 | Token malformed/expired | Redirect to login |
| `ACCOUNT_INVALID` | 401 | Account deactivated during session | Show admin contact; redirect |
| `INTERNAL_ERROR` | 500 | Unexpected server error | Retry with exponential backoff |

---

## 📊 RESPONSE ENVELOPE SCHEMA

### Success Envelope (HTTP 200)

```typescript
interface ApiResponse<T> {
  status: "SUCCESS";
  data: T; // T = EnhancedTokenResponse for auth endpoints
  errorCode: null;
  message: null;
  timestamp: string; // ISO 8601 with milliseconds
}
```

### Error Envelope (HTTP 4xx/5xx)

```typescript
interface ApiResponse<T> {
  status: "ERROR";
  data: null | T; // T only for MFA_REQUIRED (contains challenge), usually null
  errorCode: string; // Machine-readable error code
  message: string; // Human-readable error message for display
  timestamp: string; // ISO 8601 with milliseconds
}
```

### EnhancedTokenResponse (Login Success)

```typescript
interface EnhancedTokenResponse {
  accessToken: string; // JWT; 15-min lifetime
  refreshToken: string; // JWT; 30-day lifetime; rotated
  tokenType: "Bearer"; // Always "Bearer"
  expiresIn: number; // Seconds until expiry (not epoch)
  businessDate: string; // YYYY-MM-DD; operational date
  user: UserInfoDto; // Complete user profile
  remainingAttempts?: number; // Only in error responses
}
```

### UserInfoDto (User Profile)

```typescript
interface UserInfoDto {
  id: number; // Database ID
  username: string; // Login username
  firstName: string; // First name
  lastName: string; // Last name
  email: string; // Email address
  roles: string[]; // RBAC roles: ["MAKER"], ["CHECKER"], etc.
  branchCode?: string; // Branch code: "HQ001"
  branchName?: string; // Branch name: "Head Office"
  tenantId: string; // Multi-tenancy ID: "DEFAULT"
  displayName: string; // Computed: firstName + " " + lastName
  mfaEnrolled: boolean; // MFA active for this user
}
```

### MfaChallenge (MFA Required Response)

```typescript
interface MfaChallenge {
  challengeId: string; // Opaque JWT token
  channel: "TOTP" | "SMS"; // MFA channel type
}
```

---

## 🎯 BFF INTEGRATION ARCHITECTURE

### Authentication Flow Diagram

```
React Browser
     │
     ├──────► POST /api/cbs/auth/login (BFF endpoint)
     │         { username, password }
     │
     │◄─────── Response: { success, user, token_hints }
     │
     └─ Store in SessionStorage:
        - user: UserInfoDto
        - businessDate: "2026-04-20"
        - tokenExpiresAt: timestamp

BFF (Next.js API Route)
     │
     ├──────► POST /api/v1/auth/token (Spring endpoint)
     │         Headers: X-Tenant-Id, X-Correlation-Id
     │         { username, password }
     │
     │◄─────── Response: { status, data: EnhancedTokenResponse }
     │
     ├─ Extract tokens from response
     │
     └─ Store in HttpOnly cookies:
        - access_token: Secure, HttpOnly, SameSite=Strict
        - refresh_token: Secure, HttpOnly, SameSite=Strict, Path=/api/refresh

Spring Boot Backend
     │
     ├─ Validate credentials
     ├─ Check account status
     ├─ Check password expiry
     ├─ Check MFA enrollment
     │
     └─ Return EnhancedTokenResponse
        - accessToken (15 min)
        - refreshToken (30 day, rotated)
        - user profile
        - businessDate
```

### Login Flow (finvanta-ui BFF)

**Step-by-step:**

1. **Browser submits login form**
   ```
   POST /api/cbs/auth/login
   Content-Type: application/json
   
   { username: "maker1", password: "finvanta123" }
   ```

2. **BFF proxies to Spring** (adds security headers)
   ```
   POST /api/v1/auth/token
   X-Tenant-Id: DEFAULT
   X-Correlation-Id: 550e8400-e29b-41d4-a716-446655440000
   
   { username: "maker1", password: "finvanta123" }
   ```

3. **Spring returns EnhancedTokenResponse**
   ```json
   {
     "status": "SUCCESS",
     "data": {
       "accessToken": "eyJ...",
       "refreshToken": "eyJ...",
       "expiresIn": 900,
       "businessDate": "2026-04-20",
       "user": { ... }
     }
   }
   ```

4. **BFF stores tokens in HttpOnly cookies**
   ```
   Set-Cookie: access_token=eyJ...; Secure; HttpOnly; SameSite=Strict; Max-Age=900
   Set-Cookie: refresh_token=eyJ...; Secure; HttpOnly; SameSite=Strict; Max-Age=2592000
   ```

5. **BFF stores user context in session**
   ```
   SessionStorage: {
     user: { id, username, firstName, lastName, email, roles, branchCode, ... },
     businessDate: "2026-04-20",
     loginTime: 1713621045123
   }
   ```

6. **BFF returns simplified response to React**
   ```json
   {
     "success": true,
     "data": {
       "id": 1,
       "username": "maker1",
       "displayName": "Rajiv Menon",
       "roles": ["MAKER"],
       "branchName": "Head Office"
     }
   }
   ```

7. **React UI stores user and businessDate in context**
   ```typescript
   const AuthContext = createContext();
   
   setAuthContext({
     user: response.user,
     businessDate: response.businessDate,
     isAuthenticated: true
   });
   ```

8. **React redirects to dashboard**
   ```
   /dashboard
   ```

### Token Refresh Flow (Silent Auto-Refresh)

**Triggered by:**
- Access token expiry < 10% time remaining (last 90 seconds of 15-min token)
- Failed request with 401 Unauthorized

**Process:**

1. **BFF detects expiry** (in axios interceptor)
   ```typescript
   const expiresAt = getTokenExpiresAt(); // from token claims
   const now = Date.now() / 1000;
   const timeRemaining = expiresAt - now;
   
   if (timeRemaining < expiresIn * 0.1) {
     // Less than 10% time left; refresh
   }
   ```

2. **BFF calls refresh endpoint**
   ```
   POST /api/v1/auth/refresh
   Content-Type: application/json
   Cookie: refresh_token=eyJ... (automatic)
   
   { refreshToken: "eyJ..." } // or empty if using cookie
   ```

3. **Spring validates and rotates tokens**
   - Checks old jti not in revocation denylist
   - Issues new accessToken (fresh 15 min)
   - Issues new refreshToken (old jti revoked)
   - Refreshes user profile and businessDate

4. **BFF updates cookies silently**
   ```
   Set-Cookie: access_token=eyJ...[NEW]; ...
   Set-Cookie: refresh_token=eyJ...[NEW]; ...
   ```

5. **No UI interruption**
   - React unaware of refresh
   - Business date automatically updated if changed
   - Session continues seamlessly

### Session Validation (On Each Request)

**React makes API call:**
```typescript
const response = await fetch("/api/clients", {
  headers: {
    "Authorization": `Bearer ${accessToken}`,
    "X-Business-Date": businessDate
  }
});
```

**BFF intercepts and validates:**
```typescript
1. Extract token from Authorization header
2. Decode JWT (no signature verification needed; httpOnly cookie ensures authenticity)
3. Check exp claim vs now:
   - If not expired: Forward to backend
   - If expired: Auto-refresh (see above)
   - If refresh fails: Redirect to /login
```

**Backend validates:**
```java
// AuthFilter or @RestControllerAdvice
String authHeader = request.getHeader("Authorization");
String token = authHeader.substring(7); // Remove "Bearer "
Claims claims = jwtTokenService.validateAndParse(token);
// If invalid: return 401 INVALID_ACCESS_TOKEN
```

---

---

## 🚀 REACT + NEXT.JS IMPLEMENTATION CHECKLIST

### Phase 1: Authentication Context & Hooks (Week 1)

- [ ] Create `AuthContext` with user profile, businessDate, isAuthenticated, isLoading
- [ ] Implement `useAuth()` hook for accessing auth state across components
- [ ] Create `useLogin()` hook with:
  - [ ] Username/password state
  - [ ] Error message and error type
  - [ ] Loading state during submit
  - [ ] Remaining attempts tracking (for INVALID_CREDENTIALS)
  - [ ] MFA redirect on HTTP 428
- [ ] Create `useRefresh()` hook for silent token refresh (called from axios interceptor)
- [ ] Set up axios/fetch instance with:
  - [ ] X-Tenant-Id header injection
  - [ ] X-Correlation-Id propagation (from response)
  - [ ] Authorization: Bearer token injection
  - [ ] 401 response interceptor for auto-refresh

### Phase 2: Login Pages & Components (Week 1-2)

- [ ] Create `/auth/login` page
  - [ ] Username input field
  - [ ] Password input field (masked)
  - [ ] "Remember me" checkbox (future)
  - [ ] Submit button (disabled during loading)
  - [ ] Inline error display (field-level or banner)
  - [ ] Attempt counter (show "3 attempts remaining")
  - [ ] "Forgot password" link
- [ ] Create `/auth/mfa` page (conditional)
  - [ ] OTP input field (6 digits only, auto-focus, auto-advance)
  - [ ] "Verify" button
  - [ ] Counter for remaining attempts (max 3)
  - [ ] "Use backup codes" link (placeholder)
  - [ ] Auto-logout on 3 failed attempts
  - [ ] Countdown timer if challenge expired
- [ ] Create error components:
  - [ ] AccountLockedAlert (shows timer)
  - [ ] PasswordExpiredDialog (redirects to password change)
  - [ ] SessionExpiredAlert (auto-logout)
  - [ ] RateLimitedAlert (shows Retry-After countdown)

### Phase 3: Session Management (Week 2)

- [ ] Implement SessionStorage management
  - [ ] Save user profile after login
  - [ ] Save businessDate after login
  - [ ] Update on every refresh
  - [ ] Clear on logout
- [ ] Implement Header display
  - [ ] Show user displayName
  - [ ] Show branch name
  - [ ] Show business date prominently
  - [ ] Show logout button
- [ ] Implement token management
  - [ ] Extract expiresIn from response
  - [ ] Schedule token refresh at 80% (12 min for 15-min token)
  - [ ] Handle auto-refresh silently
  - [ ] Show warning banner at 90% expiry (1.5 min remaining)
  - [ ] Force logout if refresh fails

### Phase 4: Error Handling & Security (Week 2-3)

- [ ] Implement error code handlers:
  - [ ] INVALID_CREDENTIALS → Show countdown, allow retry
  - [ ] ACCOUNT_LOCKED → Show timer, disable form, show admin contact
  - [ ] ACCOUNT_DISABLED → Disable form, show admin contact
  - [ ] PASSWORD_EXPIRED → Redirect to change-password flow
  - [ ] MFA_REQUIRED → Redirect to MFA page
  - [ ] MFA_VERIFICATION_FAILED → Show "invalid code", retry
  - [ ] RATE_LIMITED → Show countdown, disable form, retry with backoff
  - [ ] REFRESH_TOKEN_REUSED → Force logout, show security alert
  - [ ] ACCOUNT_INVALID → Force logout
  - [ ] INTERNAL_ERROR → Show support reference, retry with backoff
- [ ] Implement security features:
  - [ ] CSRF token handling (if using form submissions)
  - [ ] XSS prevention (sanitize user input)
  - [ ] CORS preflight handling (if needed)
  - [ ] Secure cookie flags (Secure, HttpOnly, SameSite)
  - [ ] Excessive logging prevention (don't log passwords)
- [ ] Implement audit/monitoring:
  - [ ] Log failed login attempts with IP
  - [ ] Log token refresh events (with jti)
  - [ ] Log forced logouts (with reason)
  - [ ] Send to monitoring service (Sentry, etc.)

### Phase 5: Advanced Features (Week 3-4)

- [ ] Implement exponential backoff retry logic (for rate limiting)
- [ ] Implement session timeout warning (before token expiry)
- [ ] Implement "Remember Me" checkbox (future enhancement)
- [ ] Implement backup codes for MFA (if supported)
- [ ] Implement biometric login (future enhancement)
- [ ] Implement password reset flow (separate endpoint)
- [ ] Implement account unlock request flow (for admins)

### Phase 6: Testing (Week 4)

- [ ] Unit tests for `useAuth()` hook
- [ ] Unit tests for `useLogin()` hook
- [ ] Component tests for login form
- [ ] Component tests for MFA form
- [ ] Integration tests for full login flow
- [ ] Integration tests for token refresh
- [ ] Integration tests for session expiration handling
- [ ] E2E tests with Playwright (login, MFA, logout)
- [ ] Error scenario tests (invalid credentials, locked account, rate limit)
- [ ] Security tests (XSS, CSRF, token theft detection)

### Phase 7: Performance & Monitoring (Week 4)

- [ ] Profile login component rendering
- [ ] Optimize re-renders (useMemo, useCallback)
- [ ] Monitor login endpoint latency (P50, P95, P99)
- [ ] Monitor token refresh latency
- [ ] Monitor error rates by error code
- [ ] Set up alerts for:
  - [ ] High INVALID_CREDENTIALS rate (brute force attack)
  - [ ] High RATE_LIMITED rate (DDoS)
  - [ ] High REFRESH_TOKEN_REUSED rate (token theft)
  - [ ] High INTERNAL_ERROR rate (backend issue)

---

## 📋 TYPESCRIPT TYPES (Copy to frontend)

```typescript
// types/auth.ts

export interface LoginRequest {
  username: string;
  password: string;
}

export interface MfaVerifyRequest {
  challengeId: string;
  otp: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface UserInfoDto {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
  branchCode?: string;
  branchName?: string;
  tenantId: string;
  displayName: string;
  mfaEnrolled: boolean;
}

export interface EnhancedTokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  businessDate: string;
  user: UserInfoDto;
}

export interface ApiResponse<T> {
  status: "SUCCESS" | "ERROR";
  data: T | null;
  errorCode: string | null;
  message: string | null;
  timestamp: string;
}

export interface MfaChallenge {
  challengeId: string;
  channel: "TOTP" | "SMS";
}

export enum ErrorCode {
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  ACCOUNT_LOCKED = "ACCOUNT_LOCKED",
  ACCOUNT_DISABLED = "ACCOUNT_DISABLED",
  PASSWORD_EXPIRED = "PASSWORD_EXPIRED",
  MFA_REQUIRED = "MFA_REQUIRED",
  MFA_VERIFICATION_FAILED = "MFA_VERIFICATION_FAILED",
  MFA_CHALLENGE_REUSED = "MFA_CHALLENGE_REUSED",
  INVALID_MFA_CHALLENGE = "INVALID_MFA_CHALLENGE",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  RATE_LIMITED = "RATE_LIMITED",
  REFRESH_TOKEN_REUSED = "REFRESH_TOKEN_REUSED",
  INVALID_REFRESH_TOKEN = "INVALID_REFRESH_TOKEN",
  ACCOUNT_INVALID = "ACCOUNT_INVALID",
  INTERNAL_ERROR = "INTERNAL_ERROR"
}
```

---

## ✅ PRODUCTION READINESS CHECKLIST

**Backend:** 

- [x] All endpoints implemented in Spring Boot
- [x] Response envelope standardized (ApiResponse<T>)
- [x] HTTP status codes compliant with RFC 7231
- [x] Timestamps in ISO 8601 format
- [x] No stack traces exposed to client
- [x] Correlation IDs generated and echoed
- [x] Error codes machine-readable (UPPERCASE_WITH_UNDERSCORES)
- [x] PII never logged or returned (passwords, PINs)
- [x] Rate limiting on /api/v1/auth/token (5 per 15 min)
- [x] MFA step-up returns HTTP 428 (RFC 8297)
- [x] Refresh token rotation with jti denylist
- [x] Multi-tenant isolation (X-Tenant-Id enforced)
- [x] Account lockout (5 attempts, 30-min auto-unlock)
- [x] Password expiry (90-day rotation)
- [x] Complete audit logging

**Frontend:**

- [ ] Login form with error handling per error code table
- [ ] MFA form with 6-digit OTP input
- [ ] Auto-refresh without user interruption
- [ ] Session timeout warning (at 80% expiry)
- [ ] Forced logout on 401 REFRESH_TOKEN_REUSED or ACCOUNT_INVALID
- [ ] Exponential backoff retry logic for rate limiting
- [ ] UI shows countdown timers (lockout, rate limit, session expiry)
- [ ] UI blocks form during lockout/rate limit
- [ ] Correlation ID shown in error messages (for support)
- [ ] Business date displayed in header (updated on refresh)
- [ ] User profile displayed in header (name, branch)

---

**Document Version:** 2.0  
**Last Updated:** April 20, 2026  
**Authored by:** Senior Core Banking Architect  
**Target Audience:** React + Next.js Frontend Development Team  
**Next Review:** Q3 2026 (Post-production audit)  
**Status:** READY FOR IMPLEMENTATION

