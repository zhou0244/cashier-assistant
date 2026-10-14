import { categoryPath, matchesClassification } from './classification';
import type { Identifier, Product, ProductCategory } from './models';
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const synonymGroups = [['soda', 'pop', 'soft drink'], ['chickpea', 'chickpeas', 'garbanzo'], ['cilantro', 'coriander']];
export function searchProducts(products: Product[], identifiers: Identifier[], query: string, category = '', categories?: ProductCategory[]): Product[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const codesByProduct = new Map<string, string[]>();
  for (const identifier of identifiers) {
    if (!identifier.isActive || identifier.verificationStatus === 'rejected') continue;
    const codes = codesByProduct.get(identifier.productId) ?? [];
    codes.push(identifier.code);
    codesByProduct.set(identifier.productId, codes);
  }
  return products.filter(product => {
    if (product.archivedAt || (category && (categories !== undefined ? !matchesClassification(product, category, categories) : product.category !== category))) return false;
    const content = normalize([product.name, product.brand, product.category, ...categoryPath(categories ?? [], product.categoryId).map(node => node.name), ...product.keywords].join(' '));
    const codes = codesByProduct.get(product.id) ?? [];
    return terms.every(term => {
      if (/^\d+$/.test(term) && codes.some(code => code.includes(term))) return true;
      const alternatives = synonymGroups.find(group => group.includes(term)) ?? [term];
      return alternatives.some(alternative => content.includes(alternative));
    });
  }).sort((a, b) => {
    const exactA = codesByProduct.get(a.id)?.includes(query.trim()) ?? false;
    const exactB = codesByProduct.get(b.id)?.includes(query.trim()) ?? false;
    return Number(exactB) - Number(exactA) || a.name.localeCompare(b.name);
  });
}
