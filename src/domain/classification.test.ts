import { describe, expect, it } from 'vitest';
import { categoryPath, childrenOf, matchesClassification, migrateClassification, validateHierarchy, UNCATEGORIZED } from './classification';
import { legacySeedCategories as seedCategories, seedCategoryId } from '../data/taxonomy';
import { demoProducts, demoIdentifiers, demoSource, demoEvents } from '../data/demo';
import { searchProducts } from './search';
describe('legacy classification compatibility', () => {
  it('derives ancestors and includes direct and descendant assignments in parent filters', () => {
    const apple = { ...demoProducts[0], categoryId: seedCategoryId('Apples') };
    expect(categoryPath(seedCategories, apple.categoryId).map(node => node.name)).toEqual(['Produce', 'Fruits', 'Apples']);
    expect(matchesClassification(apple, seedCategoryId('Produce'), seedCategories)).toBe(true);
    expect(matchesClassification(apple, seedCategoryId('Fruits'), seedCategories)).toBe(true);
    expect(matchesClassification(apple, seedCategoryId('Vegetables'), seedCategories)).toBe(false);
    expect(matchesClassification({ ...apple, categoryId: seedCategoryId('Produce') }, seedCategoryId('Produce'), seedCategories)).toBe(true);
    expect(matchesClassification({ ...apple, categoryId: undefined }, UNCATEGORIZED, seedCategories)).toBe(true);
    expect(childrenOf(seedCategories, seedCategoryId('Produce')).map(node => node.name)).toEqual(['Fruits', 'Vegetables']);
  });
  it('rejects cycles, missing or wrong-level parents, fourth levels and duplicate sibling names', () => {
    const apple = seedCategories.find(node => node.name === 'Apples')!;
    for (const mutation of [{ ...apple, parentId: apple.id }, { ...apple, parentId: seedCategoryId('Produce') }, { ...apple, parentId: 'missing' }, { ...apple, level: 'category' as const }, { ...apple, id: crypto.randomUUID(), name: ' APPLES ' }]) {
      const entries = mutation.id === apple.id ? seedCategories.filter(node => node.id !== apple.id) : seedCategories;
      expect(() => validateHierarchy([...entries, mutation])).toThrow();
    }
    expect(() => validateHierarchy(seedCategories)).not.toThrow();
    expect(() => validateHierarchy([...seedCategories, { ...apple, id: crypto.randomUUID(), parentId: seedCategoryId('Vegetables') }])).not.toThrow();
  });
  it('keeps name/code/synonym search independent and searches internal ancestor names', () => {
    const products = [{ ...demoProducts[0], categoryId: seedCategoryId('Apples') }, { ...demoProducts[1], categoryId: seedCategoryId('Bread') }];
    expect(searchProducts(products, demoIdentifiers, 'oat', '', seedCategories)).toHaveLength(2);
    expect(searchProducts(products, demoIdentifiers, 'oat', seedCategoryId('Produce'), seedCategories)).toHaveLength(1);
    expect(searchProducts(products, demoIdentifiers, '000001', '', seedCategories)[0].id).toBe(products[0].id);
    expect(searchProducts(products, demoIdentifiers, 'Fruits', '', seedCategories)[0].id).toBe(products[0].id);
    expect(searchProducts([{ ...products[0], categoryId: undefined }], demoIdentifiers, 'oat', UNCATEGORIZED, [])).toHaveLength(1);
  });
  it('migrates local legacy labels deterministically and preserves legacy imported labels and identifiers', () => {
    const local = { ...demoProducts[0], category: 'Personal group' };
    const external = { ...demoProducts[1], category: 'Unknown external label' };
    const publicSource = { ...demoSource, type: 'open_food_facts' as const };
    const migrated = migrateClassification([local, external], [{ ...demoIdentifiers[1], sourceId: publicSource.id }], [publicSource], []);
    expect(migrated.products[0].category).toBe(local.category);
    expect(categoryPath(migrated.categories, migrated.products[0].categoryId).at(-1)?.name).toBe('Personal group');
    expect(migrated.products[1]).toMatchObject({ category: external.category, externalCategories: { labels: ['Unknown external label'], ids: [] } });
    expect(migrated.products[1].categoryId).toBeUndefined();
    expect(migrateClassification([local], [], [], []).products[0].categoryId).toBe(migrated.products[0].categoryId);
    expect(migrateClassification(demoProducts, demoIdentifiers, [demoSource], demoEvents).products.every(product => product.categoryId)).toBe(true);
  });
});
