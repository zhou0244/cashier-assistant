import type { ProductCategory } from '../domain/models';
const tree: [string, [string, string[]][]][] = [
  ['Bakery', [['Bread', ['Sourdough', 'Baguettes', 'White Bread']], ['Pastries', ['Croissants', 'Muffins', 'Danishes']]]],
  ['Produce', [['Fruits', ['Apples', 'Citrus', 'Berries']], ['Vegetables', ['Leafy Greens', 'Root Vegetables']]]],
  ['Dairy & Eggs', [['Milk', ['Dairy Milk', 'Plant-Based Alternatives']], ['Eggs', []]]],
  ['Frozen Foods', [['Frozen Meals', ['Pizza', 'Ready Meals']]]],
  ['Pantry', [['Pasta', ['Dry Pasta', 'Fresh Pasta']], ['Canned Foods', []]]],
  ['Snacks & Confectionery', [['Candy', ['Gummies', 'Hard Candy']]]],
  ['Household', [['Cleaning', ['Surface Cleaners', 'Dishwashing']]]],
  ['Drinks', [['Soft Drinks', []]]],
];
let sequence = 0;
const id = () => `10000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
export const legacySeedCategories: ProductCategory[] = [];
for (const [name, categories] of tree) {
  const department = { id: id(), name, parentId: null, level: 'department' as const, sortOrder: legacySeedCategories.filter(c => c.level === 'department').length };
  legacySeedCategories.push(department);
  categories.forEach(([name, subcategories], sortOrder) => {
    const category = { id: id(), name, parentId: department.id, level: 'category' as const, sortOrder };
    legacySeedCategories.push(category);
    subcategories.forEach((name, sortOrder) => legacySeedCategories.push({ id: id(), name, parentId: category.id, level: 'subcategory', sortOrder }));
  });
}
// Keep original IDs and definitions solely for older database/backup compatibility.
export const seedCategories = legacySeedCategories.filter(node => node.level === 'department');
export function seedCategoryId(name: string): string { return legacySeedCategories.find(category => category.name === name)!.id; }
