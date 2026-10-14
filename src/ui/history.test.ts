import { expect, it } from 'vitest';
import { historyFields } from './history';
import { testIdentifier } from '../testing/identifier';
import { demoSource } from '../data/demo';
it('shows readable past values with exact codes and provenance without internal keys or changing the record', () => {
  const identifier = testIdentifier({ sourceId: demoSource.id }); const before = structuredClone(identifier);
  const fields = historyFields(identifier, [demoSource]);
  expect(fields).toContainEqual({ label: 'Code', value: '012345678905' });
  expect(fields).toContainEqual({ label: 'Check status', value: 'Checked at register' });
  expect(fields.find(field => field.label === 'Where the code came from')?.value).toBe(demoSource.attribution);
  expect(fields.some(field => ['id', 'productId', 'sourceId', 'verificationStatus'].includes(field.label))).toBe(false);
  expect(identifier).toEqual(before);
});

it('hides removed product fields while leaving the original snapshot intact', () => {
  const snapshot = { name: 'Fixture', variant: 'No salt added', size: '540 mL', packaging: 'Earlier package note', imageAttribution: 'Earlier photo credit', imageUrl: 'https://example.com/old-photo.jpg' };
  expect(historyFields(snapshot, []).map(field => field.value)).toEqual(['Fixture']);
  expect(snapshot.variant).toBe('No salt added');
});
