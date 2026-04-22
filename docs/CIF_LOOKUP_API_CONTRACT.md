# Finvanta CBS — CIF Lookup API Contract

> **Version:** 1.0 · **Endpoint:** `GET /api/v1/customers/{id}` · **Roles:** MAKER, CHECKER, ADMIN
> **Frontend Component:** `src/components/cbs/CifLookup.tsx` · **Type:** `CifCustomer`
> **Used By:** 12+ screens (Account Opening, Transfers, FD, Loans, KYC, Freeze, Statements, etc.)

---

## 1. Overview

The `CifLookup` component is a shared reusable widget used across the entire CBS application. It calls `GET /customers/{id}` and expects a single flat response with 30 fields covering identity, KYC, contact, address, occupation, risk, and compliance.

---

## 2. Endpoint

```
GET /api/v1/customers/{id}
```

| Parameter | Type | Location | Notes |
|-----------|------|----------|-------|
| `id` | `Long` or `String` | Path | CIF ID (numeric) or customer number |

**BFF Allowlist:** Already allowed at `src/lib/server/endpointPolicy.ts:72`.

---

## 3. Response — `CifLookupResponse`

> Per CIF API Contract v2.0 §5: `GET /customers/{id}` returns `CifLookupResponse`,
> an optimized DTO for the frontend `CifLookup.tsx` widget. Field names match
> the `CifCustomer` TypeScript type. Gender mapped: `M`→`MALE`, `F`→`FEMALE`,
> `T`→`OTHER`. `kycStatus` computed: `VERIFIED`/`PENDING`/`EXPIRED`.
> `status` computed: `ACTIVE`/`INACTIVE`. Addresses as nested objects.

### Envelope

```json
{
  "status": "SUCCESS",
  "data": { ... },
  "errorCode": null,
  "message": "...",
  "error": null,
  "meta": { "apiVersion": "v1", "correlationId": "...", "timestamp": "..." }
}
```

### Identity (8 fields)

| # | Field | Java Type | Required | Notes |
|---|-------|-----------|----------|-------|
| 1 | `id` | `Long` | **Yes** | PK — used as `customerId` in account opening |
| 2 | `customerNumber` | `String` | **Yes** | Human-readable CIF (e.g. `CIF-BR001-000042`) |
| 3 | `firstName` | `String` | **Yes** | |
| 4 | `lastName` | `String` | **Yes** | |
| 5 | `middleName` | `String` | No | CKYC identity matching (§3.1 field #3) |
| 6 | `fullName` | `String` | No | Computed convenience field |
| 7 | `customerType` | `String` | No | `INDIVIDUAL`, `JOINT`, `HUF`, `PARTNERSHIP`, `COMPANY`, `TRUST`, `NRI`, `MINOR`, `GOVERNMENT` |
| 8 | `status` | `String` | **Yes** | `ACTIVE`, `INACTIVE`, `DECEASED`, `BLACKLISTED` |

### KYC & Compliance (7 fields)

| # | Field | Java Type | Required | Masking | Notes |
|---|-------|-----------|----------|---------|-------|
| 9 | `kycStatus` | `String` | **Yes** | — | `VERIFIED`, `PENDING`, `REJECTED`, `EXPIRED` |
| 10 | `pan` | `String` | No | **Masked**: `XXXXXX234F` (last 4) | Encrypted at rest |
| 11 | `aadhaar` | `String` | No | **Masked**: `XXXXXXXX9012` (last 4) | Encrypted at rest |
| 12 | `ckycNumber` | `String` | No | — | 14-digit CKYC registry number |
| 13 | `kycVerified` | `boolean` | No | — | Set by `verifyKyc()` endpoint |
| 14 | `kycExpiryDate` | `String` | No | — | Computed from verified date + risk period |
| 15 | `rekycDue` | `boolean` | No | — | EOD batch flag. Shown as warning in snapshot |

### Contact (2 fields)

| # | Field | Java Type | Required | Masking | Notes |
|---|-------|-----------|----------|---------|-------|
| 16 | `mobile` | `String` | No | **Masked**: `XXXXXX3210` (last 4) per §4 | 10-digit Indian mobile |
| 17 | `email` | `String` | No | — | |

### Personal (8 fields)

| # | Field | Java Type | Required | Notes |
|---|-------|-----------|----------|-------|
| 18 | `dob` | `String` | No | `YYYY-MM-DD`. CKYC mandatory for INDIVIDUAL |
| 19 | `gender` | `String` | No | `MALE`, `FEMALE`, `OTHER` (mapped from backend `M`/`F`/`T` per NALSA 2014) |
| 20 | `nationality` | `String` | No | `INDIAN`, `NRI`, `PIO`, `OCI`, `FOREIGN` |
| 21 | `residentStatus` | `String` | No | `RESIDENT`, `NRI`, `PIO`, `OCI`, `FOREIGN_NATIONAL` |
| 22 | `fatherOrSpouseName` | `String` | No | **Deprecated** — use `fatherName`/`spouseName` per CERSAI v2.0 §3.4 |
| 23 | `fatherName` | `String` | No | CERSAI v2.0 §3.4: separate father field. CKYC mandatory for INDIVIDUAL |
| 24 | `motherName` | `String` | No | CERSAI v2.0 §3.4: separate mother field. CKYC mandatory for INDIVIDUAL |
| 25 | `spouseName` | `String` | No | CERSAI v2.0 §3.4: if married |
| 26 | `maritalStatus` | `String` | No | `SINGLE`, `MARRIED`, `DIVORCED`, `WIDOWED`, `SEPARATED` |

### Occupation & Financial (3 fields)

| # | Field | Java Type | Required | Enum Values |
|---|-------|-----------|----------|-------------|
| 27 | `occupation` | `String` | No | `SALARIED_PRIVATE`, `SALARIED_GOVT`, `BUSINESS`, `PROFESSIONAL`, `SELF_EMPLOYED`, `RETIRED`, `HOUSEWIFE`, `STUDENT`, `AGRICULTURIST`, `OTHER` |
| 28 | `annualIncomeRange` | `String` | No | `BELOW_1L`, `1L_TO_5L`, `5L_TO_10L`, `10L_TO_25L`, `25L_TO_1CR`, `ABOVE_1CR` |
| 29 | `sourceOfFunds` | `String` | No | `SALARY`, `BUSINESS`, `INVESTMENT`, `AGRICULTURE`, `PENSION`, `OTHER` |

### Risk & Compliance (3 fields)

| # | Field | Java Type | Required | Notes |
|---|-------|-----------|----------|-------|
| 30 | `riskCategory` | `String` | No | `LOW`, `MEDIUM`, `HIGH` |
| 31 | `pepFlag` | `Boolean` | No | Wrapper type. `null` = not provided. `true` auto-sets HIGH risk |
| 32 | `fatcaCountry` | `String` | No | ISO 3166 alpha-2. `null` = Indian tax resident |

### Branch (1 field)

| # | Field | Java Type | Required | Notes |
|---|-------|-----------|----------|-------|
| 33 | `branchCode` | `String` | No | Home branch SOL code |

### Permanent Address (nested object)

| # | Field | Java Type | Notes |
|---|-------|-----------|-------|
| 27 | `permanentAddress` | `Object` | Preferred address for auto-population |
| 27a | `.line1` | `String` | → form `addressLine1` |
| 27b | `.line2` | `String` | → form `addressLine2` |
| 27c | `.city` | `String` | → form `city` |
| 27d | `.district` | `String` | Display only |
| 27e | `.state` | `String` | → form `state` |
| 27f | `.pincode` | `String` | → form `pinCode` |
| 27g | `.country` | `String` | Display only |

### Correspondence Address (nested, same structure)

| # | Field | Notes |
|---|-------|-------|
| 28 | `correspondenceAddress` | Same sub-fields as `permanentAddress` |

### Legacy Address Fallback (nested)

| # | Field | Notes |
|---|-------|-------|
| 29 | `address` | Used only if `permanentAddress` is null |
| 29a | `.street` | → form `addressLine1` |
| 29b | `.city` | |
| 29c | `.state` | |
| 29d | `.pincode` | |

---

## 4. Auto-Population Mapping (13+ fields)

| Customer Field | → Form Field | Screens |
|---|---|---|
| `id` | `customerId` | Account Opening, FD, Loan |
| `firstName` + `lastName` | `fullName` | Account Opening |
| `pan` | `panNumber` | Account Opening |
| `aadhaar` | `aadhaarNumber` | Account Opening |
| `mobile` | `mobileNumber` | Account Opening, Transfers |
| `email` | `email` | Account Opening |
| `dob` | `dateOfBirth` | Account Opening |
| `gender` | `gender` | Account Opening |
| `nationality` | `nationality` | Account Opening |
| `fatherOrSpouseName` | `fatherSpouseName` | Account Opening |
| `occupation` | `occupation` | Account Opening |
| `annualIncomeRange` | `annualIncome` | Account Opening |
| `sourceOfFunds` | `sourceOfFunds` | Account Opening |
| `kycStatus` | `kycStatus` (mapped) | Account Opening, KYC |
| `pepFlag` | `pepFlag` | Account Opening |
| `permanentAddress.*` | `addressLine1/2, city, state, pinCode` | Account Opening |

---

## 5. Snapshot Panel Display

| Element | Source | Masking | Color |
|---|---|---|---|
| Name | `firstName` + `lastName` | None | `font-semibold` |
| KYC badge | `kycStatus` | None | VERIFIED=green, EXPIRED=red, else=gold |
| Risk badge | `riskCategory` | None | HIGH=red, else=neutral |
| CIF | `customerNumber` | None | Monospace |
| Mobile | `mobile` | `maskMobile()` if raw | Monospace |
| Email | `email` | None | — |
| PAN | `pan` | `maskPan()` if raw | Monospace |
| Aadhaar | `aadhaar` | `maskAadhaar()` if raw | Monospace |
| Branch | `branchCode` | None | Monospace |
| PEP | `pepFlag` | None | `⚠ PEP` in crimson if true |
| Re-KYC Due | `rekycDue` | None | `⚠ Re-KYC Due` in gold if true |

---

## 6. Error Handling

| Scenario | HTTP | Frontend Message |
|---|---|---|
| Not found | 404 | "Customer not found" |
| Not ACTIVE | 200 | "Customer status is {X} — must be ACTIVE" |
| Network fail | — | "Failed to fetch customer" |
| Empty input | — | "Enter a CIF ID" |
| Unauthorized | 401 | BFF redirects to login |
| Cross-branch | 403 | Backend error message |

---

## 7. Security

| Requirement | Implementation |
|---|---|
| PAN never raw | Backend masks: `XXXXXX234F` (last 4). Frontend masks via `maskPan()`. Per §4 `PiiMaskingUtil.maskPan()` |
| Aadhaar never raw | Backend masks: `XXXXXXXX9012` (last 4). Frontend masks via `maskAadhaar()`. Per §4 `PiiMaskingUtil.maskAadhaar()` |
| Mobile never raw | Backend masks: `XXXXXX3210` (last 4). Frontend masks via `maskMobile()`. Per §4 `PiiMaskingUtil.maskMobile()` |
| Encrypted at rest | `@Convert(converter = PiiEncryptionConverter.class)` AES-256-GCM |
| PII hash for dedup | SHA-256 hash stored in `pan_hash` / `aadhaar_hash` columns |
| PII immutability | PAN/Aadhaar immutable after CIF creation (triple enforcement: API + service + `@PreUpdate`) |
| Branch-scoped | `BranchAccessValidator.validateAccess()` on every operation |
| Tenant isolation | Hibernate `@Filter` on `tenant_id` + `TenantContext` |
| Audit logged | `AuditService.logEvent()` on every lookup with operator, timestamp, correlation ID |

---

## 8. Performance

| Metric | Target |
|---|---|
| Response time | < 200ms (p95) |
| Payload size | < 5 KB |
| Caching | None (data may change between lookups) |

---

## 9. Backend Checklist

- [ ] Return all 33+ fields listed in §3 (identity, KYC, contact, personal, occupation, risk, branch, addresses)
- [ ] PAN masked in response (`XXXXXX234F` — last 4 only) per §4 `PiiMaskingUtil.maskPan()`
- [ ] Aadhaar masked in response (`XXXXXXXX9012` — last 4 only) per §4 `PiiMaskingUtil.maskAadhaar()`
- [ ] Mobile masked in response (`XXXXXX3210` — last 4 only) per §4 `PiiMaskingUtil.maskMobile()`
- [ ] OVD document numbers NOT returned (only `photoIdType`, `addressProofType`)
- [ ] `permanentAddress` as nested object (not flattened)
- [ ] `correspondenceAddress` as nested object
- [ ] Legacy `address` for backward compat with pre-v2.0 backends
- [ ] `riskCategory` populated (`LOW`/`MEDIUM`/`HIGH`)
- [ ] `pepFlag` wrapper Boolean populated (`null` = not provided)
- [ ] `fatcaCountry` ISO 3166 alpha-2 code populated
- [ ] `occupation` uses `occupationCode` values per §3.4 (`SALARIED_PRIVATE`, `SALARIED_GOVT`, etc.)
- [ ] `annualIncomeRange` uses `annualIncomeBand` values per §3.4 (`BELOW_1L`, `1L_TO_5L`, etc.)
- [ ] `sourceOfFunds` populated per PMLA
- [ ] CERSAI v2.0 separate fields: `fatherName`, `motherName`, `spouseName` (plus legacy `fatherOrSpouseName`)
- [ ] `middleName` populated for CKYC identity matching
- [ ] `kycVerified`, `kycExpiryDate`, `rekycDue` system fields populated
- [ ] Gender mapped: `M`→`MALE`, `F`→`FEMALE`, `T`→`OTHER` in CifLookupResponse
- [ ] `kycStatus` computed: `VERIFIED`/`PENDING`/`EXPIRED`
- [ ] `status` computed: `ACTIVE`/`INACTIVE`
- [ ] `branchCode` populated from Branch entity
- [ ] Branch-scoped access enforced via `BranchAccessValidator`
- [ ] Tenant isolation via Hibernate `@Filter`
- [ ] Audit log on every lookup via `AuditService.logEvent()`
- [ ] Response < 200ms (indexed query, no transaction joins)

---

## 10. Example Response

```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1001,
    "customerNumber": "CIF-BR001-000042",
    "firstName": "Rajesh",
    "lastName": "Kumar",
    "fullName": "Rajesh Kumar",
    "customerType": "INDIVIDUAL",
    "status": "ACTIVE",
    "kycStatus": "VERIFIED",
    "branchCode": "BR001",
    "pan": "ABCD***34F",
    "aadhaar": "**** **** 1234",
    "ckycNumber": "12345678901234",
    "mobile": "9876543210",
    "email": "rajesh@example.com",
    "dob": "1990-04-12",
    "gender": "MALE",
    "nationality": "INDIAN",
    "residentStatus": "RESIDENT",
    "fatherOrSpouseName": "Suresh Kumar",
    "maritalStatus": "MARRIED",
    "occupation": "SALARIED",
    "annualIncomeRange": "5L_10L",
    "sourceOfFunds": "SALARY",
    "riskCategory": "LOW",
    "pepFlag": false,
    "fatcaCountry": "IN",
    "permanentAddress": {
      "line1": "42 MG Road",
      "line2": "Andheri East",
      "city": "Mumbai",
      "district": "Mumbai Suburban",
      "state": "Maharashtra",
      "pincode": "400069",
      "country": "IN"
    },
    "correspondenceAddress": null,
    "address": {
      "street": "42 MG Road, Andheri East",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400069"
    }
  },
  "meta": {
    "apiVersion": "v1",
    "correlationId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-04-20T10:30:00"
  }
}
```

---

## 11. Screens Using CifLookup

| Screen | Route | Usage |
|---|---|---|
| Account Opening | `/accounts/new` | Auto-populate 13 fields + risk panel |
| Internal Transfer | `/transfers` | Validate source customer |
| FD Booking | `/deposits/new` | Auto-populate for FD |
| Loan Application | `/loans/apply` | Auto-populate borrower |
| KYC Verification | `/customers/kyc` | Load for verification |
| Account Freeze | `/legacy/deposit/freeze` | Identify holder |
| Account Close | `/legacy/deposit/close` | Identify holder |
| Statement Inquiry | `/legacy/deposit/mini-statement` | Identify customer |
| Beneficiary Mgmt | `/beneficiaries` | Validate beneficiary |
| Workflow Approval | `/workflow` | Show customer context |
| Customer Search | `/customers` | Quick lookup |
| Customer Detail | `/customers/[id]` | Already implemented |
