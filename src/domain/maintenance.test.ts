import { expect, it } from 'vitest';
import { equivalentCode, identifierConflicts, reviewReasons, similarProducts, validateProduct, validateIdentifierInput } from './maintenance';
import { demoProducts } from '../data/demo';
import { testIdentifier } from '../testing/identifier';
import { identifierPresentation } from './identifier-policy';
import { renderBarcodeSvg } from '../barcode/render';
it('recognizes exact and UPC-A/leading-zero EAN-13 duplicates without coercing PLUs', () => {
  const first = testIdentifier(); const equivalent = testIdentifier({ id: 'equivalent', type: 'EAN_13', code: '0012345678905' });
  expect(equivalentCode(first, equivalent)).toBe(true);
  expect(equivalentCode({ type: 'PLU', code: '00123' }, { type: 'PLU', code: '123' })).toBe(false);
  expect(identifierConflicts(first, [first, equivalent])).toEqual([equivalent]);
  expect(identifierConflicts(first, [first, { ...equivalent, isActive: false }])).toEqual([]);
});
it('blocks conflict presentation and artwork even when a pre-existing code is verified', () => {
  expect(identifierPresentation(testIdentifier(), false, true)).toMatchObject({ checkoutReady: false, canCopy: false, canRenderBarcode: false });
  expect(renderBarcodeSvg(testIdentifier(), false, true)).toBeNull();
});
it('warns about near identical name/brand variants and excludes self and archived products', () => {
  expect(similarProducts({ ...demoProducts[0], name: ' demo OAT drink ' }, demoProducts, demoProducts[0].id)).toHaveLength(2);
  expect(similarProducts(demoProducts[0], [{ ...demoProducts[1], archivedAt: '2026-01-01' }])).toHaveLength(0);
});
it('validates metadata, image attribution and evidence without accepting malformed code changes', () => {
  for (const field of ['variant', 'size', 'packaging', 'imageAttribution', 'imageUrl']) expect(validateProduct(demoProducts[0])).not.toHaveProperty(field);
  expect(() => validateProduct({ ...demoProducts[0], name: ' ' })).toThrow('name');
  expect(() => validateIdentifierInput({ code: '012345678906', type: 'UPC_A', source: { type: 'manual', attribution: 'Note' }, reason: 'Correction' })).toThrow('Check digit');
});
it('queues missing, unverified, packaging-only, invalid and conflicting entries; reviewed codes leave the queue', () => {
  const product = { ...demoProducts[0], isDemo: false };
  const identifier = testIdentifier({ productId: product.id });
  expect(reviewReasons(product, [], [])).toEqual(['No active identifiers']);
  expect(reviewReasons(product, [identifier], [identifier])).toEqual([]);
  expect(reviewReasons(product, [{ ...identifier, verificationStatus: 'unverified' }], [])).toContain('Unverified code');
  expect(reviewReasons(product, [{ ...identifier, verificationStatus: 'packaging_verified' }], [])).toContain('Register compatibility unverified');
  expect(reviewReasons(product, [{ ...identifier, code: 'invalid' }], [])).toContain('Invalid code');
  expect(reviewReasons(product, [identifier], [identifier, { ...identifier, id: 'conflict' }])).toContain('Duplicate identifier association');
  expect(reviewReasons(product, [{ ...identifier, verificationStatus: 'rejected' }], [identifier])).toEqual([]);
});
