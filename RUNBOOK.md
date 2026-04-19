# FINVANTA CBS -- Local Dev Runbook

End-to-end guide for running, wiring, and debugging the two repos that
make up the Tier-1 CBS stack:

- **Backend (Spring Boot)** -- `dnyaneshghodake/finvanta`, JSP legacy UI
  + REST surface under `/api/v{N}/**`.
- **Frontend (Next.js BFF)** -- `dnyaneshghodake/finvanta-ui`, React +
  Next.js 16 App Router, Backend-for-Frontend pattern. The browser
  **only** talks to `/api/cbs/**` on Next.js; Next.js holds the JWT in
  an encrypted HttpOnly cookie and proxies to Spring.

If you just want to log in and poke around, see the [Quickstart](#quickstart).
If something is broken, start at [Debugging](#debugging).

---

## 1. Topology

```
+--------------+    fv_sid / fv_csrf / fv_mfa    +----------------+
|   Browser    | <------------------------------ |  Next.js BFF   |
| (React 19)   |  JSON + X-CSRF-Token            |  :3000         |
+--------------+                                  |  /api/cbs/**   |
                                                  +--------+-------+
                                                           |
                                                           |  Authorization: Bearer <jwt>
                                                           |  X-Correlation-Id
                                                           |  X-Tenant-Id
                                                           |  X-Branch-Code
                                                           |  X-Idempotency-Key
                                                           v
                                                  +----------------+
                                                  |  Spring CBS    |
                                                  |  :8080         |
                                                  |  /api/v1/**    |
                                                  |  (JSP at /api) |
                                                  +----------------+
```

The Spring server is deployed under Tomcat context path `/api`. The
REST controllers are mapped at `/v1/**` (Tier-1 standard after the
April 2026 refactor), so the externally reachable REST URL is
`http://localhost:8080/api/v1/<resource>` -- a single `/api/v1` prefix,
exactly as Finacle DIGITAL API / Temenos IRIS / Oracle Banking APIs
expose their surface. The JSP legacy UI is unchanged and still served
from `http://localhost:8080/api/<jsp-path>` (e.g. `/api/login`).

> If you still see `/api/api/v1/...` URLs anywhere, pull `master` on
> the backend -- controllers pre-April-2026 had `@RequestMapping("/api/v1/...")`
> which doubled the prefix.

---

## 2. Prerequisites

| Tool | Version | Used by |
|---|---|---|
| Java | 17 (LTS) | Backend |
| Maven | 3.9+ (or `./mvnw`) | Backend |
| Node.js | 20 LTS (>=20.12) | Frontend |
| pnpm | 9.x (or npm 10) | Frontend |
| curl | any | Smoke tests |
| A real terminal | PowerShell 7+ on Windows, or bash | PS 5 mangles JSON |

On Windows use `curl.exe`, not `curl` -- the PowerShell alias resolves
to `Invoke-WebRequest` and prints a different shape.

---

## 3. Backend -- `dnyaneshghodake/finvanta`

### 3.1 Clone + build

```bash
git clone https://github.com/dnyaneshghodake/finvanta.git
cd finvanta
git checkout devin/1776589773-ui-migration-nextjs-bff
./mvnw -DskipTests package
```

### 3.2 Environment variables

None are strictly required for the `dev` profile. The dev profile uses
an in-memory H2 database seeded with 6 operator accounts on startup.

Optional overrides:

| Var | Purpose | Format | Default (dev) |
|---|---|---|---|
| `FINVANTA_PII_KEY` | AES-256-GCM key for PII encryption (PAN, Aadhaar, mobile, email). | **Exactly 64 hex chars** (= 32 bytes). Whitespace is trimmed, so trailing `\n` or spaces are tolerated. | A built-in dev key. |
| `FINVANTA_MFA_KEY` | AES-256-GCM key for MFA TOTP secret encryption. | 64 hex chars. | Dev default. |
| `SPRING_PROFILES_ACTIVE` | Profile name. | `dev` / `prod` | `dev` |
| `server.port` | HTTP port. | int | `8080` |

To generate a real 32-byte key:
```bash
openssl rand -hex 32
```

PowerShell:
```powershell
$env:FINVANTA_PII_KEY = -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
$env:FINVANTA_PII_KEY.Length   # must print 64
```

**Common mistake**: exporting the key with a trailing newline from a
Here-String or `.env` file, which gives `65 chars, got 64` or similar.
The April 2026 hardening (`PiiEncryptionConverter.getKeySpec()`) calls
`.trim()` on the env value, so leading/trailing whitespace is now safe.

### 3.3 Run

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

You should see:

```
Tomcat started on port 8080 (http) with context path '/api'
Started FinvantaApplication in X.XXX seconds
Dev credentials: maker1/maker2/checker1/checker2/admin/auditor1 -- password: finvanta123
```

### 3.4 Seeded dev users

All use password `finvanta123`. MFA is disabled.

| Username | Role | Branch |
|---|---|---|
| `maker1` | MAKER | HQ001 |
| `maker2` | MAKER | DEL001 |
| `checker1` | CHECKER | HQ001 |
| `checker2` | CHECKER | DEL001 |
| `admin` | ADMIN | HQ001 |
| `auditor1` | AUDITOR | HQ001 |

Seeded accounts: `SB-HQ001-000001` (Rajesh Sharma), `SB-DEL001-000001`
(Priya Patel).

### 3.5 Health + smoke tests

```bash
# Liveness
curl http://localhost:8080/api/actuator/health
# -> {"status":"UP"}

# Login (REST, bypass BFF)
curl -i -X POST http://localhost:8080/api/v1/auth/token \
     -H "Content-Type: application/json" \
     -H "X-Tenant-Id: DEFAULT" \
     -d '{"username":"maker1","password":"finvanta123"}'
# -> HTTP/1.1 200 ... {"status":"SUCCESS","data":{"accessToken":"eyJ...","refreshToken":"..."}}
```

If this returns `302` to `/api/error/403` with a `FINVANTA_SESSION`
cookie, the API filter chain did **not** match and the JSP form-login
caught the request. That means you're on a version of the backend
before the April 2026 refactor -- rebase onto
`devin/1776589773-ui-migration-nextjs-bff`.

### 3.6 H2 console

Available at `http://localhost:8080/api/h2-console` with:

- JDBC URL: `jdbc:h2:mem:finvantadb`
- User: `SA`, password: *(empty)*

The DB is in-memory so it is wiped on every restart and re-seeded by
`CbsBootstrapInitializer`.

---

## 4. Frontend -- `dnyaneshghodake/finvanta-ui`

### 4.1 Clone + install

```bash
git clone https://github.com/dnyaneshghodake/finvanta-ui.git
cd finvanta-ui
git checkout enhancements
pnpm install     # or: npm install
```

### 4.2 Environment variables

Copy `.env.example` to `.env.local` (never committed):

```
# Browser <-> BFF. Must stay relative (same-origin) so the BFF owns
# auth/CSRF/correlation. Never point the browser directly at Spring.
NEXT_PUBLIC_API_URL=/api/cbs

# Server-side only. BFF appends /api/v1/<resource> to this URL.
CBS_BACKEND_URL=http://localhost:8080

# Session + CSRF secrets. Must be >= 32 chars, high-entropy.
# Dev defaults are fine locally; they are rejected in production.
CBS_SESSION_SECRET=dev-session-secret-change-me-please-32-bytes-0000
CBS_CSRF_SECRET=dev-csrf-secret-change-me-please-32-bytes-000000

CBS_SESSION_COOKIE=fv_sid
CBS_CSRF_COOKIE=fv_csrf
CBS_MFA_COOKIE=fv_mfa
CBS_SESSION_TTL_SECONDS=900
CBS_MFA_TTL_SECONDS=300
CBS_DEFAULT_TENANT=DEFAULT
NODE_ENV=development
```

Generate production secrets:
```bash
openssl rand -base64 48 | tr -d '=/+' | head -c 48
```

> **Next.js loads `.env.local` with higher priority than `.env.development`.**
> If you change `.env.development` and still see the old value, delete
> or edit `.env.local` too.

### 4.3 Run

```bash
pnpm dev          # http://localhost:3000
pnpm build        # production build
pnpm start        # production server
pnpm lint
pnpm typecheck
```

Open `http://localhost:3000/` -- it redirects to `/login` (or
`/dashboard` if you already have an `fv_sid`). Sign in with
`maker1` / `finvanta123`.

### 4.4 Start order

Always start Spring first, then Next.js:

```bash
# Terminal 1
cd finvanta
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

# Terminal 2 (after "Started FinvantaApplication")
cd finvanta-ui
pnpm dev
```

Next.js does not wait for Spring; if Spring isn't up when a BFF route
fires, you'll get `502` with `errorCode: LOGIN_FAILED` or
`CBS_UNREACHABLE`.

---

## 5. Quickstart

```bash
# 1. Backend
cd finvanta
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

# 2. Frontend (new terminal)
cd finvanta-ui
cp .env.example .env.local   # if you haven't already
pnpm install
pnpm dev

# 3. Browser
open http://localhost:3000/    # redirects to /login
# sign in with maker1 / finvanta123
```

---

## 6. Request lifecycle (what happens on login)

1. Browser `POST /api/cbs/auth/login` with `{username, password}` +
   `X-CSRF-Token` (double-submit cookie).
2. Next.js `app/api/cbs/auth/login/route.ts`:
   - Generates / reads correlation id.
   - Calls Spring `POST http://localhost:8080/api/v1/auth/token` with
     `X-Tenant-Id: DEFAULT` and `X-Correlation-Id`.
3. Spring `AuthController.issueToken(...)` issues an access JWT +
   refresh JWT.
4. Next.js encrypts the session payload (`accessToken`, `refreshToken`,
   `user`, `expiresAt`) with AES-256-GCM using `CBS_SESSION_SECRET`,
   sets:
   - `fv_sid`  = encrypted session, HttpOnly, SameSite=Lax.
   - `fv_csrf` = random 32-byte token, JS-readable, SameSite=Lax.
5. Browser gets `{success:true, data:{user, expiresAt, csrfToken}, correlationId}`.
6. Subsequent browser calls to `/api/cbs/**` send `fv_sid` (HttpOnly)
   and `X-CSRF-Token: <fv_csrf>` (double-submit). The BFF attaches the
   JWT from `fv_sid` as `Authorization: Bearer ...` before forwarding
   to Spring.

The JWT **never crosses the cookie boundary to the browser**.

---

## 7. Correlation IDs

Every BFF request generates (or propagates) an `X-Correlation-Id` UUID.
This id is:

- Returned in the response header `x-correlation-id`.
- Included in the JSON body under `correlationId`.
- Logged by Spring (MDC key `CORRELATION_ID`) -- grep the log for the
  id to find the single-request trace.
- Rendered in the success-panel "Correlation Ref" badge on every
  posting screen.

Trace flow:

```
Browser -> [x-correlation-id: abc123] -> Next.js BFF
             [x-correlation-id: abc123] -> Spring
                                         |
                                         v
                                     Spring log:
                                     [DEFAULT//abc123] ...
```

---

## 8. Debugging

### 8.1 Reading Next.js stderr

In the terminal running `pnpm dev`:

```
 GET /login 200 in 238ms (next.js: 31ms, proxy.ts: 8ms, application-code: 199ms)
 POST /api/cbs/auth/login 502 in 1628ms (next.js: 104ms, proxy.ts: 7ms, application-code: 1516ms)
```

The `502` alone is opaque. Look at the 5-15 lines **above** it for a
stack trace starting with `Error:`, `TypeError:`, `FetchError:`, or
`Error [NEXT_REDIRECT]`. That's where the BFF's actual failure is.

If there is no stack trace above the 502, the BFF returned 502
cleanly (e.g. `errorCode: LOGIN_FAILED` from `app/api/cbs/auth/login/route.ts`
line 148) because Spring answered with a non-200 shape. In that case
run the direct curl in [3.5](#35-health--smoke-tests) to see what
Spring actually said.

### 8.2 Inspecting cookies

Browser DevTools -> Application -> Cookies -> `http://localhost:3000`:

| Cookie | Shape | Notes |
|---|---|---|
| `fv_sid` | Long base64. HttpOnly. | AES-256-GCM-encrypted session; cannot be decrypted without `CBS_SESSION_SECRET`. |
| `fv_csrf` | 32-byte hex/b64. NOT HttpOnly. | Double-submit token; the browser reads it and echoes it as `X-CSRF-Token`. |
| `fv_mfa` | Opaque challenge id. HttpOnly. | Short-lived (5 min). Only present between step-1 and step-2 of MFA. |
| `FINVANTA_SESSION` | JSESSIONID-style. | **Wrong cookie** -- this is the JSP form-login session. If you see this on a BFF login, the Spring API chain didn't match (see [3.5](#35-health--smoke-tests)). |

### 8.3 Failure matrix

| Symptom | Cause | Fix |
|---|---|---|
| Backend startup: `FINVANTA_PII_KEY is set but invalid: expected 64 hex chars, got 65 chars` | Trailing whitespace / newline in env var. | Already trimmed by April 2026 build. Either pull latest or `Remove-Item Env:FINVANTA_PII_KEY` to use the dev default. |
| `curl POST /api/v1/auth/token` -> `302 Location: /api/error/403` + `FINVANTA_SESSION` cookie | JSP form-login caught the request instead of the API filter chain. | Rebuild backend from April 2026+. SecurityConfig must use `/v1/**` matchers (context path `/api` is stripped before matchers run). |
| `POST /api/cbs/auth/login` -> `502 LOGIN_FAILED` but Spring is UP | `CBS_BACKEND_URL` misconfigured (e.g. still `http://localhost:8080/api` from the pre-Tier-1 workaround). | Set `CBS_BACKEND_URL=http://localhost:8080` in **both** `.env.local` and `.env.development`, restart `pnpm dev`. |
| `403 CSRF_REJECTED` on all POSTs | Browser didn't send `X-CSRF-Token` or the value doesn't match the `fv_csrf` cookie. | Make sure the UI uses `apiClient` (it reads `fv_csrf` automatically). For curl, pass `-b jar.txt -H "X-CSRF-Token: $(awk '$6=="fv_csrf"{print $7}' jar.txt)"`. |
| `401 MISSING_SESSION` on authenticated endpoints | `fv_sid` missing, expired, or decrypted with a different `CBS_SESSION_SECRET`. | Sign in again. Never rotate `CBS_SESSION_SECRET` between dev restarts or all live sessions invalidate. |
| `428 MFA_REQUIRED` on a seeded user | MFA flag got flipped in H2. | Restart Spring -- H2 is in-memory, seed data comes back with MFA disabled. |
| `409 VERSION_CONFLICT` on update | Optimistic-lock conflict -- someone else saved a newer version. | Refetch, re-apply changes, retry. Surfaced as a dialog in the UI. |
| `502 CBS_UNREACHABLE` / `ECONNREFUSED 127.0.0.1:8080` | Spring isn't running (or died during startup). | Check Spring terminal for `Application run failed`. Restart after fixing the root cause. |
| `Dashboard flashes then redirects to /login` | `fv_sid` present but expired; `readSession()` returns null. | Sign in again. Increase `CBS_SESSION_TTL_SECONDS` for longer dev sessions. |
| Next.js warns `Port 3000 is in use by an unknown process, using 3001` | A previous `pnpm dev` is still running. | `pkill -f 'next dev'` (bash) or Task Manager -> end `node.exe` (Windows). |

### 8.4 Useful curl recipes

Login and stash cookies:
```bash
JAR=/tmp/jar.txt; rm -f $JAR
curl -sS -c $JAR -o /dev/null http://localhost:3000/login
CSRF=$(awk '$6=="fv_csrf"{print $7}' $JAR)
curl -sS -i -b $JAR -c $JAR -X POST http://localhost:3000/api/cbs/auth/login \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d '{"username":"maker1","password":"finvanta123"}'
```

Authenticated read:
```bash
curl -sS -b $JAR http://localhost:3000/api/cbs/accounts
```

Authenticated write:
```bash
CSRF=$(awk '$6=="fv_csrf"{print $7}' $JAR)
curl -sS -i -b $JAR -c $JAR -X POST http://localhost:3000/api/cbs/transactions/transfer \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d '{"fromAccount":"SB-HQ001-000001","toAccount":"SB-DEL001-000001","amount":100.00,"currency":"INR"}'
```

Trace a correlation id end-to-end:
```bash
CORR=$(uuidgen)
curl -sS -H "X-Correlation-Id: $CORR" -b $JAR http://localhost:3000/api/cbs/accounts
grep "$CORR" /path/to/spring.log   # should show the full Spring trace
```

---

## 9. CI / lint / typecheck

Before pushing, run on both repos:

```bash
# Backend
cd finvanta
./mvnw -q test

# Frontend
cd finvanta-ui
pnpm lint
pnpm typecheck
pnpm build
```

---

## 10. Glossary

| Term | Definition |
|---|---|
| **CBS** | Core Banking System. |
| **BFF** | Backend-for-Frontend. A server-side facade (here, Next.js) that owns session, CSRF, correlation, and JWT. |
| **Maker-Checker** | Dual-authorisation workflow. Maker submits, Checker approves. |
| **Correlation Id** | UUID threaded through every request for cross-system tracing. |
| **Double-submit CSRF** | CSRF strategy where the same token is sent in both a cookie (`fv_csrf`) and a header (`X-CSRF-Token`); the server requires them to match. |
| **Context path** | Tomcat prefix (`/api`) stripped before Spring MVC / Spring Security see the path. Matchers must use the context-relative path (e.g. `/v1/**`, not `/api/v1/**`). |
