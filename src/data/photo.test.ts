import { afterEach, expect, it } from 'vitest';
import { LocalCatalogRepository } from './repository';
import { photoFixture } from '../testing/photo';
const stores: LocalCatalogRepository[] = [];
const create = (name = `photo-${crypto.randomUUID()}`) => { const store = new LocalCatalogRepository(name, { seedDemo: false }); stores.push(store); return store; };
afterEach(async () => { for (const store of stores.splice(0)) await store.deleteDatabase(); });
it('persists photos after reopening and restores embedded bytes from a complete backup', async () => {
  const name = `photo-persist-${crypto.randomUUID()}`; const store = create(name);
  const product = await store.createProduct({ name: 'Photo fixture', keywords: [], photoDataUrl: photoFixture }, 'Fixture');
  store.close(); const reopened = create(name); expect((await reopened.load()).products[0].photoDataUrl).toBe(photoFixture);
  const backup = await reopened.exportBackup(); const target = create(); await target.importBackup(backup, true, true);
  expect((await target.load()).products[0]).toEqual(product);
  expect((await target.getHistory(product.id)).some(event => (event.after as { photoDataUrl?: string })?.photoDataUrl === photoFixture)).toBe(true);
  await expect(target.importBackup({ ...backup, products: [{ ...product, photoDataUrl: 'https://example.com/image.jpg' }] }, true, true)).rejects.toThrow('Invalid backup');
});
it('records photo removal and resets independently checked codes when the product photo changes', async () => {
  const store = create(); const product = await store.createProduct({ name: 'Photo fixture', keywords: [], photoDataUrl: photoFixture }, 'Fixture');
  const identifier = await store.addIdentifier(product.id, { code: '012345678905', type: 'UPC_A', source: { type: 'manual', attribution: 'Fixture' }, reason: 'Fixture' });
  await store.verifyIdentifier(identifier.id, { status: 'pos_verified', confirmed: true, source: { type: 'manual', attribution: 'Independent check' }, reason: 'Fixture', }, identifier.updatedAt);
  const updated = await store.updateProduct(product.id, { ...product, photoDataUrl: undefined }, 'Removed photo', product.updatedAt);
  expect(updated.photoDataUrl).toBeUndefined(); expect((await store.load()).identifiers[0].verificationStatus).toBe('unverified');
  expect((await store.getHistory(product.id)).find(event => event.reason === 'Removed photo')?.before).toMatchObject({ photoDataUrl: photoFixture });
});
it('creates an unverified leading-zero PLU and independent barcode photo atomically and restores both', async () => {
  const store = create(); const product = await store.createProduct({ name: 'PLU fixture', keywords: [], plu: '04011', barcodePhotoDataUrl: photoFixture }, 'Fixture');
  const data = await store.load(); expect(product).not.toHaveProperty('plu'); expect(product.photoDataUrl).toBeUndefined();
  expect(data.identifiers[0]).toMatchObject({ productId: product.id, code: '04011', type: 'PLU', verificationStatus: 'unverified' });
  const backup = await store.exportBackup(); const target = create(); await target.importBackup(backup, false, true);
  expect((await target.load()).products[0].barcodePhotoDataUrl).toBe(photoFixture);
  expect((await target.load()).identifiers[0].code).toBe('04011');
  const before = await store.exportBackup();
  for (const plu of ['04011', '40 11', 'abc']) await expect(store.createProduct({ name: 'Must not save', keywords: [], plu, barcodePhotoDataUrl: photoFixture }, 'Fixture')).rejects.toThrow();
  const after = await store.exportBackup(); for (const table of ['products', 'identifiers', 'sources', 'events'] as const) expect(after[table]).toEqual(before[table]);
  await expect(store.createProduct({ name: 'Bad photo', keywords: [], plu: '00012', barcodePhotoDataUrl: 'https://example.com/barcode.jpg' }, 'Fixture')).rejects.toThrow();
});
