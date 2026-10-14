import Dexie from 'dexie';
import { afterEach, expect, it, vi } from 'vitest';
import { LocalCatalogRepository } from './repository';
import { demoProducts, demoIdentifiers, demoSource, demoEvents } from './demo';
import { seedCategories, legacySeedCategories, seedCategoryId } from './taxonomy';
import { childrenOf } from '../domain/classification';
import { sameRecord, parseBackup } from '../imports/backup';
const stores: LocalCatalogRepository[] = [];
function create(name = `category-${crypto.randomUUID()}`, seedDemo = false) { const store = new LocalCatalogRepository(name, { seedDemo }); stores.push(store); return store; }
afterEach(async () => { vi.unstubAllGlobals(); for (const store of stores.splice(0)) await store.deleteDatabase(); });
it('safely upgrades a version 1 database without changing codes, verification, sources, saved state or old history', async () => {
  const name = `legacy-${crypto.randomUUID()}`; const legacy = new Dexie(name);
  legacy.version(1).stores({ products: 'id, category, updatedAt', identifiers: 'id, productId, code, verificationStatus, sourceId', sources: 'id', events: 'id, entityId, timestamp', saved_products: 'productId, savedAt, lastUsedAt' });
  await legacy.open(); const identifier = { ...demoIdentifiers[0], verificationStatus: 'pos_verified', verifiedAt: demoProducts[0].updatedAt, verificationMethod: 'Original check' };
  await legacy.table('products').bulkAdd(demoProducts); await legacy.table('identifiers').add(identifier); await legacy.table('sources').add(demoSource); await legacy.table('events').bulkAdd(demoEvents);
  const saved = { productId: demoProducts[0].id, savedAt: demoProducts[0].createdAt, useCount: 2 }; await legacy.table('saved_products').add(saved); legacy.close();
  vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });
  const store = create(name); const data = await store.load();
  expect(data.categories.length).toBe(seedCategories.length); expect(data.products).toHaveLength(6);
  expect(data.products[0].categoryId).toBe(seedCategoryId('Drinks')); expect(data.identifiers[0]).toEqual(identifier); expect(data.sources).toEqual([demoSource]); expect(data.saved).toEqual([saved]);
  const backup = await store.exportBackup(); for (const event of demoEvents) expect(backup.events.some(current => sameRecord(current, event))).toBe(true);
  expect(backup.events.some(event => event.eventType === 'classification_migrated')).toBe(true);
  store.close(); expect((await create(name).load()).products).toEqual(data.products);
});
it('persists department creation, rename, reorder and safe removal with stable IDs', async () => {
  const name = `manage-${crypto.randomUUID()}`; const store = create(name);
  const one = await store.saveCategory({ name: 'One', level: 'department', parentId: null, sortOrder: 100 });
  const two = await store.saveCategory({ name: 'Two', level: 'department', parentId: null, sortOrder: 101 });
  const renamed = await store.saveCategory({ ...one, name: 'Renamed' }, one.id, one); expect(renamed.id).toBe(one.id);
  await store.moveCategory(two.id, 'up'); expect(childrenOf((await store.load()).categories, null).slice(-2).map(node => node.name)).toEqual(['Two', 'Renamed']);
  await expect(store.saveCategory({ ...renamed, name: 'two' }, renamed.id, renamed)).rejects.toThrow();
  await expect(store.saveCategory({ name: 'Child', level: 'category', parentId: one.id, sortOrder: 0 })).rejects.toThrow('Only departments');
  const current = (await store.load()).categories.find(node => node.id === renamed.id)!;
  await store.deleteCategory(current.id, current); expect((await store.load()).categories.some(node => node.id === current.id)).toBe(false);
  expect(parseBackup(await store.exportBackup()).categories).toBeDefined();
  store.close(); expect((await create(name).load()).categories.some(node => node.id === two.id)).toBe(true);
});
it('classification-only edits preserve verified identifiers and protect referenced categories from deletion', async () => {
  const store = create(); const product = await store.createProduct({ ...demoProducts[0], name: 'Test-only classified product', categoryId: seedCategoryId('Dairy & Eggs') }, 'Fixture');
  const code = await store.addIdentifier(product.id, { code: '012345678905', type: 'UPC_A', source: { type: 'manual', attribution: 'Test-only check' }, reason: 'Fixture' });
  const verified = await store.verifyIdentifier(code.id, { status: 'pos_verified', confirmed: true, source: { type: 'manual', attribution: 'Test-only check' }, reason: 'Checked', }, code.updatedAt);
  const updated = await store.updateProduct(product.id, { ...product, categoryId: seedCategoryId('Produce') }, 'Reclassify only', product.updatedAt);
  expect((await store.load()).identifiers[0]).toEqual(verified);
  const group = (await store.load()).categories.find(node => node.id === updated.categoryId)!;
  await expect(store.deleteCategory(group.id, group)).rejects.toThrow('Move all products');
  await expect(store.updateProduct(product.id, { ...updated, categoryId: 'missing' }, 'Bad category', updated.updatedAt)).rejects.toThrow('no longer exists');
});
it('exports/restores hierarchy definitions and links, and reads earlier version 1 backups', async () => {
  const store = create(); const node = await store.saveCategory({ name: 'Special foods', level: 'department', parentId: null, sortOrder: 50 });
  const product = await store.createProduct({ ...demoProducts[0], categoryId: node.id }, 'Fixture');
  const backup = await store.exportBackup(); expect(backup.version).toBe(2);
  const restored = create(); await restored.importBackup(backup, true, true); expect((await restored.load()).categories.some(group => sameRecord(group, node))).toBe(true); expect((await restored.load()).products[0].categoryId).toBe(node.id);
  const { categories, ...legacy } = backup;
  const old = { ...legacy, version: 1, events: legacy.events.filter(event => event.entityType !== 'category'), products: [{ ...product, categoryId: undefined }] };
  expect(parseBackup(old).products[0].categoryId).toBe(seedCategoryId('Drinks'));
  const renamed = await store.saveCategory({ ...node, name: 'Renamed foods' }, node.id, node); expect(renamed.id).toBe(product.categoryId);
});
it('restores renamed starter categories only over pristine definitions with explicit trust', async () => {
  const store = create(); const original = (await store.load()).categories.find(node => node.id === seedCategoryId('Bakery'))!;
  const renamed = await store.saveCategory({ ...original, name: 'Bread favourites' }, original.id, original);
  const backup = await store.exportBackup(); const target = create();
  expect((await target.previewBackup(backup, false)).errors.length).toBeGreaterThan(0);
  await target.importBackup(backup, true, true);
  expect((await target.load()).categories.find(node => node.id === renamed.id)).toEqual(renamed);
  const edited = await target.saveCategory({ ...renamed, name: 'My own bread group' }, renamed.id, renamed);
  expect((await target.previewBackup(backup, true)).errors.length).toBeGreaterThan(0);
  await expect(target.importBackup(backup, true, true)).rejects.toThrow();
  expect((await target.load()).categories.find(node => node.id === renamed.id)).toEqual(edited);
});

it('upgrades a version 2 hierarchy to departments while preserving verified codes and original assignment history', async () => {
  const name = `hierarchy-v2-${crypto.randomUUID()}`; const legacy = new Dexie(name);
  legacy.version(2).stores({ products: 'id, category, categoryId, updatedAt', categories: 'id, parentId, level, [parentId+sortOrder]', identifiers: 'id, productId, code, verificationStatus, sourceId', sources: 'id', events: 'id, entityId, timestamp', saved_products: 'productId, savedAt, lastUsedAt' });
  await legacy.open();
  const product = { ...demoProducts[0], categoryId: seedCategoryId('Apples') };
  const identifier = { ...demoIdentifiers[0], verificationStatus: 'pos_verified', verifiedAt: product.updatedAt, verificationMethod: 'Earlier check' };
  const saved = { productId: product.id, savedAt: product.createdAt, useCount: 3 };
  await legacy.table('categories').bulkAdd(legacySeedCategories); await legacy.table('products').add(product); await legacy.table('identifiers').add(identifier); await legacy.table('sources').add(demoSource); await legacy.table('saved_products').add(saved); legacy.close();
  const store = create(name); const data = await store.load();
  expect(data.products[0]).toEqual({ ...product, categoryId: seedCategoryId('Produce') });
  expect(data.identifiers[0]).toEqual(identifier); expect(data.sources).toEqual([demoSource]); expect(data.saved).toEqual([saved]);
  expect((await store.getHistory(product.id)).find(event => event.eventType === 'department_migrated')?.before).toEqual(product);
  expect((await store.exportBackup()).categories).toEqual(legacySeedCategories);
  const bakery = data.categories.find(node => node.id === seedCategoryId('Bakery'))!;
  await store.deleteCategory(bakery.id, bakery);
  const backup = await store.exportBackup(); expect(backup.categories.some(node => node.id === seedCategoryId('Bread'))).toBe(false);
  expect(() => parseBackup(backup)).not.toThrow();
  store.close(); expect((await create(name).load()).products[0].categoryId).toBe(seedCategoryId('Produce'));
});
it('restores an old hierarchy assignment to its department and keeps the original in history', async () => {
  const source = create(); const product = await source.createProduct({ ...demoProducts[0], categoryId: seedCategoryId('Produce') }, 'Fixture');
  const backup = await source.exportBackup();
  const oldBackup = { ...backup, categories: legacySeedCategories, products: [{ ...product, categoryId: seedCategoryId('Apples') }] };
  const target = create(); await target.importBackup(oldBackup, false, true);
  expect((await target.load()).products[0].categoryId).toBe(seedCategoryId('Produce'));
  expect((await target.getHistory(product.id)).find(event => event.eventType === 'department_migrated')?.before).toEqual(oldBackup.products[0]);
});
