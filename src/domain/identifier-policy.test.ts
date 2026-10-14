import { describe, expect, it } from 'vitest';
import type { IdentifierType, VerificationStatus } from './models';
import { validateIdentifier, identifierPresentation } from './identifier-policy';
import { testIdentifier } from '../testing/identifier';
const samples: [IdentifierType, string][] = [['UPC_A', '012345678905'], ['EAN_13', '4006381333931'], ['EAN_8', '96385074']];
describe('exact identifier validation', () => {
  it.each(samples)('checks %s length and modulo-10 checksum', (type, code) => {
    expect(validateIdentifier(code, type).valid).toBe(true);
    for (const invalid of [code.slice(1), '0' + code, code.slice(0, -1) + ((Number(code.at(-1)) + 1) % 10)]) {
      expect(validateIdentifier(invalid, type).valid).toBe(false);
    }
  });
  it.each(['UPC_A', 'EAN_13', 'EAN_8', 'PLU', 'STORE_CODE', 'OTHER'] as IdentifierType[])('rejects non-digits for %s', type => {
    for (const code of ['', ' 012345678905', '012345678905 ', '012345678905\n', '12.34', '-1234', '１２３４', '123A', '12\t34']) {
      expect(validateIdentifier(code, type).valid).toBe(false);
    }
  });
  it('allows numeric manual codes without pretending to validate their identity or checksum', () => {
    for (const type of ['PLU', 'STORE_CODE'] as const) {
      expect(validateIdentifier('00123', type).valid).toBe(true);
      expect(identifierPresentation(testIdentifier({ type, code: '00123' }), false)).toMatchObject({ canRenderBarcode: false, canCopy: true, checkoutReady: true });
    }
  });
});
describe('verification and rendering policy', () => {
  it.each(['unverified', 'packaging_verified', 'pos_verified', 'rejected'] as VerificationStatus[])('keeps %s separate from format validity', verificationStatus => {
    const policy = identifierPresentation(testIdentifier({ verificationStatus }), false);
    expect(policy.validation.valid).toBe(true);
    expect(policy.canRenderBarcode).toBe(verificationStatus === 'packaging_verified' || verificationStatus === 'pos_verified');
    expect(policy.checkoutReady).toBe(verificationStatus === 'pos_verified');
  });
  it('blocks invalid, retired, demo and unspecified code types even when POS verified', () => {
    for (const [identifier, isDemo] of [[testIdentifier({ code: '012345678906' }), false], [testIdentifier({ isActive: false }), false], [testIdentifier(), true], [testIdentifier({ type: 'OTHER' }), false]] as const) {
      expect(identifierPresentation(identifier, isDemo)).toMatchObject({ canRenderBarcode: false, canCopy: false, checkoutReady: false });
    }
  });
});
