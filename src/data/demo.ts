import type { Product, Identifier, Source, ChangeEvent } from '../domain/models';
const timestamp = '2026-01-01T00:00:00.000Z';
const definitions = [
  ['Demo Oat Drink', 'Fictional Meadow', 'Drinks', 'Original', '1 L', 'Cream carton with a green band', ['oat', 'milk alternative'], '000001'],
  ['Demo Oat Drink', 'Fictional Meadow', 'Drinks', 'Unsweetened', '1 L', 'Cream carton with a blue band', ['oat', 'milk alternative'], '000002'],
  ['Demo Oat Drink', 'Fictional Meadow', 'Drinks', 'Original', '500 mL', 'Small cream carton with a green band', ['oat', 'milk alternative'], '000003'],
  ['Demo Chickpeas', 'Fictional Pantry', 'Pantry', 'No salt added', '540 mL', 'Yellow can with a white lid', ['beans', 'legumes'], '000004'],
  ['Demo Citrus Soda', 'Fictional Spark', 'Drinks', 'Lemon', '330 mL', 'Slim yellow can', ['citrus', 'fizzy'], '000005'],
  ['Demo Green Pear', 'Fictional Orchard', 'Produce', 'Loose', 'Each', 'Green fruit; no real product photograph', ['fruit', 'fresh'], '000006'],
] as const;
export const demoProducts: Product[] = definitions.map(([name, brand, category, variant, size, packaging, keywords], index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, name, brand, category, variant, size, packaging,
  keywords: [...keywords], isDemo: true, createdAt: timestamp, updatedAt: timestamp,
}));
export const demoSource: Source = { id: '00000000-0000-4000-9000-000000000001', type: 'manual', attribution: 'Fictional demonstration data created for Cashier Assistant. No retailer association.', capturedAt: timestamp };
export const demoIdentifiers: Identifier[] = definitions.map((definition, index) => ({
  id: `00000000-0000-4000-a000-${String(index + 1).padStart(12, '0')}`, productId: demoProducts[index].id,
  code: definition[7], type: 'STORE_CODE', verificationStatus: 'unverified', sourceId: demoSource.id,
  isActive: true, createdAt: timestamp, updatedAt: timestamp,
}));
export const demoEvents: ChangeEvent[] = demoProducts.map((product, index) => ({ id: `00000000-0000-4000-b000-${String(index + 1).padStart(12, '0')}`, entityType: 'product', entityId: product.id, eventType: 'created', after: product, reason: 'Fictional demo fixture', timestamp }));
