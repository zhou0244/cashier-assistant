import { validatePhoto, MAX_PHOTO_DATA_LENGTH } from '../domain/photo';
import { migrateClassification, validateHierarchy, requireCategory } from '../domain/classification';
import { seedCategories } from '../data/taxonomy';
import { z } from 'zod';
import type { Product, Identifier, Source, ChangeEvent, SavedProduct, ProductCategory } from '../domain/models';
import { equivalentCode, similarProducts } from '../domain/maintenance';
import { validateIdentifier } from '../domain/identifier-policy';
import { demoProducts, demoIdentifiers } from '../data/demo';
const uuid = z.string().uuid();
const date = z.iso.datetime();
const optionalText = z.string().optional();
const url = z.string().url().refine(value => ['https:', 'http:'].includes(new URL(value).protocol), 'URL must use HTTP or HTTPS').optional();
const photoSchema = z.string().max(MAX_PHOTO_DATA_LENGTH).superRefine((value, ctx) => { try { validatePhoto(value); } catch { ctx.addIssue({ code: 'custom', message: 'Invalid local photo.' }); } }).optional();
// Keep legacy source/category metadata readable; no external import feature remains.
const productSchema = z.object({ id: uuid, name: z.string().min(1), brand: optionalText, category: optionalText, categoryId: uuid.optional(), externalCategories: z.object({ source: z.literal('open_food_facts'), labels: z.array(z.string()), ids: z.array(z.string()) }).strict().optional(), variant: optionalText, size: optionalText, packaging: optionalText, keywords: z.array(z.string()), photoDataUrl: photoSchema, barcodePhotoDataUrl: photoSchema, imageUrl: url, imageAttribution: optionalText, isDemo: z.boolean().optional(), createdAt: date, updatedAt: date, archivedAt: date.optional() }).strict();
const identifierSchema = z.object({ id: uuid, productId: uuid, code: z.string().min(1), type: z.enum(['UPC_A','EAN_13','EAN_8','PLU','STORE_CODE','OTHER']), verificationStatus: z.enum(['unverified','packaging_verified','pos_verified','rejected']), verifiedAt: date.optional(), verificationMethod: optionalText, sourceId: uuid.optional(), isActive: z.boolean(), createdAt: date, updatedAt: date }).strict();
const sourceSchema = z.object({ id: uuid, type: z.enum(['open_food_facts','packaging','authorized_reference','manual']), externalUrl: url, externalId: optionalText, attribution: optionalText, capturedAt: date }).strict();
const eventSchema = z.object({ id: uuid, entityType: z.enum(['product','identifier','category']), entityId: uuid, eventType: z.string().min(1), before: z.unknown().optional(), after: z.unknown().optional(), reason: optionalText, timestamp: date }).strict();
const savedSchema = z.object({ productId: uuid, savedAt: date.optional(), lastUsedAt: date.optional(), useCount: z.number().int().nonnegative() }).strict();
const categorySchema = z.object({ id: uuid, name: z.string().min(1), parentId: uuid.nullable(), level: z.enum(['department', 'category', 'subcategory']), sortOrder: z.number().int().nonnegative() }).strict();
const baseSchema = z.object({ format: z.literal('cashier-assistant-backup'), exportedAt: date, products: z.array(productSchema), identifiers: z.array(identifierSchema), sources: z.array(sourceSchema), events: z.array(eventSchema), saved: z.array(savedSchema) });
const backupSchema = z.union([baseSchema.extend({ version: z.literal(1) }).strict(), baseSchema.extend({ version: z.literal(2), categories: z.array(categorySchema) }).strict()]);
export interface Backup { format: 'cashier-assistant-backup'; version: 2; exportedAt: string; categories: ProductCategory[]; products: Product[]; identifiers: Identifier[]; sources: Source[]; events: ChangeEvent[]; saved: SavedProduct[] }
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
export function parseBackup(value: unknown): Backup {
  const result = backupSchema.safeParse(value);
  if (!result.success) throw new Error(`Invalid backup: ${result.error.issues[0]?.path.join('.')} ${result.error.issues[0]?.message}`);
  const raw = result.data;
  const backup: Backup = raw.version === 1 ? { ...raw, ...migrateClassification(raw.products, raw.identifiers, raw.sources, raw.events), version: 2 } : raw;
  validateHierarchy(backup.categories);
  for (const product of backup.products) requireCategory(product.categoryId, backup.categories);
  for (const [name, records, key] of [['categories', backup.categories, 'id'], ['products', backup.products, 'id'], ['identifiers', backup.identifiers, 'id'], ['sources', backup.sources, 'id'], ['events', backup.events, 'id'], ['saved', backup.saved, 'productId']] as const) {
    const ids = records.map(record => (record as unknown as Record<string, unknown>)[key]);
    if (new Set(ids).size !== ids.length) throw new Error(`Duplicate IDs within backup ${name}.`);
  }
  const productIds = new Set(backup.products.map(product => product.id)); const identifierIds = new Set(backup.identifiers.map(identifier => identifier.id)); const sourceIds = new Set(backup.sources.map(source => source.id));
  for (const identifier of backup.identifiers) {
    if (!productIds.has(identifier.productId) || identifier.sourceId && !sourceIds.has(identifier.sourceId)) throw new Error('Backup contains an identifier with missing product/source.');
  }
  if (backup.saved.some(saved => !productIds.has(saved.productId))) throw new Error('Backup contains saved items with missing products.');
  const categoryIds = new Set(backup.categories.map(node => node.id));
  const removedCategories = new Set(backup.events.filter(event => event.entityType === 'category' && event.eventType === 'category_removed').map(event => event.entityId));
  if (backup.events.some(event => !(event.entityType === 'product' ? productIds : event.entityType === 'identifier' ? identifierIds : new Set([...categoryIds, ...removedCategories])).has(event.entityId))) throw new Error('Backup contains history with missing entities.');
  return backup;
}
export function readBackupJson(text: string): Backup {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('Backup exceeds the 50 MB personal-import limit.');
  try { return parseBackup(JSON.parse(text)); } catch (error) { if (error instanceof SyntaxError) throw new Error('File is not valid JSON.'); throw error; }
}
export function sameRecord(a: unknown, b: unknown): boolean {
  const stable = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
    return value;
  };
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
}
export interface ImportPlan { additions: Omit<Backup, 'format' | 'version' | 'exportedAt'>; starterCategories: ProductCategory[]; demoProducts: Product[]; demoIdentifiers: Identifier[]; errors: string[]; warnings: string[]; skipped: number }
export function planBackup(incoming: Backup, existing: Backup, preserveVerification: boolean): ImportPlan {
  const plan: ImportPlan = { additions: { categories: [], products: [], identifiers: [], sources: [], events: [], saved: [] }, starterCategories: [], demoProducts: [], demoIdentifiers: [], errors: [], warnings: [], skipped: 0 };
  for (const table of ['categories', 'products', 'identifiers', 'sources', 'events', 'saved'] as const) {
    const key = table === 'saved' ? 'productId' : 'id';
    for (const record of incoming[table]) {
      const id = (record as unknown as Record<string, unknown>)[key];
      const previous = existing[table].find(item => (item as unknown as Record<string, unknown>)[key] === id);
      if (previous && sameRecord(previous, record)) { plan.skipped++; continue; }
      if (previous) {
        // Only pristine built-in demo placeholders may be restored over, with explicit personal-backup trust.
        if (preserveVerification && table === 'categories' && seedCategories.some(seed => sameRecord(seed, previous))) { plan.starterCategories.push(record as ProductCategory); continue; }
        if (preserveVerification && table === 'products' && (record as Product).isDemo && demoProducts.some(demo => sameRecord(demo, (() => { const { categoryId, externalCategories, ...legacy } = previous as Product; return legacy; })()))) { plan.demoProducts.push(record as Product); continue; }
        if (preserveVerification && table === 'identifiers' && incoming.products.some(product => product.id === (record as Identifier).productId && product.isDemo) && demoIdentifiers.some(demo => sameRecord(demo, previous))) { plan.demoIdentifiers.push(record as Identifier); continue; }
        plan.errors.push(`Conflicting ${table} ID ${String(id)}. Existing data will not be overwritten.`); continue;
      }
      // Tables are handled generically here; the strictly parsed input preserves each record's type.
      (plan.additions[table] as unknown[]).push(record);
    }
  }
  const mergedCategories = [...existing.categories.filter(node => !plan.starterCategories.some(replacement => replacement.id === node.id)), ...plan.additions.categories, ...plan.starterCategories];
  try { validateHierarchy(mergedCategories); for (const product of [...plan.additions.products, ...plan.demoProducts]) requireCategory(product.categoryId, mergedCategories); }
  catch (error) { plan.errors.push(error instanceof Error ? error.message : 'Invalid category hierarchy.'); }
  if (plan.starterCategories.length) plan.warnings.push('Restoring saved department changes over unchanged starting departments. Existing department edits will not be replaced.');
  const identifiers = [...existing.identifiers.filter(identifier => !plan.demoIdentifiers.some(demo => demo.id === identifier.id)), ...plan.additions.identifiers, ...plan.demoIdentifiers];
  for (const identifier of [...plan.additions.identifiers, ...plan.demoIdentifiers]) {
    if (identifier.isActive && identifiers.some(other => other.id !== identifier.id && other.isActive && equivalentCode(identifier, other))) plan.errors.push(`Duplicate active code ${identifier.code}. Review the association before importing.`);
    if (!validateIdentifier(identifier.code, identifier.type).valid) plan.warnings.push(`Invalid code ${identifier.code}; retained for review with barcode/copy disabled.`);
  }
  for (const product of plan.additions.products) {
    if (similarProducts(product, [...existing.products, ...plan.additions.products], product.id).length) plan.warnings.push(`Similar product: ${product.name} / ${product.brand ?? 'no brand'}.`);
  }
  if (plan.demoProducts.length || plan.demoIdentifiers.length) plan.warnings.push('Restoring modified demo records over untouched built-in placeholders. Existing user edits are never overwritten.');
  return plan;
}
