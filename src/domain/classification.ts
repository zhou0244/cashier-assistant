import type { ProductCategory, Product, Identifier, Source, ChangeEvent } from './models';
import { seedCategories } from '../data/taxonomy';
export const UNCATEGORIZED = '__uncategorized__';
export const categoryNameKey = (name: string) => name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
export function childrenOf(categories: ProductCategory[], parentId: string | null): ProductCategory[] {
  return categories.filter(category => category.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
export function categoryPath(categories: ProductCategory[], categoryId?: string): ProductCategory[] {
  const map = new Map(categories.map(category => [category.id, category])); const path: ProductCategory[] = []; const seen = new Set<string>();
  let node = categoryId ? map.get(categoryId) : undefined;
  while (node) { if (seen.has(node.id)) throw new Error('A category cannot contain itself.'); seen.add(node.id); path.unshift(node); node = node.parentId ? map.get(node.parentId) : undefined; }
  return path;
}
export function matchesClassification(product: Product, selected: string, categories: ProductCategory[]): boolean {
  if (!selected) return true;
  if (selected === UNCATEGORIZED) return !product.categoryId;
  return categoryPath(categories, product.categoryId).some(category => category.id === selected);
}
export function validateHierarchy(categories: ProductCategory[]): void {
  const map = new Map(categories.map(category => [category.id, category]));
  if (map.size !== categories.length) throw new Error('Category IDs must be unique.');
  const siblingNames = new Set<string>();
  for (const node of categories) {
    if (!node.name.trim()) throw new Error('A department name is required.');
    if (!Number.isInteger(node.sortOrder) || node.sortOrder < 0) throw new Error('Choose a valid department position.');
    const key = `${node.parentId ?? 'root'}:${categoryNameKey(node.name)}`;
    if (siblingNames.has(key)) throw new Error('That name already exists under the same parent.'); siblingNames.add(key);
    const path = categoryPath(categories, node.id);
    const expected = { department: null, category: 'department', subcategory: 'category' }[node.level];
    if (expected === undefined) throw new Error('Choose department, category or subcategory.');
    if (expected === null ? node.parentId !== null : !node.parentId || map.get(node.parentId)?.level !== expected) throw new Error('Departments have no parent; categories belong to departments; subcategories belong to categories.');
    if (path.length !== { department: 1, category: 2, subcategory: 3 }[node.level]) throw new Error('Only three category levels are allowed.');
  }
}
export function requireCategory(categoryId: string | undefined, categories: ProductCategory[]): void {
  if (categoryId && !categories.some(category => category.id === categoryId)) throw new Error('That department no longer exists. Choose a current department.');
}
export function migrateClassification(products: Product[], identifiers: Identifier[], sources: Source[], events: ChangeEvent[], taxonomy = seedCategories): { products: Product[]; categories: ProductCategory[] } {
  const categories = taxonomy.map(node => ({ ...node }));
  const publicIds = new Set(events.filter(event => event.eventType === 'public_imported').map(event => event.entityId));
  const publicSources = new Set(sources.filter(source => source.type === 'open_food_facts').map(source => source.id));
  for (const identifier of identifiers) if (identifier.sourceId && publicSources.has(identifier.sourceId)) publicIds.add(identifier.productId);
  const migrated = products.map(product => {
    if (product.categoryId) return { ...product };
    if (product.externalCategories || publicIds.has(product.id)) {
      const raw = events.find(event => event.entityId === product.id && event.eventType === 'public_imported')?.before as { product?: { categories_tags?: string[]; categories?: string } } | undefined;
      const externalCategories = product.externalCategories ?? { source: 'open_food_facts' as const, labels: (raw?.product?.categories ?? product.category ?? '').split(',').map(label => label.trim()).filter(Boolean), ids: raw?.product?.categories_tags ?? [] };
      return { ...product, externalCategories, categoryId: undefined };
    }
    if (!product.category?.trim()) return { ...product };
    const name = product.category.trim(); const matches = categories.filter(node => categoryNameKey(node.name) === categoryNameKey(name));
    let node = matches.length === 1 ? matches[0] : undefined;
    if (!node) {
      const key = categoryNameKey(name);
      // Stable IDs for legacy departments make repeated old-backup imports deterministic.
      let hash = 2166136261; for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
      let suffix = hash.toString(16).padStart(12, '0');
      while (categories.some(node => node.id === `20000000-0000-4000-8000-${suffix}`)) suffix = (++hash >>> 0).toString(16).padStart(12, '0');
      node = { id: `20000000-0000-4000-8000-${suffix}`, name, parentId: null, level: 'department', sortOrder: childrenOf(categories, null).length };
      categories.push(node);
    }
    return { ...product, categoryId: node.id };
  });
  validateHierarchy(categories);
  return { products: migrated, categories };
}
