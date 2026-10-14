import { newId } from '../domain/id';
import { seedCategories } from './taxonomy';
import { categoryNameKey, categoryPath, matchesClassification, childrenOf, migrateClassification, requireCategory, validateHierarchy } from '../domain/classification';
import Dexie, { liveQuery, type Table } from 'dexie';
import type { Catalog, Product, Identifier, Source, ChangeEvent, SavedProduct, ProductCategory } from '../domain/models';
import { identifierConflicts, requireReason, validateEvidence, validateIdentifierInput, validateProduct, type IdentifierInput, type ProductInput, type VerificationInput } from '../domain/maintenance';
import { validateIdentifier } from '../domain/identifier-policy';
import type { Backup, ImportPlan } from '../imports/backup';
import { demoProducts, demoIdentifiers, demoSource, demoEvents } from './demo';
class CatalogDatabase extends Dexie {
  products!: Table<Product, string>;
  categories!: Table<ProductCategory, string>;
  identifiers!: Table<Identifier, string>;
  sources!: Table<Source, string>;
  events!: Table<ChangeEvent, string>;
  saved_products!: Table<SavedProduct, string>;
  constructor(name: string, seedDemo = true) {
    super(name);
    this.version(1).stores({ products: 'id, category, updatedAt', identifiers: 'id, productId, code, verificationStatus, sourceId', sources: 'id', events: 'id, entityId, timestamp', saved_products: 'productId, savedAt, lastUsedAt' });
    this.version(2).stores({ products: 'id, category, categoryId, updatedAt', categories: 'id, parentId, level, [parentId+sortOrder]' }).upgrade(async transaction => {
      const products = await transaction.table<Product>('products').toArray();
      const migrated = migrateClassification(products, await transaction.table<Identifier>('identifiers').toArray(), await transaction.table<Source>('sources').toArray(), await transaction.table<ChangeEvent>('events').toArray());
      await transaction.table('categories').bulkAdd(migrated.categories);
      await transaction.table('products').bulkPut(migrated.products);
      for (let index = 0; index < products.length; index++) {
        if (JSON.stringify(products[index]) !== JSON.stringify(migrated.products[index])) await transaction.table('events').add({ id: newId(), entityType: 'product', entityId: products[index].id, eventType: 'classification_migrated', before: products[index], after: migrated.products[index], reason: 'Preserved the earlier classification and recorded the department.', timestamp: new Date().toISOString() });
      }
    });
    this.version(3).stores({}).upgrade(async transaction => {
      const categories = await transaction.table<ProductCategory>('categories').toArray();
      for (const before of await transaction.table<Product>('products').toArray()) {
        const departmentId = categoryPath(categories, before.categoryId)[0]?.id;
        if (departmentId === before.categoryId) continue;
        const after = { ...before, categoryId: departmentId };
        await transaction.table('products').put(after);
        await transaction.table('events').add({ id: newId(), entityType: 'product', entityId: before.id, eventType: 'department_migrated', before, after, reason: 'Kept the department; earlier classification is preserved here.', timestamp: new Date().toISOString() });
      }
    });
    this.events.hook('updating', () => { throw new Error('History is append-only.'); });
    this.events.hook('deleting', () => { throw new Error('History is append-only.'); });
    this.on('populate', transaction => {
      // One atomic, first-creation seed. An intentionally emptied catalog stays empty.
      return Promise.all([
        transaction.table('categories').bulkAdd(seedCategories),
        ...(seedDemo ? [transaction.table('products').bulkAdd(migrateClassification(demoProducts, demoIdentifiers, [demoSource], demoEvents).products), transaction.table('identifiers').bulkAdd(demoIdentifiers), transaction.table('sources').add(demoSource), transaction.table('events').bulkAdd(demoEvents)] : []),
      ]).then(() => undefined);
    });
  }
}
export interface CatalogRepository {
  load(): Promise<Catalog>;
  saveCategory(input: Omit<ProductCategory, 'id'>, id?: string, expected?: ProductCategory): Promise<ProductCategory>;
  moveCategory(id: string, direction: 'up' | 'down'): Promise<void>;
  deleteCategory(id: string, expected: ProductCategory): Promise<void>;
  watch?(onCatalog: (catalog: Catalog) => void, onError: (error?: unknown) => void): () => void;
  setSaved(productId: string, saved: boolean): Promise<void>;
  recordUse(productId: string): Promise<void>;
  createProduct(input: ProductInput, reason: string): Promise<Product>;
  updateProduct(id: string, input: ProductInput, reason: string, expectedUpdatedAt: string): Promise<Product>;
  addIdentifier(productId: string, input: IdentifierInput): Promise<Identifier>;
  correctIdentifier(id: string, input: IdentifierInput, expectedUpdatedAt: string): Promise<Identifier>;
  verifyIdentifier(id: string, input: VerificationInput, expectedUpdatedAt: string): Promise<Identifier>;
  retireIdentifier(id: string, reason: string, expectedUpdatedAt: string): Promise<void>;
  getHistory(productId: string): Promise<ChangeEvent[]>;
  exportBackup(): Promise<Backup>;
  previewBackup(value: unknown, preserveVerification: boolean): Promise<ImportPlan>;
  importBackup(value: unknown, preserveVerification: boolean, acknowledged: boolean): Promise<ImportPlan>;
}
export class LocalCatalogRepository implements CatalogRepository {
  private db: CatalogDatabase;
  constructor(name = 'cashier-assistant', options: { seedDemo?: boolean } = {}) { this.db = new CatalogDatabase(name, options.seedDemo ?? true); }
  async load(): Promise<Catalog> {
    return this.db.transaction('r', this.db.categories, this.db.products, this.db.identifiers, this.db.sources, this.db.saved_products, async () => ({
      categories: await this.db.categories.toArray(), products: await this.db.products.toArray(), identifiers: await this.db.identifiers.toArray(), sources: await this.db.sources.toArray(), saved: await this.db.saved_products.toArray(),
    }));
  }
  watch(onCatalog: (catalog: Catalog) => void, onError: (error?: unknown) => void): () => void {
    const subscription = liveQuery(() => this.load()).subscribe({ next: onCatalog, error: onError });
    return () => subscription.unsubscribe();
  }
  async setSaved(productId: string, saved: boolean): Promise<void> {
    await this.db.transaction('rw', this.db.products, this.db.saved_products, async () => {
      if (!await this.db.products.get(productId)) throw new Error('Product no longer exists.');
      const previous = await this.db.saved_products.get(productId);
      await this.db.saved_products.put({ productId, ...previous, savedAt: saved ? previous?.savedAt ?? new Date().toISOString() : undefined, useCount: previous?.useCount ?? 0 });
    });
  }
  async recordUse(productId: string): Promise<void> {
    await this.db.transaction('rw', this.db.products, this.db.saved_products, async () => {
      if (!await this.db.products.get(productId)) throw new Error('Product no longer exists.');
      const previous = await this.db.saved_products.get(productId);
      await this.db.saved_products.put({ productId, ...previous, lastUsedAt: new Date().toISOString(), useCount: (previous?.useCount ?? 0) + 1 });
    });
  }
  private timestamp(previous?: string): string {
    return new Date(Math.max(Date.now(), previous ? Date.parse(previous) + 1 : 0)).toISOString();
  }
  private checkRevision(entity: Product | Identifier, expected: string): void {
    if (entity.updatedAt !== expected) throw new Error('This record changed in another operation. Reload its details before editing.');
  }
  private async appendEvent(entityType: ChangeEvent['entityType'], entityId: string, eventType: string, before: unknown, after: unknown, reason: string, timestamp: string): Promise<void> {
    await this.db.events.add({ id: newId(), entityType, entityId, eventType, before, after, reason, timestamp });
  }
  private async source(input: IdentifierInput['source'], timestamp: string): Promise<Source> {
    const source: Source = { ...validateEvidence(input), id: newId(), capturedAt: timestamp };
    await this.db.sources.add(source);
    return source;
  }
  private async assertNoConflict(candidate: Pick<Identifier, 'id' | 'code' | 'type'>): Promise<void> {
    const conflicts = identifierConflicts(candidate, await this.db.identifiers.toArray());
    if (conflicts.length) throw new Error('Duplicate identifier association. Review the existing product and retire any incorrect association first.');
  }
  async createProduct(input: ProductInput, reason: string): Promise<Product> {
    const validated = validateProduct(input); const rationale = requireReason(reason);
    const initialPlu = input.plu ? validateIdentifierInput({ code: input.plu, type: 'PLU', source: { type: 'manual', attribution: 'PLU entered manually when adding the product.' }, reason: 'Initial PLU; not independently checked.' }) : undefined;
    return this.db.transaction('rw', this.db.categories, this.db.products, this.db.identifiers, this.db.sources, this.db.events, async () => {
      requireCategory(validated.categoryId, await this.db.categories.toArray());
      if (validated.categoryId && (await this.db.categories.get(validated.categoryId))?.level !== 'department') throw new Error('Choose a department.');
      const timestamp = this.timestamp();
      const product: Product = { ...validated, id: newId(), createdAt: timestamp, updatedAt: timestamp, isDemo: false };
      await this.db.products.add(product);
      await this.appendEvent('product', product.id, 'created', undefined, product, rationale, timestamp);
      if (initialPlu) {
        const identifier: Identifier = { id: newId(), productId: product.id, code: initialPlu.code, type: 'PLU', verificationStatus: 'unverified', isActive: true, createdAt: timestamp, updatedAt: timestamp };
        await this.assertNoConflict(identifier);
        identifier.sourceId = (await this.source(initialPlu.source, timestamp)).id;
        await this.db.identifiers.add(identifier);
        await this.appendEvent('identifier', identifier.id, 'created', undefined, identifier, initialPlu.reason, timestamp);
      }
      return product;
    });
  }
  async updateProduct(id: string, input: ProductInput, reason: string, expectedUpdatedAt: string): Promise<Product> {
    const validated = validateProduct(input); const rationale = requireReason(reason);
    return this.db.transaction('rw', this.db.categories, this.db.products, this.db.identifiers, this.db.events, async () => {
      const previous = await this.db.products.get(id);
      if (!previous) throw new Error('Product no longer exists.');
      this.checkRevision(previous, expectedUpdatedAt);
      requireCategory(validated.categoryId, await this.db.categories.toArray());
      if (validated.categoryId && (await this.db.categories.get(validated.categoryId))?.level !== 'department') throw new Error('Choose a department.');
      const timestamp = this.timestamp(previous.updatedAt);
      const product: Product = { ...previous, ...validated, updatedAt: timestamp };
      await this.db.products.put(product);
      await this.appendEvent('product', id, 'edited', previous, product, rationale, timestamp);
      // Metadata can change product identity. Retain original verification in history and require review.
      const identityFields = ['name', 'brand', 'keywords', 'photoDataUrl', 'barcodePhotoDataUrl'] as const;
      const identityChanged = identityFields.some(key => JSON.stringify(previous[key]) !== JSON.stringify(product[key]));
      for (const identifier of identityChanged ? await this.db.identifiers.where('productId').equals(id).toArray() : []) {
        if (!identifier.isActive || !['packaging_verified', 'pos_verified'].includes(identifier.verificationStatus)) continue;
        const changed: Identifier = { ...identifier, verificationStatus: 'unverified', verifiedAt: undefined, verificationMethod: undefined, updatedAt: this.timestamp(identifier.updatedAt) };
        await this.db.identifiers.put(changed);
        await this.appendEvent('identifier', identifier.id, 'verification_reset', identifier, changed, `Product metadata edited: ${rationale}`, changed.updatedAt);
      }
      return product;
    });
  }
  async addIdentifier(productId: string, input: IdentifierInput): Promise<Identifier> {
    const validated = validateIdentifierInput(input);
    return this.db.transaction('rw', this.db.products, this.db.identifiers, this.db.sources, this.db.events, async () => {
      if (!await this.db.products.get(productId)) throw new Error('Product no longer exists.');
      const timestamp = this.timestamp();
      const identifier: Identifier = { id: newId(), productId, code: validated.code, type: validated.type, verificationStatus: 'unverified', isActive: true, createdAt: timestamp, updatedAt: timestamp };
      await this.assertNoConflict(identifier);
      identifier.sourceId = (await this.source(validated.source, timestamp)).id;
      await this.db.identifiers.add(identifier);
      await this.appendEvent('identifier', identifier.id, 'created', undefined, identifier, validated.reason, timestamp);
      return identifier;
    });
  }
  async correctIdentifier(id: string, input: IdentifierInput, expectedUpdatedAt: string): Promise<Identifier> {
    const validated = validateIdentifierInput(input);
    return this.db.transaction('rw', this.db.identifiers, this.db.sources, this.db.events, async () => {
      const previous = await this.db.identifiers.get(id);
      if (!previous || !previous.isActive) throw new Error('Active identifier no longer exists.');
      this.checkRevision(previous, expectedUpdatedAt);
      const timestamp = this.timestamp(previous.updatedAt);
      const identifier: Identifier = { ...previous, code: validated.code, type: validated.type, verificationStatus: 'unverified', verifiedAt: undefined, verificationMethod: undefined, updatedAt: timestamp };
      await this.assertNoConflict(identifier);
      identifier.sourceId = (await this.source(validated.source, timestamp)).id;
      await this.db.identifiers.put(identifier);
      await this.appendEvent('identifier', id, 'corrected', previous, identifier, validated.reason, timestamp);
      return identifier;
    });
  }
  async verifyIdentifier(id: string, input: VerificationInput, expectedUpdatedAt: string): Promise<Identifier> {
    const reason = requireReason(input.reason); const evidence = validateEvidence(input.source);
    if (!['unverified', 'packaging_verified', 'pos_verified', 'rejected'].includes(input.status)) throw new Error('Choose a supported verification status.');
    return this.db.transaction('rw', this.db.products, this.db.identifiers, this.db.sources, this.db.events, async () => {
      const previous = await this.db.identifiers.get(id);
      if (!previous || !previous.isActive) throw new Error('Active identifier no longer exists.');
      this.checkRevision(previous, expectedUpdatedAt);
      const product = await this.db.products.get(previous.productId);
      if (!product) throw new Error('Product no longer exists.');
      const verified = ['packaging_verified', 'pos_verified'].includes(input.status);
      if (verified) {
        if (product.isDemo) throw new Error('Fictional demo products cannot be verified.');
        if (!input.confirmed) throw new Error('Confirm that you independently checked the exact product and code.');
        const validation = validateIdentifier(previous.code, previous.type);
        if (!validation.valid) throw new Error(validation.message);
        if (previous.type === 'OTHER') throw new Error('Establish a supported code type before verification.');
        if (input.status === 'packaging_verified' && evidence.type !== 'packaging') throw new Error('Packaging verification requires a packaging source.');
        await this.assertNoConflict(previous);
      }
      const timestamp = this.timestamp(previous.updatedAt);
      const identifier: Identifier = { ...previous, verificationStatus: input.status, verifiedAt: verified ? timestamp : undefined, verificationMethod: verified ? reason : undefined, sourceId: (await this.source(evidence, timestamp)).id, updatedAt: timestamp };
      await this.db.identifiers.put(identifier);
      await this.appendEvent('identifier', id, 'verification_changed', previous, identifier, reason, timestamp);
      return identifier;
    });
  }
  async retireIdentifier(id: string, reason: string, expectedUpdatedAt: string): Promise<void> {
    const rationale = requireReason(reason);
    await this.db.transaction('rw', this.db.identifiers, this.db.events, async () => {
      const previous = await this.db.identifiers.get(id);
      if (!previous || !previous.isActive) throw new Error('Active identifier no longer exists.');
      this.checkRevision(previous, expectedUpdatedAt);
      const timestamp = this.timestamp(previous.updatedAt);
      const identifier = { ...previous, isActive: false, updatedAt: timestamp };
      await this.db.identifiers.put(identifier);
      await this.appendEvent('identifier', id, 'retired', previous, identifier, rationale, timestamp);
    });
  }
  async getHistory(productId: string): Promise<ChangeEvent[]> {
    return this.db.transaction('r', this.db.identifiers, this.db.events, async () => {
      const ids = [productId, ...(await this.db.identifiers.where('productId').equals(productId).toArray()).map(identifier => identifier.id)];
      return (await this.db.events.where('entityId').anyOf(ids).toArray()).sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id));
    });
  }
  private async snapshot(): Promise<Backup> {
    return { format: 'cashier-assistant-backup', version: 2, exportedAt: new Date().toISOString(), categories: await this.db.categories.toArray(), products: await this.db.products.toArray(), identifiers: await this.db.identifiers.toArray(), sources: await this.db.sources.toArray(), events: await this.db.events.toArray(), saved: await this.db.saved_products.toArray() };
  }
  async exportBackup(): Promise<Backup> {
    return this.db.transaction('r', [this.db.categories, this.db.products, this.db.identifiers, this.db.sources, this.db.events, this.db.saved_products], () => this.snapshot());
  }
  async previewBackup(value: unknown, preserveVerification: boolean): Promise<ImportPlan> {
    const { parseBackup, planBackup } = await import('../imports/backup');
    return planBackup(parseBackup(value), await this.exportBackup(), preserveVerification);
  }
  async importBackup(value: unknown, preserveVerification: boolean, acknowledged: boolean): Promise<ImportPlan> {
    if (!acknowledged) throw new Error('Review and acknowledge the import preview before saving.');
    const { parseBackup, planBackup } = await import('../imports/backup');
    const incoming = parseBackup(value);
    return this.db.transaction('rw', [this.db.categories, this.db.products, this.db.identifiers, this.db.sources, this.db.events, this.db.saved_products], async () => {
      // Recompute in the write transaction so edits after preview cannot be overwritten.
      const plan = planBackup(incoming, await this.snapshot(), preserveVerification);
      if (plan.errors.length) throw new Error(plan.errors[0]);
      await this.db.categories.bulkAdd(plan.additions.categories);
      for (const category of plan.starterCategories) await this.db.categories.put(category);
      await this.db.products.bulkAdd(plan.additions.products);
      for (const product of plan.demoProducts) await this.db.products.put(product);
      await this.db.sources.bulkAdd(plan.additions.sources);
      await this.db.events.bulkAdd(plan.additions.events);
      const departments = await this.db.categories.toArray();
      for (const before of [...plan.additions.products, ...plan.demoProducts]) {
        const departmentId = categoryPath(departments, before.categoryId)[0]?.id;
        if (departmentId === before.categoryId) continue;
        const after = { ...before, categoryId: departmentId };
        await this.db.products.put(after);
        await this.appendEvent('product', before.id, 'department_migrated', before, after, 'Kept the department; earlier classification is preserved here.', this.timestamp());
      }
      await this.db.saved_products.bulkAdd(plan.additions.saved);
      for (const original of [...plan.additions.identifiers, ...plan.demoIdentifiers]) {
        const product = incoming.products.find(record => record.id === original.productId)!;
        const valid = validateIdentifier(original.code, original.type).valid && original.type !== 'OTHER';
        const source = incoming.sources.find(record => record.id === original.sourceId);
        const claimedVerified = ['packaging_verified', 'pos_verified'].includes(original.verificationStatus);
        const trusted = preserveVerification && !product.isDemo && valid && !!source && source.type !== 'open_food_facts' && !!original.verifiedAt && !!original.verificationMethod?.trim();
        const reset = claimedVerified && !trusted;
        const identifier: Identifier = reset ? { ...original, verificationStatus: 'unverified', verifiedAt: undefined, verificationMethod: undefined, updatedAt: this.timestamp(original.updatedAt) } : original;
        if (plan.demoIdentifiers.some(demo => demo.id === identifier.id)) await this.db.identifiers.put(identifier); else await this.db.identifiers.add(identifier);
        if (reset) await this.appendEvent('identifier', identifier.id, 'import_verification_reset', original, identifier, 'Backup imported without trusted valid personal verification; original state retained here.', identifier.updatedAt);
      }
      for (const product of [...plan.additions.products, ...plan.demoProducts]) await this.appendEvent('product', product.id, 'backup_imported', undefined, product, preserveVerification ? 'Explicitly trusted personal backup restore; existing history preserved.' : 'Backup imported for personal review.', this.timestamp(product.updatedAt));
      return plan;
    });
  }
  async saveCategory(input: Omit<ProductCategory, 'id'>, id?: string, expected?: ProductCategory): Promise<ProductCategory> {
    if (input.level !== 'department' || input.parentId !== null) throw new Error('Only departments can be added or edited.');
    return this.db.transaction('rw', this.db.categories, this.db.events, async () => {
      const all = await this.db.categories.toArray(); const previous = id ? all.find(node => node.id === id) : undefined;
      if (id && (!previous || !expected || JSON.stringify(previous) !== JSON.stringify(expected))) throw new Error('This department changed. Reopen it before editing.');
      const node: ProductCategory = { id: id ?? newId(), name: input.name.trim(), parentId: input.parentId, level: input.level, sortOrder: input.sortOrder };
      validateHierarchy([...all.filter(category => category.id !== node.id), node]);
      if (previous) await this.db.categories.put(node); else await this.db.categories.add(node);
      await this.appendEvent('category', node.id, previous ? 'category_edited' : 'category_created', previous, node, 'Personal department management.', this.timestamp());
      return node;
    });
  }
  async moveCategory(id: string, direction: 'up' | 'down'): Promise<void> {
    if (!['up', 'down'].includes(direction)) throw new Error('Choose up or down.');
    await this.db.transaction('rw', this.db.categories, this.db.events, async () => {
      const all = await this.db.categories.toArray(); const current = all.find(node => node.id === id);
      if (!current) throw new Error('Department no longer exists.');
      if (current.level !== 'department') throw new Error('Only departments can be reordered.');
      const siblings = childrenOf(all, current.parentId); const index = siblings.findIndex(node => node.id === id); const nextIndex = index + (direction === 'up' ? -1 : 1);
      if (nextIndex < 0 || nextIndex >= siblings.length) return;
      [siblings[index], siblings[nextIndex]] = [siblings[nextIndex], siblings[index]];
      for (let order = 0; order < siblings.length; order++) {
        const before = siblings[order]; if (before.sortOrder === order) continue;
        const after = { ...before, sortOrder: order }; await this.db.categories.put(after);
        await this.appendEvent('category', before.id, 'category_reordered', before, after, 'Changed the order of departments.', this.timestamp());
      }
    });
  }
  async deleteCategory(id: string, expected: ProductCategory): Promise<void> {
    await this.db.transaction('rw', this.db.categories, this.db.products, this.db.events, async () => {
      const previous = await this.db.categories.get(id);
      if (!previous || JSON.stringify(previous) !== JSON.stringify(expected)) throw new Error('This department changed. Reopen it before removing it.');
      if (previous.level !== 'department') throw new Error('Only departments can be removed.');
      const all = await this.db.categories.toArray();
      if ((await this.db.products.toArray()).some(product => matchesClassification(product, id, all))) throw new Error('Move all products before removing this department.');
      // Retired hierarchy definitions have no user controls. Remove them together
      // with an empty department, keeping every original definition in history.
      for (const node of all.filter(node => categoryPath(all, node.id)[0]?.id === id).reverse()) {
        await this.db.categories.delete(node.id);
        await this.appendEvent('category', node.id, 'category_removed', node, undefined, 'Removed an empty department and its earlier classification definitions.', this.timestamp());
      }
    });
  }
  close(): void { this.db.close(); }
  async deleteDatabase(): Promise<void> { await this.db.delete(); }
}
export const repository = new LocalCatalogRepository();
