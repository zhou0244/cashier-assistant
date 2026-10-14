import { afterEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { LocalCatalogRepository } from './repository';
const databases: LocalCatalogRepository[] = [];
function create(name = `test-${crypto.randomUUID()}`) { const repository = new LocalCatalogRepository(name); databases.push(repository); return repository; }
afterEach(async () => { for (const repository of databases.splice(0)) await repository.deleteDatabase(); });
describe('IndexedDB persistence', () => {
  it('seeds fictional records atomically with sources and creation history', async () => {
    const name = `seed-${crypto.randomUUID()}`;
    const repository = create(name);
    const data = await repository.load();
    expect(data.products).toHaveLength(6);
    expect(data.identifiers.every(i => i.verificationStatus === 'unverified')).toBe(true);
    expect(data.products.every(p => p.isDemo)).toBe(true);
    expect(data.identifiers.every(i => data.sources.some(s => s.id === i.sourceId))).toBe(true);
    const raw = new Dexie(name); await raw.open();
    expect(await raw.table('events').count()).toBe(6);
    raw.close(); repository.close();
    expect((await create(name).load()).products).toHaveLength(6);
  });
  it('retains saved and recent state after reopening with no network', async () => {
    const name = `persist-${crypto.randomUUID()}`;
    const first = create(name); const id = (await first.load()).products[0].id;
    await first.setSaved(id, true); await first.recordUse(id); await first.recordUse(id);
    first.close();
    const second = create(name); const saved = (await second.load()).saved[0];
    expect(saved.savedAt).toBeDefined(); expect(saved.lastUsedAt).toBeDefined(); expect(saved.useCount).toBe(2);
    await second.setSaved(id, false);
    expect((await second.load()).saved[0]).toMatchObject({ savedAt: undefined, useCount: 2, lastUsedAt: saved.lastUsedAt });
  });
  it('handles concurrent saves and opens without losing recent activity', async () => {
    const repository = create(); const id = (await repository.load()).products[0].id;
    await Promise.all([repository.recordUse(id), repository.setSaved(id, true), repository.recordUse(id)]);
    const saved = (await repository.load()).saved[0];
    expect(saved.savedAt).toBeDefined(); expect(saved.useCount).toBe(2);
  });
  it('does not silently reseed an intentionally emptied existing database', async () => {
    const name = `empty-${crypto.randomUUID()}`; const repository = create(name); await repository.load(); repository.close();
    const raw = new Dexie(name); await raw.open(); await raw.table('products').clear(); raw.close();
    expect((await create(name).load()).products).toHaveLength(0);
  });
  it('rejects saved references to missing products', async () => {
    const repository = create();
    await expect(repository.setSaved('missing', true)).rejects.toThrow('Product no longer exists');
    await expect(repository.recordUse('missing')).rejects.toThrow('Product no longer exists');
  });
});
