import { describe, expect, it } from 'vitest';
import { demoProducts, demoIdentifiers } from '../data/demo';
import { searchProducts } from './search';
import { prioritizedIdentifiers } from './models';
describe('local search', () => {
  it('matches name, brand, keywords and category without case sensitivity', () => {
    for (const query of ['OAT', 'Fictional Meadow', 'milk alternative', 'Pantry']) {
      expect(searchProducts(demoProducts, demoIdentifiers, query).length).toBeGreaterThan(0);
    }
    expect(searchProducts(demoProducts, demoIdentifiers, 'oat unsweetened')).toHaveLength(0);
    expect(searchProducts(demoProducts, demoIdentifiers, 'oat original')).toHaveLength(0);
  });
  it('matches synonym groups, categories and whitespace-only searches', () => {
    expect(searchProducts(demoProducts, demoIdentifiers, 'pop')[0].name).toBe('Demo Citrus Soda');
    expect(searchProducts(demoProducts, demoIdentifiers, 'garbanzo')[0].name).toBe('Demo Chickpeas');
    expect(searchProducts(demoProducts, demoIdentifiers, '', 'Drinks')).toHaveLength(4);
    expect(searchProducts(demoProducts, demoIdentifiers, '  ')).toHaveLength(6);
    expect(searchProducts(demoProducts, demoIdentifiers, 'pear', 'Drinks')).toHaveLength(0);
  });
  it('preserves leading-zero numeric strings and prioritizes an exact identifier match', () => {
    const identifiers = [...demoIdentifiers, { ...demoIdentifiers[0], id: 'additional', productId: demoProducts[1].id, code: '0000019' }];
    const results = searchProducts(demoProducts, identifiers, '000001');
    expect(results.map(p => p.id)).toEqual([demoProducts[0].id, demoProducts[1].id]);
    expect(identifiers[0].code).toBe('000001');
  });
  it('excludes archived products and inactive or rejected code matches', () => {
    expect(searchProducts([{ ...demoProducts[0], archivedAt: '2026-01-02' }], demoIdentifiers, '')).toHaveLength(0);
    for (const identifier of [{ ...demoIdentifiers[0], isActive: false }, { ...demoIdentifiers[0], verificationStatus: 'rejected' as const }]) {
      expect(searchProducts(demoProducts, [identifier], identifier.code)).toHaveLength(0);
    }
  });
  it('keeps variants distinct and supports several identifiers per product', () => {
    const identifiers = [...demoIdentifiers, { ...demoIdentifiers[0], id: 'second', code: '009999' }];
    expect(searchProducts(demoProducts, identifiers, '009999')[0].id).toBe(demoProducts[0].id);
    expect(new Set(searchProducts(demoProducts, identifiers, 'oat').map(p => `${p.variant} ${p.size}`)).size).toBe(3);
  });
});
it('prioritizes POS then packaging verification without mutating input or including retired codes', () => {
  const identifiers = [demoIdentifiers[0], { ...demoIdentifiers[1], verificationStatus: 'packaging_verified' as const }, { ...demoIdentifiers[2], verificationStatus: 'pos_verified' as const }, { ...demoIdentifiers[3], isActive: false }];
  expect(prioritizedIdentifiers(identifiers).map(i => i.verificationStatus)).toEqual(['pos_verified', 'packaging_verified', 'unverified']);
  expect(identifiers[0].verificationStatus).toBe('unverified');
});
