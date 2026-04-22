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

## 3. Response — `CustomerResponse`

### Envelope

```json
{
  "status": "SUCCESS",
  "data": { ... },
  "meta": { "apiVersion": "v1", "correlationId": "...", "timestamp": "..." }
}
```

### Identity (7 fields)

| # | Field | Java Type | Required | Notes |
|---|-------|-----------|----------|-------|
| 1 | `id` | `Long` | **Yes** | PK — used as `customerId` in account opening |
| 2 | `customerNumber` | `String` | **Yes** | Human-readable CIF (e.g. `CIF-BR001-000042`) |
| 3 | `firstName` | `String` | **Yes** | |
| 4 | `lastName` | `String` | **Yes** | |
| 5 | `fullName` | `String` | No | Computed convenience field |
| 6 | `customerType` | `String` | No | `INDIVIDUAL`, `CORPORATE` |
| 7 | `status` | `String` | **Yes** | `ACTIVE`, `INACTIVE`, `DECEASED`, `BLACKLISTED` |

### KYC & Compliance (4 fields)

| # | Field | Java Type | Required | Masking | Notes |
|---|-------|-----------|----------|---------|-------|
| 8 | `kycStatus` | `String` | **Yes** | — | `VERIFIED`, `PENDING`, `REJECTED`, `EXPIRED` |
| 9 | `pan` | `String` | No | **Masked**: `ABCD***34F` | Encrypted at rest |
| 10 | `aadhaar` | `String` | No | **Masked**: `**** **** 1234` | Encrypted at rest |
| 11 | `ckycNumber` | `String` | No | — | 14-digit CKYC registry number |

### Contact (2 fields)

| # | Field | Java Type | Required | Notes |
|---|-------|-----------|----------|-------|
| 12 | `mobile` | `String` | No | 10-digit Indian mobile |
| 13 | `email` | `String` | No | |

### Personal (6 fields)

| # | Field | Java Type | Required | Notes |
|---|-------|-----------|----------|-------|
| 14 | `dob` | `String` | No | `YYYY-MM-DD` |
| 15 | `gender` | `String` | No | `MALE`, `FEMALE`, `OTHER` |
| 16 | `nationality` | `String` | No | `INDIAN`, `NRI` |
| 17 | `residentStatus` | `String` | No | `RESIDENT`, `NRI`, `PIO` |
| 18 | `fatherOrSpouseName` | `String` | No | |
| 19 | `maritalStatus` | `String` | No | `SINGLE`, `MARRIED`, `WIDOWED`, `DIVORCED` |

### Occupation & Financial (3 fields)

| # | Field | Java Type | Required | Enum Values |
|---|-------|-----------|----------|-------------|
| 20 | `occupation` | `String` | No | `SALARIED`, `SELF_EMPLOYED`, `BUSINESS`, `PROFESSIONAL`, `RETIRED`, `STUDENT`, `HOMEMAKER` |
| 21 | `annualIncomeRange` | `String` | No | `BELOW_1L`, `1L_5L`, `5L_10L`, `10L_25L`, `25L_50L`, `ABOVE_50L` |
| 22 | `sourceOfFunds` | `String` | No | `SALARY`, `BUSINESS`, `INVESTMENT`, `AGRICULTURE`, `PENSION`, `OTHER` |

### Risk & Compliance (3 fields)

| # | Field | Java Type | Required | Notes |
|---|-------|-----------|----------|-------|
| 23 | `riskCategory` | `String` | No | `LOW`, `MEDIUM`, `HIGH` |
| 24 | `pepFlag` | `Boolean` | No | PEP indicator |
| 25 | `fatcaCountry` | `String` | No | ISO country code for FATCA |

### Branch (1 field)

| # | Field | Java Type | Required | Notes |
|---|-------|-----------|----------|-------|
| 26 | `branchCode` | `String` | No | Home branch SOL code |

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
| KYC badge | `kycStatus` | None | VERIFIED=green, else=gold |
| Risk badge | `riskCategory` | None | HIGH=red, else=neutral |
| CIF | `customerNumber` | None | Monospace |
| Mobile | `mobile` | None | Monospace |
| Email | `email` | None | — |
| PAN | `pan` | `maskPan()` | Monospace |
| Aadhaar | `aadhaar` | `maskAadhaar()` | Monospace |
| Branch | `branchCode` | None | Monospace |
| PEP | `pepFlag` | None | `⚠ PEP` in crimson if true |

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
| PAN never raw | Backend masks: `ABCD***34F`. Frontend masks via `maskPan()` |
| Aadhaar never raw | Backend masks: `**** **** 1234`. Frontend masks via `maskAadhaar()` |
| Encrypted at rest | `@Convert(converter = EncryptedStringConverter.class)` |
| Branch-scoped | Non-HO users restricted to own branch customers |
| Audit logged | Every lookup logged with operator, timestamp, correlation ID |

---

## 8. Performance

| Metric | Target |
|---|---|
| Response time | < 200ms (p95) |
| Payload size | < 5 KB |
| Caching | None (data may change between lookups) |

---

## 9. Backend Checklist

- [ ] Return all 30 fields listed in §3
- [ ] PAN masked in response (`ABCD***34F`)
- [ ] Aadhaar masked in response (`**** **** 1234`)
- [ ] `permanentAddress` as nested object (not flattened)
- [ ] `correspondenceAddress` as nested object
- [ ] Legacy `address` for backward compat
- [ ] `riskCategory` populated (`LOW`/`MEDIUM`/`HIGH`)
- [ ] `pepFlag` boolean populated
- [ ] `fatcaCountry` ISO code populated
- [ ] `occupation`, `annualIncomeRange`, `sourceOfFunds` populated
- [ ] `fatherOrSpouseName` populated
- [ ] `branchCode` populated
- [ ] Branch-scoped access enforced
- [ ] Audit log on every lookup
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
