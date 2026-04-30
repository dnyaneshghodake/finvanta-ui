# FINVANTA CBS — Architecture Document

**Version:** 1.0.0  
**Date:** 2026-04-30  
**Classification:** Internal - Tier-1 CBS  
**Architecture:** React BFF + Spring Boot Backend (Microservices)

---

## 1. Executive Summary

FINVANTA is a Tier-1 Core Banking System (CBS) built on a **React BFF (Backend-for-Frontend)** architecture with Spring Boot microservices. The system implements a modern banking portal with:

- **Frontend:** Next.js 16 + React 19 with TypeScript
- **Backend:** Spring Boot microservices (auth, customer, account, teller)
- **Security:** JWT-based stateless authentication with MFA step-up
- **Compliance:** RBI Cyber Security Framework 2024 aligned

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Login   │  │Dashboard │  │ Teller  │  │ Reports │   │
│  │   SPA   │  │   SPA    │  │   SPA   │  │   SPA   │   │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘   │
└───────┼────────────┼────────────┼────────────┼───────────────┘
        │            │            │            │
        │    ┌─────┴────────────┴────────────┴─────┐
        │    │         NEXT.JS BFF (Port 3000)    │
        │    │  ┌────────────────────────────┐  │
        │    │  │  proxy.ts (Auth + Routing) │  │
        │    │  │  - JWT injection          │  │
        │    │  │  - X-Tenant-Id injection   │  │
        │    │  │  - CSRF enforcement      │  │
        │    │  │  - Rate limiting         │  │
        │    │  │  - Proactive refresh   │  │
        │    │  └────────────────────────────┘  │
        │    │  ┌────────────────────────────┐  │
        │    │  │   Session Management       │  │
        │    │  │  - Encrypted cookies     │  │
        │    │  │  - Server-side session   │  │
        │    │  │  - Sliding window TTL     │  │
        │    │  └────────────────────────────┘  │
        └──► ► │     /api/cbs/**             │ ◄─┘
              │   ┌────────────────────────┐ │
              │   │  Auth Routes           │ │
              │   │  - /auth/login         │ │
              │   │  - /auth/mfa/verify    │ │
              │   │  - /auth/logout       │ │
              │   │  - /auth/me          │ │
              │   └────────────────────────┘ │
              │   ┌────────────────────────┐ │
              │   │  Session Routes         │ │
              │   │  - /session/heartbeat │ │
              │   │  - /session/extend   │ │
              │   │  - /session/switch-branch │ │
              │   └────────────────────────┘ │
              └──────────┬──────────────────┘
                         │ JWT + X-Tenant-Id
        ┌────────────────┴────────────────┐
        │    SPRING BOOT MICROSERVICES     │
        ├───────────────────────────────┤
        │  /api/v1/auth/*               │  ┌─ AuthService
        │  /api/v1/context/*            │  ├─ ContextService
        │  /api/v1/customer/*          │  ├─ CustomerService
        │  /api/v1/account/*           │  ├─ AccountService
        │  /api/v1/teller/*            │  ├─ TellerService
        │  /api/v1/admin/*             │  ├─ AdminService
        │  /api/v1/reports/*           │  └─ ReportingService
        └──────────────────────────────┘
                         │
        ┌────────────────┴────────────┐
        │     DATABASE (PostgreSQL)   │
        │  ┌───────┐ ┌───────┐       │
        │  │ CBS  │ │ AUDIT │       │
        │  │  DB  │ │  DB  │       │
        │  └─────┘ └───────┘       │
        └──────────────────────────┘
```

---

## 3. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | React | 19.2.4 |
| Meta-Framework | Next.js | 16.2.4 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| State Management | Zustand | 5.0.12 |
| Form Handling | React Hook Form | 7.72.1 |
| Validation | Zod | 4.3.6 |
| HTTP Client | Axios | 1.15.0 |
| Testing (Unit) | Vitest | 3.2.1 |
| Testing (E2E) | Playwright | 1.52.0 |
| Backend | Spring Boot | 3.x |
| Database | PostgreSQL | 15.x |
| Auth | JWT (stateless) | - |

---

## 4. Application Structure

```
finvanta-ui/
├── app/                          # Next.js App Router
│   ├── (dashboard)/               # Authenticated dashboard route group
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── api/
│   │   └── cbs/                # BFF API routes
│   │       ├── auth/            # Auth endpoints
│   │       │   ├── login/
│   │       │   ├── logout/
│   │       │   ├── me/
│   │       │   └── mfa/
│   │       ├── session/         # Session management
│   │       │   ├── heartbeat/
│   │       │   ├── extend/
│   │       │   └── switch-branch/
│   │       ├── health/
│   │       └── [...path]/      # Generic proxy to Spring
│   ├── login/                  # Login page (public)
│   ├── teller/                 # Teller operations
│   └── layout.tsx             # Root layout
├── src/
│   ├── components/             # Reusable React components
│   │   ├── ui/               # primitives (Button, Input...)
│   │   ├── forms/             # Form components
│   │   ├── layout/            # Header, Sidebar...
│   │   └── ...
│   ├── config/                # App configuration
│   ├── constants/             # App constants
│   ├── contexts/             # React contexts
│   ├── hooks/                # Custom React hooks
│   ├── lib/                 # Core utilities
│   │   ├── server/           # Server-only utilities
│   │   │   ├── env.ts        # Environment config
│   │   │   ├── session.ts    # Session management
│   │   │   ├── proxy.ts    # BFF proxy
│   │   │   ├── csrf.ts    # CSRF enforcement
│   │   │   ├── rateLimit.ts
│   │   │   └── correlation.ts
│   │   └── client/           # Client utilities
│   ├── modules/             # Feature modules
│   ├── security/           # Security utilities
│   ├── services/           # API services
│   ├── store/             # Zustand stores
│   ├── test/              # Test utilities
│   ├── tokens/            # Design tokens
│   ├── types/             # TypeScript types
│   └── utils/             # General utilities
├── docs/                   # API contracts
│   ├── LOGIN_API_CONTRACT.md
│   ├── ACCOUNT_API_CONTRACT.md
│   ├── CUSTOMER_API_CONTRACT.md
│   └── TELLER_API_CONTRACT.md
├── e2e/                    # Playwright tests
└── public/                  # Static assets
```

---

## 5. Authentication Flow

```
┌────────────────────────────────────────────────────────────────┐
│            TWO-PHASE AUTH FLOW              │
├────────────────────────────────────────────────────────────────┤
│                                                │
│  ┌────────┐    ┌─────────────────────┐           │
│  │ User  │───▶│ POST /auth/login  │           │
│  │       │    │ {user, pass}     │           │
│  └────────┘    └────────┬────────┘           │
│                         │                    │
│                    ┌────▼─────────────┐     │
│                    │ Spring /token   │     │
│                    │ Verify creds   │     │
│                    └────┬───────────┘     │
│              ┌─────────┼──────────┐       │
│              │         │          │       │
│         ┌────▼──┐  ┌───▼───┐  ┌──▼────┐
│         │ 200   │  │ 428   │  │ 401   │
│         │ OK    │  │ MFA   │  │ FAIL  │
│         └───┬───┘  └───┬────┘  └──┬─────┘
│             │         │          │
│      ┌──────▼────────┴───┐    │
│      │  Store session    │     │
│      │ - JWT            │     │
│      │ - User context  │     │
│      │ - CSRF token  │     │
│      │ - Expires TTL  │     │
│      └──────┬───────┘     │
│             │           │
│        ┌────▼─────┐    │
│        │ Bootstrap│    │
│        │ Context │    │
│        └─────────┘    │
│             │           │
│  ┌────────▼──────────────┐
│  │ POST /auth/mfa/verify
│  │ {challengeId, OTP}
│  └────────┬──────┘
│           │
│      ┌───▼──────┐
│      │ Issue    │
│      │ Session │
│      └─────────┘
└────────────────────────────────────────────────────────────────┘
```

---

## 6. Security Architecture

### 6.1 Multi-Layer Security

| Layer | Protection | Implementation |
|-------|-----------|----------------|
| **L1 - Edge** | Host allow-list | proxy.ts enforceHostAllowList |
| **L2 - BFF** | Session presence | proxy.ts enforceSession |
| **L3 - BFF** | Rate limiting | rateLimit.ts (20 req/IP/60s) |
| **L4 - BFF** | JWT injection | proxy.ts forward() |
| **L5 - BFF** | CSRF enforcement | csrf.ts double-submit |
| **L6 - Backend** | JWT validation | Spring Security |
| **L7 - Backend** | Tenant isolation | TenantFilter |

### 6.2 Security Headers

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-...' ...
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: accelerometer=(), camera=(), ...
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
Cross-Origin-Resource-Policy: same-origin
```

### 6.3 Session Security

- **Encryption:** AES-256-GCM via Node.js crypto
- **Cookie:** HttpOnly, Secure, SameSite=Strict
- **TTL:** 8-hour absolute, 30-minute sliding window
- **Concurrent session:** X-Session-Nonce tracking
- **Single-session:** X-Invalidate-Previous-Sessions header

---

## 7. API Contracts

### 7.1 Auth Endpoints

| Endpoint | Method | Description |
|----------|-------|-------------|
| `/api/v1/auth/token` | POST | Issue JWT (credential login) |
| `/api/v1/auth/mfa/verify` | POST | Verify TOTP challenge |
| `/api/v1/auth/refresh` | POST | Rotate JWT tokens |
| `/api/v1/auth/logout` | POST | Revoke JWT |
| `/api/v1/context/bootstrap` | GET | Fetch operational context |

### 7.2 BFF Endpoints

| Endpoint | Method | Description |
|----------|-------|-------------|
| `/api/cbs/auth/login` | POST | BFF login wrapper |
| `/api/cbs/auth/mfa/verify` | POST | BFF MFA wrapper |
| `/api/cbs/auth/logout` | POST | BFF logout |
| `/api/cbs/auth/me` | GET | Current user |
| `/api/cbs/session/heartbeat` | GET | Session TTL sync |
| `/api/cbs/session/extend` | POST | Extend session |
| `/api/cbs/session/switch-branch` | POST | Switch branch context |

---

## 8. RBI Compliance Alignment

| Requirement | Implementation |
|-------------|----------------|
| **Cyber Security Framework 2024 §6.2** | Rate limiting at BFF |
| **IT Governance 2023 §8.3** | Single-session enforcement |
| **IT Governance 2023 §8.4** | No PII in URLs |
| **ASVS V3** | CSRF double-submit |
| **OWASP** | Security headers, input validation |

---

## 9. Testing Strategy

| Test Type | Tool | Coverage Target |
|----------|------|----------------|
| Unit Tests | Vitest | Components, hooks, utils |
| Integration | Vitest | API handlers, session |
| E2E | Playwright | Critical journeys |
| Security | Manual + Automated | Auth flows, CSRF |

### Critical E2E Journeys

- `e2e/login.spec.ts` - Login validation + errors
- `e2e/dashboard.spec.ts` - Post-login flow
- `e2e/mfa-step-up.spec.ts` - MFA flow
- `e2e/session-idle.spec.ts` - Session expiry
- `e2e/logout-redirect.spec.ts` - Logout flow

---

## 10. Deployment

### Docker

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - CBS_BACKEND_URL=http://spring:8080
      - CBS_API_PREFIX=/api/v1
      - CBS_SESSION_SECRET=...
      - NODE_ENV=production

  spring:
    image: finvanta-cbs:latest
    ports:
      - "8080:8080"
    environment:
      - SPRING_PROFILES_ACTIVE=production
```

---

## 11. Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `CBS_BACKEND_URL` | Spring base URL | `http://localhost:8080` |
| `CBS_API_PREFIX` | API version path | `/api/v1` |
| `CBS_SESSION_SECRET` | Session encryption key | (32+ char entropy) |
| `CBS_CSRF_SECRET` | CSRF signing key | (32+ char entropy) |
| `CBS_SESSION_TTL_SECONDS` | Absolute session TTL | `28800` (8h) |
| `CBS_SESSION_IDLE_SECONDS` | Idle extension | `1800` (30min) |
| `CBS_DEFAULT_TENANT` | Default tenant | `DEFAULT` |
| `CBS_ALLOWED_HOSTS` | Host allow-list | (production required) |

---

## 12. Monitoring & Observability

### Correlations

- `X-Correlation-Id` seeded on every request
- Propagated end-to-end (BFF → Spring → DB)

### Logging Standards

```
[LEVEL] [TIMESTAMP] [COMPONENT] [message] [key=value...] [errordetails]
```

### Health Endpoints

- `/api/cbs/health` - BFF health check
- Spring Boot Actuator - Backend health

---

## 13. Error Handling

| HTTP Code | Meaning | BFF Response |
|----------|---------|--------------|
| 200 | Success | `{success: true, data: ...}` |
| 400 | Validation | `{success: false, errorCode: ...}` |
| 401 | Auth failed | `{success: false, errorCode: ...}` |
| 403 | CSRF rejected | `{success: false, errorCode: ...}` |
| 428 | MFA required | `{success: false, errorCode: ...}` |
| 429 | Rate limited | `{success: false, errorCode: ...}` |
| 503 | Unavailable | `{success: false, errorCode: ...}` |

---

## 14. Appendix: File Statistics

| Category | Count |
|----------|-------|
| TypeScript source files | 91 |
| React component files | 62 |
| E2E test files | 5 |
| API contract documents | 6 |

---

*Document Classification: Internal - Tier-1 CBS*  
*Last Updated: 2026-04-30*