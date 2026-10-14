import { afterEach, expect, it } from 'vitest';
import { LocalCatalogRepository } from './repository';
import { demoProducts } from './demo';
import { parseBackup, readBackupJson, sameRecord } from '../imports/backup';
import { reviewReasons } from '../domain/maintenance';
const repositories: LocalCatalogRepository[] = [];
function create(seedDemo = false) { const store = new LocalCatalogRepository(`backup-${crypto.randomUUID()}`, { seedDemo }); repositories.push(store); return store; }
afterEach(async () => { for (const store of repositories.splice(0)) await store.deleteDatabase(); });
async function populated() {
  const store = create(); const product = await store.createProduct({ ...demoProducts[0], name: 'Test-only original' }, 'Permitted test fixture');
  const identifier = await store.addIdentifier(product.id, { code: '012345678905', type: 'UPC_A', source: { type: 'packaging', attribution: 'Test-only label', externalUrl: 'https://example.com/fixture' }, reason: 'Recorded' });
  await store.verifyIdentifier(identifier.id, { status: 'pos_verified', confirmed: true, source: { type: 'manual', attribution: 'Test-only observation' }, reason: 'Independent test-only evidence' }, identifier.updatedAt);
  await store.setSaved(product.id, true); await store.recordUse(product.id);
  return { store, product, backup: await store.exportBackup() };
}
it('round-trips products, leading-zero identifiers, sources, history and saved metadata into a fresh database', async () => {
  const { backup } = await populated(); const target = create(); const parsed = readBackupJson(JSON.stringify(backup));
  const preview = await target.previewBackup(parsed, true); expect(preview.errors).toEqual([]);
  await target.importBackup(parsed, true, true); const restored = await target.exportBackup();
  for (const key of ['categories', 'products', 'identifiers', 'sources', 'saved'] as const) expect(sameRecord(restored[key], parsed[key])).toBe(true);
  for (const event of parsed.events) expect(restored.events.some(record => sameRecord(record, event))).toBe(true);
  expect(restored.identifiers[0].code).toBe('012345678905');
  expect(restored.events.some(event => event.eventType === 'backup_imported')).toBe(true);
  expect((await target.previewBackup(parsed, true)).skipped).toBe(parsed.categories.length + parsed.products.length + parsed.identifiers.length + parsed.sources.length + parsed.events.length + parsed.saved.length);
});
it('defaults claimed verification to unverified and retains the original claim in history', async () => {
  const { backup } = await populated(); const target = create(); await target.importBackup(backup, false, true);
  const result = await target.exportBackup(); expect(result.identifiers[0].verificationStatus).toBe('unverified');
  const event = result.events.find(record => record.eventType === 'import_verification_reset')!;
  expect(event.before).toMatchObject({ verificationStatus: 'pos_verified', code: '012345678905' });
  expect(reviewReasons(result.products[0], result.identifiers, result.identifiers)).toContain('Unverified code');
});
it('rejects malformed, numeric-coerced, duplicate-ID and orphaned imports without writing anything', async () => {
  const { backup } = await populated(); const target = create();
  for (const modified of [ { ...backup, version: 99 }, { ...backup, identifiers: [{ ...backup.identifiers[0], code: 12345678905 }] }, { ...backup, products: [...backup.products, backup.products[0]] }, { ...backup, products: [] } ]) {
    await expect(target.importBackup(modified, true, true)).rejects.toThrow();
    expect((await target.load()).products).toEqual([]);
  }
  expect(() => readBackupJson('{bad json')).toThrow('valid JSON');
  expect(() => parseBackup({ ...backup, products: [{ ...backup.products[0], imageUrl: 'javascript:alert(1)' }] })).toThrow('Invalid backup');
});
it('rechecks conflicts at save time rather than trusting an earlier preview', async () => {
  const { backup } = await populated(); const target = create(); expect((await target.previewBackup(backup, true)).errors).toEqual([]);
  const local = await target.createProduct(demoProducts[0], 'Local record');
  await target.addIdentifier(local.id, { code: '0012345678905', type: 'EAN_13', source: { type: 'manual', attribution: 'Local fixture' }, reason: 'Recorded' });
  await expect(target.importBackup(backup, true, true)).rejects.toThrow('Duplicate active code');
  expect((await target.load()).products).toHaveLength(1);
});
it('blocks conflicting IDs and unchecked import acknowledgment', async () => {
  const { store, backup, product } = await populated();
  await expect(create().importBackup(backup, true, false)).rejects.toThrow('acknowledge');
  await store.updateProduct(product.id, { ...product, name: 'Changed locally' }, 'Local edit', product.updatedAt);
  await expect(store.importBackup(backup, true, true)).rejects.toThrow('Conflicting products ID');
  expect((await store.load()).products[0].name).toBe('Changed locally');
});
it('restores modified fictional fixtures over pristine placeholders while retaining all histories', async () => {
  const source = create(true); const product = (await source.load()).products[0];
  await source.updateProduct(product.id, { ...product, name: 'Edited fictional demo' }, 'Demo label correction', product.updatedAt);
  const backup = await source.exportBackup(); const target = create(true);
  expect((await target.previewBackup(backup, false)).errors.length).toBeGreaterThan(0);
  await target.importBackup(backup, true, true);
  expect((await target.load()).products.find(record => record.id === product.id)).toMatchObject({ name: 'Edited fictional demo', isDemo: true });
  for (const event of backup.events) expect((await target.exportBackup()).events.some(record => sameRecord(record, event))).toBe(true);
});
it('retains invalid original codes for review and never trusts invalid verification', async () => {
  const { backup } = await populated(); const target = create();
  const invalid = { ...backup, identifiers: [{ ...backup.identifiers[0], code: '012345678906' }] };
  expect((await target.previewBackup(invalid, true)).warnings[0]).toContain('Invalid code');
  await target.importBackup(invalid, true, true);
  expect((await target.load()).identifiers[0]).toMatchObject({ code: '012345678906', verificationStatus: 'unverified' });
});
it('keeps legacy imported metadata and history readable without trusting its public-source verification', async () => {
  const { backup } = await populated(); const target = create();
  const legacy = {
    ...backup,
    products: backup.products.map(product => ({ ...product, externalCategories: { source: 'open_food_facts' as const, labels: ['Original legacy label'], ids: ['en:legacy-group'] } })),
    sources: backup.sources.map(source => ({ ...source, type: 'open_food_facts' as const, attribution: 'Original recorded provider credit' })),
  };
  await target.importBackup(legacy, true, true);
  const restored = await target.exportBackup();
  expect(restored.products[0].externalCategories).toEqual(legacy.products[0].externalCategories);
  expect(restored.sources).toEqual(legacy.sources);
  expect(restored.identifiers[0]).toMatchObject({ code: '012345678905', verificationStatus: 'unverified' });
  for (const event of legacy.events) expect(restored.events.some(record => sameRecord(record, event))).toBe(true);
});

it('preserves removed product fields from older backups without resetting verified codes on an unchanged edit', async () => {
  const { backup } = await populated(); const target = create();
  const legacy = { ...backup, products: backup.products.map(product => ({ ...product, size: '540 mL', packaging: 'Earlier package description', imageAttribution: 'Earlier photo owner' })) };
  await target.importBackup(legacy, true, true);
  const before = await target.load(); const product = before.products[0];
  await target.updateProduct(product.id, product, 'Product details edited manually.', product.updatedAt);
  const after = await target.exportBackup();
  expect(after.products[0]).toMatchObject({ size: '540 mL', packaging: 'Earlier package description', imageAttribution: 'Earlier photo owner' });
  expect(after.identifiers).toEqual(before.identifiers);
});
