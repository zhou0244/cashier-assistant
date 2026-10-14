import { expect, it } from 'vitest';
import { renderBarcodeSvg } from './render';
import { testIdentifier } from '../testing/identifier';
import type { IdentifierType } from '../domain/models';
const vectors: [IdentifierType, string, string][] = [
  ['UPC_A', '012345678905', '10100011010011001001001101111010100011011000101010101000010001001001000111010011100101001110101'],
  ['EAN_13', '4006381333931', '10100011010100111010111101111010001001011001101010100001010000101000010111010010000101100110101'],
  ['EAN_8', '96385074', '1010001011010111101111010110111010101001110111001010001001011100101'],
];
it.each(vectors)('renders exact %s symbol modules with guard bars and quiet zones', (type, code, expected) => {
  const markup = renderBarcodeSvg(testIdentifier({ type, code }), false)!;
  const svg = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
  const modules = Array<string>(expected.length).fill('0');
  for (const group of svg.querySelectorAll('g')) {
    const offset = Number(group.getAttribute('transform')!.match(/translate\(([^,]+)/)![1]);
    for (const rect of group.querySelectorAll('rect')) {
      const start = (offset + Number(rect.getAttribute('x')) - 22) / 2;
      const width = Number(rect.getAttribute('width')) / 2;
      for (let index = start; index < start + width; index++) modules[index] = '1';
    }
  }
  expect(modules.join('')).toBe(expected);
  expect(Number.parseFloat(svg.getAttribute('width')!)).toBe(expected.length * 2 + 44);
  expect(svg.getAttribute('aria-label')).toContain(code);
  expect(svg.querySelector('text')).toBeNull(); // Exact human-readable string is shown by the card.
});
it('retains the equivalent leading-zero EAN-13 symbol without transforming the stored string', () => {
  const markup = renderBarcodeSvg(testIdentifier({ type: 'EAN_13', code: '0012345678905' }), false)!;
  expect(markup).toContain('0012345678905');
});
it('renderer independently blocks unsafe inputs rather than relying on the component', () => {
  for (const identifier of [testIdentifier({ verificationStatus: 'unverified' }), testIdentifier({ verificationStatus: 'rejected' }), testIdentifier({ isActive: false }), testIdentifier({ code: '012345678906' }), testIdentifier({ code: '01234567890' }), testIdentifier({ type: 'PLU', code: '00123' }), testIdentifier({ type: 'STORE_CODE', code: '00123' }), testIdentifier({ type: 'OTHER' })]) {
    expect(renderBarcodeSvg(identifier, false)).toBeNull();
  }
  expect(renderBarcodeSvg(testIdentifier(), true)).toBeNull();
});
