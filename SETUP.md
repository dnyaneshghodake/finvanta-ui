# FINVANTA CBS UI -- Local Setup

This is the React + Next.js (App Router) front-end for FINVANTA CBS.
It communicates with the Spring Boot backend exclusively through the
**Backend-for-Frontend (BFF)** layer at `/api/cbs/**` -- the browser
never sees the Spring JWT.

## Prerequisites

- Node.js **20 LTS** (tested on 20.12+)
- npm 10 (or pnpm 9) -- this repo ships `package-lock.json`
- Spring Boot backend running on `http://localhost:8080`
  - Repo: [`dnyaneshghodake/finvanta`](https://github.com/dnyaneshghodake/finvanta)
  - Branch: `feature/ui-migration-react-nextjs`
  - Start with: `./mvnw spring-boot:run -Dspring-boot.run.profiles=dev`
    (H2 in-memory, seeded with dev users -- see below).

## Dev users (H2 profile)

All use password `finvanta123` (delegating encoder `{noop}`).
MFA is disabled on the seeded users.

| Username | Role | Branch |
|---|---|---|
| `maker1` | MAKER | 1 |
| `maker2` | MAKER | 2 |
| `checker1` | CHECKER | 1 |
| `checker2` | CHECKER | 1 |
| `admin` | ADMIN | 1 |
| `auditor1` | AUDITOR | 1 |

## Environment

Copy `.env.example` (if present) to `.env.local` or set these before
`npm run dev`:

```bash
CBS_BACKEND_URL=http://localhost:8080
CBS_SESSION_SECRET=<>=32 chars, high-entropy>
CBS_CSRF_SECRET=<>=32 chars, high-entropy>
CBS_SESSION_COOKIE=fv_sid
CBS_CSRF_COOKIE=fv_csrf
CBS_MFA_COOKIE=fv_mfa
CBS_SESSION_TTL_SECONDS=28800
CBS_MFA_TTL_SECONDS=300
CBS_DEFAULT_TENANT=DEFAULT
NEXT_PUBLIC_API_URL=/api/cbs
```

> **Never** commit real secrets.  Generate with
> `openssl rand -base64 48 | tr -d '=/+' | head -c 48`.

## Install + run

```bash
npm install
npm run dev           # http://localhost:3000
```

Open `http://localhost:3000/login` and sign in with `maker1` /
`finvanta123`.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server with HMR. |
| `npm run build` | Production build. |
| `npm run start` | Run the production build. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm audit --omit=dev` | Must show 0 advisories >= moderate before merge. |

## Architecture overview

```
+--------------+     fv_sid / fv_csrf / fv_mfa cookies     +----------------+
|   Browser    | <---------------------------------------> |  Next.js BFF   |
| (React/Next) |     JSON + X-CSRF-Token                    |  /api/cbs/**  |
+--------------+                                            +----------------+
                                                                    |
                                                                    |  Bearer JWT
                                                                    |  X-Correlation-Id
                                                                    |  X-Tenant-Id
                                                                    |  X-Branch-Code
                                                                    |  X-Idempotency-Key
                                                                    v
                                                            +----------------+
                                                            |  Spring CBS    |
                                                            |  /api/v1/**    |
                                                            +----------------+
```

See `docs/API_ENDPOINT_CATALOGUE.md` for the full endpoint map.

## Legacy bridge

Any JSP screen not yet migrated is reachable at
`/legacy/<path>` -- the BFF reverse-proxies the original Spring MVC
endpoint (e.g. `/legacy/admin/products` -> `/admin/products`) so the
session and CSRF cookies stay on the same origin.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| 401 immediately after login | `CBS_SESSION_SECRET` differs between restarts; regenerate. |
| 403 on all POSTs | Missing `X-CSRF-Token` -- the browser must use the `apiClient` which reads `fv_csrf`. |
| 428 but no MFA page | `fv_mfa` cookie blocked -- check `SameSite=Lax` + `secure` flags. |
| 409 `VERSION_CONFLICT` | Stale `@Version`; refresh record and retry. |
| 502 at `/api/cbs/**` | Spring backend not reachable at `CBS_BACKEND_URL`. |
