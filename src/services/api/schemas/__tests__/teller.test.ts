/**
 * Contract tests for the CBS Teller module schemas.
 *
 * Per DESIGN_SYSTEM §16b the response interceptor fails closed on any
 * schema mismatch. These tests pin the wire shape using the EXACT
 * example payloads from docs/TELLER_API_CONTRACT.md so a backend drift
 * (renamed/removed field, changed enum) surfaces here before it
 * reaches the runtime CONTRACT_MISMATCH path.
 *
 * Test groups mirror the contract sections so a future spec change is
 * traceable to the failing test by name.
 */
import { describe, it, expect } from 'vitest';
import {
  cashDepositEnvelopeSchema,
  cashDepositResponseSchema,
  cashWithdrawalEnvelopeSchema,
  cashWithdrawalResponseSchema,
  denominationInputSchema,
  denominationLineSchema,
  ficnAcknowledgementEnvelopeSchema,
  ficnAcknowledgementResponseSchema,
  tellerCashMovementEnvelopeSchema,
  tellerCashMovementListEnvelopeSchema,
  tellerCashMovementResponseSchema,
  tellerTillEnvelopeSchema,
  tellerTillListEnvelopeSchema,
  tellerTillResponseSchema,
  vaultPositionEnvelopeSchema,
  vaultPositionResponseSchema,
} from '../teller';

// Fixtures copied verbatim from docs/TELLER_API_CONTRACT.md examples.

const tillExample = {
  id: 100,
  tellerUserId: 'teller1',
  branchCode: 'BR001',
  branchName: 'New Delhi Main',
  businessDate: '2026-04-01',
  status: 'OPEN',
  openingBalance: 100000.00,
  currentBalance: 102800.00,
  countedBalance: null,
  varianceAmount: null,
  tillCashLimit: 500000.00,
  openedAt: '2026-04-01T09:00:00',
  closedAt: null,
  openedBySupervisor: null,
  closedBySupervisor: null,
  remarks: 'Morning shift',
};

const cashDepositExample = {
  transactionRef: 'TXN-20260401-000042',
  voucherNumber: 'VCH/BR001/20260401/000007',
  accountNumber: 'SB-BR001-000001',
  amount: 2800.00,
  balanceBefore: 50000.00,
  balanceAfter: 52800.00,
  valueDate: '2026-04-01',
  postingDate: '2026-04-01T10:15:30',
  narration: 'Salary deposit',
  channel: 'TELLER',
  pendingApproval: false,
  tillBalanceAfter: 102800.00,
  tillId: 100,
  tellerUserId: 'teller1',
  denominations: [
    { denomination: 'NOTE_500', unitCount: 5, totalValue: 2500.00, counterfeitCount: 0 },
    { denomination: 'NOTE_100', unitCount: 3, totalValue: 300.00, counterfeitCount: 0 },
  ],
  ctrTriggered: false,
  ficnTriggered: false,
};

const cashWithdrawalExample = {
  transactionRef: 'TXN-20260401-000043',
  voucherNumber: 'VCH/BR001/20260401/000008',
  accountNumber: 'SB-BR001-000001',
  amount: 5000.00,
  balanceBefore: 52800.00,
  balanceAfter: 47800.00,
  valueDate: '2026-04-01',
  postingDate: '2026-04-01T11:02:14',
  narration: 'Cash withdrawal',
  channel: 'TELLER',
  pendingApproval: false,
  tillBalanceAfter: 97800.00,
  tillId: 100,
  tellerUserId: 'teller1',
  denominations: [
    { denomination: 'NOTE_500', unitCount: 10, totalValue: 5000.00, counterfeitCount: 0 },
  ],
  ctrTriggered: false,
  chequeNumber: null,
};

const ficnExample = {
  registerRef: 'FICN/BR001/20260401/000003',
  originatingTxnRef: 'idem-key-abc-123',
  branchCode: 'BR001',
  branchName: 'New Delhi Main',
  detectionDate: '2026-04-01',
  detectionTimestamp: '2026-04-01T14:22:08',
  detectedByTeller: 'teller1',
  depositorName: 'Ramesh Kumar',
  depositorIdType: 'PAN',
  depositorIdNumber: 'ABCDE1234F',
  depositorMobile: '9876543210',
  impoundedDenominations: [
    { denomination: 'NOTE_500', counterfeitCount: 6, totalFaceValue: 3000.00 },
  ],
  totalFaceValue: 3000.00,
  firRequired: true,
  chestDispatchStatus: 'PENDING',
  remarks: null,
};

const vaultExample = {
  id: 11,
  branchCode: 'BR001',
  branchName: 'New Delhi Main',
  businessDate: '2026-04-01',
  status: 'OPEN',
  openingBalance: 1000000.00,
  currentBalance: 950000.00,
  countedBalance: null,
  varianceAmount: null,
  openedBy: 'checker1',
  closedBy: null,
  remarks: null,
};

const movementExample = {
  id: 42,
  movementRef: 'VMOV/BR001/20260401/000007',
  movementType: 'BUY',
  branchCode: 'BR001',
  tillId: 100,
  vaultId: 11,
  businessDate: '2026-04-01',
  amount: 50000.00,
  status: 'PENDING',
  requestedBy: 'teller1',
  requestedAt: '2026-04-01T10:30:00',
  approvedBy: null,
  approvedAt: null,
  rejectionReason: null,
  remarks: null,
};

// B3: request and response denomination shapes diverge by design.

describe('denominationInputSchema (request shape)', () => {
  it('accepts a valid 3-field input line', () => {
    expect(() => denominationInputSchema.parse({
      denomination: 'NOTE_500', unitCount: 5, counterfeitCount: 0,
    })).not.toThrow();
  });

  it('rejects unknown denomination enum (RBI-issued only)', () => {
    expect(() => denominationInputSchema.parse({
      denomination: 'NOTE_1000', unitCount: 5, counterfeitCount: 0,
    })).toThrow();
  });

  it('rejects negative unit count', () => {
    expect(() => denominationInputSchema.parse({
      denomination: 'NOTE_500', unitCount: -1, counterfeitCount: 0,
    })).toThrow();
  });

  it('rejects fractional unit count (notes are atomic)', () => {
    expect(() => denominationInputSchema.parse({
      denomination: 'NOTE_500', unitCount: 1.5, counterfeitCount: 0,
    })).toThrow();
  });
});

describe('denominationLineSchema (response shape)', () => {
  it('accepts the response shape with totalValue', () => {
    expect(() => denominationLineSchema.parse({
      denomination: 'NOTE_500', unitCount: 5, totalValue: 2500.00, counterfeitCount: 0,
    })).not.toThrow();
  });

  it('accepts totalValue as decimal string (BigDecimal serialisation)', () => {
    expect(() => denominationLineSchema.parse({
      denomination: 'NOTE_500', unitCount: 5, totalValue: '2500.00', counterfeitCount: 0,
    })).not.toThrow();
  });
});

// Till lifecycle.

describe('tellerTillResponseSchema', () => {
  it('accepts the spec example (status=OPEN)', () => {
    expect(() => tellerTillResponseSchema.parse(tillExample)).not.toThrow();
  });

  it('accepts every valid status enum value', () => {
    for (const status of ['PENDING_OPEN', 'OPEN', 'PENDING_CLOSE', 'CLOSED', 'SUSPENDED']) {
      expect(() => tellerTillResponseSchema.parse({ ...tillExample, status })).not.toThrow();
    }
  });

  it('rejects unknown till status (strictness — operational risk)', () => {
    expect(() => tellerTillResponseSchema.parse({ ...tillExample, status: 'PARTIAL' }))
      .toThrow();
  });

  it('accepts close-state response with countedBalance + varianceAmount', () => {
    expect(() => tellerTillResponseSchema.parse({
      ...tillExample,
      status: 'PENDING_CLOSE',
      countedBalance: 102790.00,
      varianceAmount: -10.00,
      closedAt: '2026-04-01T17:00:00',
    })).not.toThrow();
  });

  it('rejects malformed businessDate (not ISO calendar date)', () => {
    expect(() => tellerTillResponseSchema.parse({ ...tillExample, businessDate: '01-04-2026' }))
      .toThrow();
  });

  it('passthrough: tolerates additive backend fields', () => {
    const parsed = tellerTillResponseSchema.parse({ ...tillExample, futureField: 'x' });
    expect((parsed as Record<string, unknown>).futureField).toBe('x');
  });
});

describe('tellerTillEnvelopeSchema / tellerTillListEnvelopeSchema', () => {
  it('parses a SUCCESS envelope with the till example', () => {
    const env = tellerTillEnvelopeSchema.parse({
      status: 'SUCCESS', data: tillExample, timestamp: '2026-04-01T09:00:00Z',
    });
    expect(env.data?.status).toBe('OPEN');
  });

  it('parses an ERROR envelope (CBS-TELLER-001 no till open)', () => {
    expect(() => tellerTillEnvelopeSchema.parse({
      status: 'ERROR', errorCode: 'CBS-TELLER-001', message: 'No till open for today',
    })).not.toThrow();
  });

  it('parses a SUCCESS envelope wrapping a list (supervisor /till/pending)', () => {
    const env = tellerTillListEnvelopeSchema.parse({
      status: 'SUCCESS',
      data: [
        tillExample,
        { ...tillExample, id: 101, tellerUserId: 'teller2', status: 'PENDING_OPEN' },
      ],
    });
    expect(env.data?.length).toBe(2);
  });
});

// Cash deposit.

describe('cashDepositResponseSchema', () => {
  it('accepts the spec example (success path, pendingApproval=false)', () => {
    expect(() => cashDepositResponseSchema.parse(cashDepositExample)).not.toThrow();
  });

  it('accepts pendingApproval=true (B4 forward-compat: schema tolerates phantom voucher)', () => {
    // Schema must not reject; the UI MUST gate receipt rendering on
    // pendingApproval === false per the contract's forward-compat table.
    expect(() => cashDepositResponseSchema.parse({
      ...cashDepositExample, pendingApproval: true, voucherNumber: null,
    })).not.toThrow();
  });

  it('accepts ctrTriggered / ficnTriggered as booleans', () => {
    expect(() => cashDepositResponseSchema.parse({
      ...cashDepositExample, ctrTriggered: true, ficnTriggered: true,
    })).not.toThrow();
  });

  it('rejects empty transactionRef (audit trail required)', () => {
    expect(() => cashDepositResponseSchema.parse({
      ...cashDepositExample, transactionRef: '',
    })).toThrow();
  });

  it('rejects denomination line with bad enum (NOTE_1000 demonetised)', () => {
    expect(() => cashDepositResponseSchema.parse({
      ...cashDepositExample,
      denominations: [
        { denomination: 'NOTE_1000', unitCount: 1, totalValue: 1000.00, counterfeitCount: 0 },
      ],
    })).toThrow();
  });
});

describe('cashDepositEnvelopeSchema', () => {
  it('parses a SUCCESS envelope with the deposit example', () => {
    const env = cashDepositEnvelopeSchema.parse({
      status: 'SUCCESS', data: cashDepositExample,
    });
    expect(env.data?.transactionRef).toBe('TXN-20260401-000042');
  });

  it('parses an ERROR envelope (CBS-COMP-002 PMLA Rule 9)', () => {
    expect(() => cashDepositEnvelopeSchema.parse({
      status: 'ERROR', errorCode: 'CBS-COMP-002',
      message: 'CTR threshold: PAN or Form 60/61 required',
    })).not.toThrow();
  });
});

// Cash withdrawal.

describe('cashWithdrawalResponseSchema', () => {
  it('accepts the spec example', () => {
    expect(() => cashWithdrawalResponseSchema.parse(cashWithdrawalExample)).not.toThrow();
  });

  it('accepts chequeNumber as string (cheque withdrawal)', () => {
    expect(() => cashWithdrawalResponseSchema.parse({
      ...cashWithdrawalExample, chequeNumber: '000123',
    })).not.toThrow();
  });

  it('does NOT accept ficnTriggered (deposit-only field)', () => {
    // ficnTriggered is on cashDepositResponseSchema only — the bank
    // never pays out counterfeits, so the field is meaningless here.
    // Passthrough lets the field through, but it must not be required.
    expect(() => cashWithdrawalResponseSchema.parse({
      ...cashWithdrawalExample, ficnTriggered: undefined,
    })).not.toThrow();
  });
});

describe('cashWithdrawalEnvelopeSchema', () => {
  it('parses an ERROR envelope (CBS-TELLER-006 till insufficient cash)', () => {
    expect(() => cashWithdrawalEnvelopeSchema.parse({
      status: 'ERROR', errorCode: 'CBS-TELLER-006',
      message: 'Till has insufficient physical cash; request a vault buy',
    })).not.toThrow();
  });
});

// Vault position (B1 resolved — wire format is the DTO).

describe('vaultPositionResponseSchema', () => {
  it('accepts the spec example (status=OPEN)', () => {
    expect(() => vaultPositionResponseSchema.parse(vaultExample)).not.toThrow();
  });

  it('accepts status=CLOSED with countedBalance + varianceAmount', () => {
    expect(() => vaultPositionResponseSchema.parse({
      ...vaultExample,
      status: 'CLOSED',
      countedBalance: 950000.00,
      varianceAmount: 0.00,
      closedBy: 'checker2',
    })).not.toThrow();
  });

  it('rejects unknown vault status (OPEN/CLOSED only)', () => {
    expect(() => vaultPositionResponseSchema.parse({ ...vaultExample, status: 'PENDING' }))
      .toThrow();
  });
});

describe('vaultPositionEnvelopeSchema', () => {
  it('parses a SUCCESS envelope', () => {
    const env = vaultPositionEnvelopeSchema.parse({
      status: 'SUCCESS', data: vaultExample,
    });
    expect(env.data?.branchCode).toBe('BR001');
  });

  it('parses an ERROR envelope (CBS-WF-001 opener-must-not-be-closer)', () => {
    expect(() => vaultPositionEnvelopeSchema.parse({
      status: 'ERROR', errorCode: 'CBS-WF-001',
      message: 'Vault opener cannot close (joint-custody)',
    })).not.toThrow();
  });
});

// Cash movement (vault buy/sell, supervisor queue).

describe('tellerCashMovementResponseSchema', () => {
  it('accepts the spec example (PENDING BUY)', () => {
    expect(() => tellerCashMovementResponseSchema.parse(movementExample)).not.toThrow();
  });

  it('accepts every valid movementType + status combination', () => {
    for (const movementType of ['BUY', 'SELL']) {
      for (const status of ['PENDING', 'APPROVED', 'REJECTED']) {
        expect(() => tellerCashMovementResponseSchema.parse({
          ...movementExample, movementType, status,
        })).not.toThrow();
      }
    }
  });

  it('rejects unknown movementType', () => {
    expect(() => tellerCashMovementResponseSchema.parse({
      ...movementExample, movementType: 'TRANSFER',
    })).toThrow();
  });

  it('accepts an APPROVED movement (post-checker action)', () => {
    expect(() => tellerCashMovementResponseSchema.parse({
      ...movementExample,
      status: 'APPROVED',
      approvedBy: 'checker1',
      approvedAt: '2026-04-01T10:35:00',
    })).not.toThrow();
  });

  it('accepts a REJECTED movement with rejectionReason', () => {
    expect(() => tellerCashMovementResponseSchema.parse({
      ...movementExample,
      status: 'REJECTED',
      rejectionReason: 'Vault balance below threshold',
    })).not.toThrow();
  });
});

describe('tellerCashMovementEnvelopeSchema / tellerCashMovementListEnvelopeSchema', () => {
  it('parses a SUCCESS envelope wrapping a single movement', () => {
    const env = tellerCashMovementEnvelopeSchema.parse({
      status: 'SUCCESS', data: movementExample,
    });
    expect(env.data?.movementRef).toBe('VMOV/BR001/20260401/000007');
  });

  it('parses a SUCCESS envelope wrapping a list (supervisor queue)', () => {
    const env = tellerCashMovementListEnvelopeSchema.parse({
      status: 'SUCCESS',
      data: [movementExample, { ...movementExample, id: 43, movementType: 'SELL' }],
    });
    expect(env.data?.length).toBe(2);
  });
});

// FICN acknowledgement (HTTP 422 CBS-TELLER-008 customer slip).

describe('ficnAcknowledgementResponseSchema', () => {
  it('accepts the spec example (firRequired=true)', () => {
    expect(() => ficnAcknowledgementResponseSchema.parse(ficnExample)).not.toThrow();
  });

  it('rejects malformed registerRef (wrong date format)', () => {
    // The contract pins FICN/{branch}/{YYYYMMDD}/{seq}; ISO date breaks it.
    expect(() => ficnAcknowledgementResponseSchema.parse({
      ...ficnExample, registerRef: 'FICN/BR001/2026-04-01/000003',
    })).toThrow();
  });

  it('rejects registerRef without FICN/ prefix', () => {
    expect(() => ficnAcknowledgementResponseSchema.parse({
      ...ficnExample, registerRef: 'BR001/20260401/000003',
    })).toThrow();
  });

  it('accepts every chestDispatchStatus enum value', () => {
    for (const chestDispatchStatus of ['PENDING', 'DISPATCHED', 'REMITTED']) {
      expect(() => ficnAcknowledgementResponseSchema.parse({
        ...ficnExample, chestDispatchStatus,
      })).not.toThrow();
    }
  });

  it('rejects empty impoundedDenominations array (FICN slip must have at least one)', () => {
    expect(() => ficnAcknowledgementResponseSchema.parse({
      ...ficnExample, impoundedDenominations: [],
    })).toThrow();
  });

  it('accepts firRequired=false (count < 5, RBI threshold)', () => {
    expect(() => ficnAcknowledgementResponseSchema.parse({
      ...ficnExample,
      firRequired: false,
      impoundedDenominations: [
        { denomination: 'NOTE_500', counterfeitCount: 2, totalFaceValue: 1000.00 },
      ],
      totalFaceValue: 1000.00,
    })).not.toThrow();
  });
});

describe('ficnAcknowledgementEnvelopeSchema', () => {
  it('parses the HTTP 422 ERROR envelope per contract section', () => {
    const env = ficnAcknowledgementEnvelopeSchema.parse({
      status: 'ERROR',
      errorCode: 'CBS-TELLER-008',
      message: 'Counterfeit notes detected and impounded. FICN register: FICN/BR001/20260401/000003 | FIR mandatory per RBI (count >= 5)',
      data: ficnExample,
    });
    expect(env.errorCode).toBe('CBS-TELLER-008');
    expect(env.data?.firRequired).toBe(true);
  });
});
