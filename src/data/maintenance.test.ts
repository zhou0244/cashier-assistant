import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalCatalogRepository } from './repository';
import type { IdentifierInput, VerificationInput } from '../domain/maintenance';
import { demoProducts } from './demo';
const databases: LocalCatalogRepository[] = [];
const create = (name = `maintenance-${crypto.randomUUID()}`) => { const repository = new LocalCatalogRepository(name); databases.push(repository); return repository; };
const productInput = { ...demoProducts[0], name: 'Test-only product' };
const codeInput: IdentifierInput = { code: '012345678905', type: 'UPC_A', source: { type: 'packaging', attribution: 'Test-only packaging evidence' }, reason: 'Test-only transcription' };
const verification: VerificationInput = { status: 'pos_verified', source: { type: 'manual', attribution: 'Test-only independent register check' }, reason: 'Exact variant and code independently checked', confirmed: true };
afterEach(async () => { vi.restoreAllMocks(); for (const repository of databases.splice(0)) await repository.deleteDatabase(); });
describe('transactional maintenance', () => {
  it('preserves verified original code/source in history and resets corrections to unverified across reopening', async () => {
    const name = `history-${crypto.randomUUID()}`;
    const repository = create(name); const product = await repository.createProduct(productInput, 'Permitted test-only source');
    const initial = await repository.addIdentifier(product.id, codeInput);
    const verified = await repository.verifyIdentifier(initial.id, verification, initial.updatedAt);
    const corrected = await repository.correctIdentifier(initial.id, { ...codeInput, code: '036000291452', reason: 'Correct exact variant' }, verified.updatedAt);
    expect(corrected).toMatchObject({ verificationStatus: 'unverified', verifiedAt: undefined, verificationMethod: undefined, code: '036000291452' });
    const events = await repository.getHistory(product.id); const correction = events.find(event => event.eventType === 'corrected')!;
    expect(correction.before).toMatchObject({ code: '012345678905', verificationStatus: 'pos_verified', sourceId: verified.sourceId });
    expect(correction.after).toMatchObject({ code: '036000291452', verificationStatus: 'unverified' });
    expect((await repository.load()).sources.some(source => source.id === verified.sourceId)).toBe(true);
    repository.close(); const reopened = create(name);
    expect((await reopened.load()).identifiers.find(identifier => identifier.id === corrected.id)).toEqual(corrected);
    expect(await reopened.getHistory(product.id)).toEqual(events);
    events[0].reason = 'tampered local copy';
    expect((await reopened.getHistory(product.id))[0].reason).not.toBe('tampered local copy');
  });
  it('keeps packaging verification separate and supports rejecting and resetting candidates', async () => {
    const repository = create(); const product = await repository.createProduct(productInput, 'Create');
    let identifier = await repository.addIdentifier(product.id, codeInput);
    identifier = await repository.verifyIdentifier(identifier.id, { ...verification, status: 'packaging_verified', source: codeInput.source }, identifier.updatedAt);
    expect(identifier.verificationStatus).toBe('packaging_verified');
    identifier = await repository.verifyIdentifier(identifier.id, { ...verification, status: 'rejected', confirmed: false }, identifier.updatedAt);
    expect(identifier.verifiedAt).toBeUndefined();
    identifier = await repository.verifyIdentifier(identifier.id, { ...verification, status: 'unverified', confirmed: false }, identifier.updatedAt);
    expect(identifier.verificationStatus).toBe('unverified');
  });
  it('rejects demo, unchecked and public-source verification without partial writes', async () => {
    const repository = create(); const demo = (await repository.load()).identifiers[0];
    await expect(repository.verifyIdentifier(demo.id, verification, demo.updatedAt)).rejects.toThrow('demo');
    const product = await repository.createProduct(productInput, 'Create'); const identifier = await repository.addIdentifier(product.id, codeInput);
    const before = await repository.getHistory(product.id); const sourcesBefore = (await repository.load()).sources.length;
    await expect(repository.verifyIdentifier(identifier.id, { ...verification, confirmed: false }, identifier.updatedAt)).rejects.toThrow('Confirm');
    await expect(repository.verifyIdentifier(identifier.id, { ...verification, source: { type: 'unsupported' as 'manual', attribution: 'Unsupported source' } }, identifier.updatedAt)).rejects.toThrow('supported source');
    expect(await repository.getHistory(product.id)).toEqual(before);
    expect((await repository.load()).sources).toHaveLength(sourcesBefore);
  });
  it('blocks exact and equivalent-code duplicates and preserves the catalog on failure', async () => {
    const repository = create(); const first = await repository.createProduct(productInput, 'Create'); const second = await repository.createProduct({ ...productInput, name: 'Different' }, 'Create');
    await repository.addIdentifier(first.id, codeInput);
    await expect(repository.addIdentifier(second.id, codeInput)).rejects.toThrow('Duplicate');
    await expect(repository.addIdentifier(second.id, { ...codeInput, type: 'EAN_13', code: '0012345678905' })).rejects.toThrow('Duplicate');
    expect((await repository.getHistory(second.id)).filter(event => event.entityType === 'identifier')).toEqual([]);
    expect((await repository.load()).identifiers.filter(identifier => identifier.productId === second.id)).toEqual([]);
  });
  it('serializes competing duplicate adds, so only one succeeds', async () => {
    const repository = create(); const a = await repository.createProduct(productInput, 'Create'); const b = await repository.createProduct(productInput, 'Create');
    const results = await Promise.allSettled([repository.addIdentifier(a.id, codeInput), repository.addIdentifier(b.id, codeInput)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  });
  it('retires without losing code/history and permits deliberate reassignment after retirement', async () => {
    const repository = create(); const a = await repository.createProduct(productInput, 'Create'); const identifier = await repository.addIdentifier(a.id, codeInput);
    await repository.retireIdentifier(identifier.id, 'Wrong variant', identifier.updatedAt);
    expect((await repository.load()).identifiers.find(record => record.id === identifier.id)).toMatchObject({ isActive: false, code: codeInput.code });
    expect((await repository.getHistory(a.id)).some(event => event.eventType === 'retired')).toBe(true);
    await expect(repository.verifyIdentifier(identifier.id, verification, identifier.updatedAt)).rejects.toThrow('Active identifier');
    const b = await repository.createProduct(productInput, 'Create'); await expect(repository.addIdentifier(b.id, codeInput)).resolves.toMatchObject({ verificationStatus: 'unverified' });
  });
  it('invalidates verified identifiers on product edits and retains demo status', async () => {
    const repository = create(); const product = await repository.createProduct(productInput, 'Create'); const identifier = await repository.addIdentifier(product.id, codeInput);
    await repository.verifyIdentifier(identifier.id, verification, identifier.updatedAt);
    await repository.updateProduct(product.id, { ...productInput, name: 'Different name' }, 'Correct size', product.updatedAt);
    expect((await repository.load()).identifiers.find(record => record.id === identifier.id)?.verificationStatus).toBe('unverified');
    expect((await repository.getHistory(product.id)).some(event => event.eventType === 'verification_reset')).toBe(true);
    const demo = (await repository.load()).products.find(record => record.isDemo)!;
    expect((await repository.updateProduct(demo.id, { ...demo, name: 'Renamed demo' }, 'Label edit', demo.updatedAt)).isDemo).toBe(true);
  });
  it('rejects stale edits and malformed codes and requires reasons', async () => {
    const repository = create(); const product = await repository.createProduct(productInput, 'Create'); const identifier = await repository.addIdentifier(product.id, codeInput);
    const changed = await repository.correctIdentifier(identifier.id, codeInput, identifier.updatedAt);
    expect(changed.updatedAt).not.toBe(identifier.updatedAt);
    await expect(repository.retireIdentifier(identifier.id, 'Retire', identifier.updatedAt)).rejects.toThrow('changed');
    await expect(repository.correctIdentifier(identifier.id, { ...codeInput, code: '012345678906' }, changed.updatedAt)).rejects.toThrow('Check digit');
    await expect(repository.retireIdentifier(identifier.id, ' ', changed.updatedAt)).rejects.toThrow('reason');
  });
  it('rolls back entity and evidence writes if append-only history cannot be recorded', async () => {
    const repository = create(); const product = await repository.createProduct(productInput, 'Create');
    const before = await repository.load();
    const existingEvent = (await repository.getHistory(product.id))[0].id;
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(existingEvent as ReturnType<typeof crypto.randomUUID>);
    await expect(repository.addIdentifier(product.id, codeInput)).rejects.toThrow(); // Force an event primary-key collision after identifier/source writes.
    expect((await repository.load()).identifiers).toEqual(before.identifiers);
  });
});
