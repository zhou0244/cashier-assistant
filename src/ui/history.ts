import type { Source, IdentifierType } from '../domain/models';
import { statusLabels } from '../domain/models';
import { identifierTypeLabels } from '../domain/identifier-policy';
import { displayDate, plainMessage } from './words';
export const eventLabels: Record<string, string> = {
  created: 'Added', edited: 'Product details changed', corrected: 'Code corrected', verification_reset: 'Code needs checking again',
  verification_changed: 'Code check updated', retired: 'Stopped using code', backup_imported: 'Added from backup',
  import_verification_reset: 'Backup code needs checking', public_imported: 'Saved online suggestion', classification_migrated: 'Earlier classification preserved', department_migrated: 'Department kept',
};
const fieldLabels: Record<string, string> = {
  categoryId: 'Product group', externalCategories: 'Original online groups', labels: 'Original labels', ids: 'Original category codes', source: 'Source', name: 'Product name', product_name: 'Online product name', product_name_en: 'Online English name', brand: 'Brand', brands: 'Online brand',
  size: 'Size', quantity: 'Online size', category: 'Original classification', categories: 'Earlier online groups',
  keywords: 'Search words', _keywords: 'Online search words', packaging: 'Packaging description',
  code: 'Code', requestedCode: 'Number searched', type: 'Code type', verificationStatus: 'Check status', verifiedAt: 'Checked on',
  verificationMethod: 'How it was checked', isActive: 'In use', isDemo: 'Made-up example', createdAt: 'Added on', updatedAt: 'Changed on',
  archivedAt: 'Removed from browsing on', capturedAt: 'Details saved on', imageUrl: 'Photo link', imageAttribution: 'Photo credit',
  image_front_url: 'Online photo link', image_front_small_url: 'Online small photo link', attribution: 'Credit', externalUrl: 'Source website', externalId: 'Number in original listing',
};
export interface HistoryField { label: string; value: string; source?: Source; codeType?: IdentifierType }
export function historyFields(value: unknown, sources: Source[]): HistoryField[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [{ label: 'Details', value: value == null ? 'Not recorded before' : String(value) }];
  const fields: HistoryField[] = [];
  for (const [key, item] of Object.entries(value)) {
    if (['id', 'productId', 'variant', 'size', 'quantity', 'packaging', 'imageAttribution', 'imageUrl', 'image_front_url', 'image_front_small_url'].includes(key) || item === undefined) continue;
    if (key === 'photoDataUrl' || key === 'barcodePhotoDataUrl') { fields.push({ label: key === 'barcodePhotoDataUrl' ? 'Barcode reference photo' : 'Photo', value: item ? 'Photo saved on this device' : 'No photo' }); continue; }
    if (key === 'sourceId') {
      const source = sources.find(source => source.id === item);
      fields.push({ label: 'Where the code came from', value: source?.attribution ?? 'Not recorded', ...(source ? { source } : {}) });
      if (source?.externalUrl) fields.push({ label: 'Source website', value: source.externalUrl });
      if (source) fields.push({ label: 'Source details saved on', value: displayDate(source.capturedAt) });
      continue;
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      fields.push(...historyFields(item, sources).map(field => ({ ...field, label: key === 'product' ? `Online listing: ${field.label}` : field.label })));
      continue;
    }
    let formatted: string;
    if (key === 'verificationStatus' && typeof item === 'string' && item in statusLabels) formatted = statusLabels[item as keyof typeof statusLabels];
    else if (key === 'type' && typeof item === 'string') formatted = identifierTypeLabels[item as keyof typeof identifierTypeLabels] ?? ({ manual: 'Checked personally', packaging: 'Package', open_food_facts: 'Earlier imported source', authorized_reference: 'Permitted reference' }[item] ?? item);
    else if (typeof item === 'boolean') formatted = item ? 'Yes' : 'No';
    else if (typeof item === 'string' && /At$/.test(key)) formatted = displayDate(item);
    else if (Array.isArray(item)) formatted = item.map(String).join(', ');
    else formatted = String(item);
    fields.push({ ...(key === 'type' && typeof item === 'string' && item in identifierTypeLabels ? { codeType: item as IdentifierType } : {}), label: fieldLabels[key] ?? key.replaceAll('_', ' ').replace(/([a-z])([A-Z])/g, '$1 $2'), value: formatted || 'Not recorded' });
  }
  return fields;
}
export function eventLabel(eventType: string): string { return eventLabels[eventType] ?? plainMessage(eventType.replaceAll('_', ' ')); }
