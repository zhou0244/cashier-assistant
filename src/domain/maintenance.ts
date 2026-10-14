import { validatePhoto } from './photo';
import type { Identifier, Product, Source, VerificationStatus } from './models';
import { validateIdentifier } from './identifier-policy';
export type ProductInput = Pick<Product, 'name' | 'brand' | 'category' | 'categoryId' | 'keywords' | 'photoDataUrl' | 'barcodePhotoDataUrl'> & { plu?: string };
export interface EvidenceInput { type: Exclude<Source['type'], 'open_food_facts'>; attribution: string; externalUrl?: string }
export interface IdentifierInput { code: string; type: Identifier['type']; source: EvidenceInput; reason: string }
export interface VerificationInput { status: VerificationStatus; source: EvidenceInput; reason: string; confirmed: boolean }
export function requireReason(reason: string): string {
  if (!reason.trim()) throw new Error('Record a reason for this change.');
  return reason.trim();
}
export function safeUrl(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const url = new URL(value.trim());
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Image and source URLs must use HTTP or HTTPS.');
  return url.href;
}
export function validateProduct(input: ProductInput): ProductInput {
  if (!input.name.trim()) throw new Error('Product name is required.');
  const optional = (value?: string) => value?.trim() || undefined;
  return { name: input.name.trim(), brand: optional(input.brand), category: optional(input.category), categoryId: input.categoryId || undefined, photoDataUrl: validatePhoto(input.photoDataUrl), barcodePhotoDataUrl: validatePhoto(input.barcodePhotoDataUrl), keywords: [...new Set(input.keywords.map(word => word.trim()).filter(Boolean))] };
}
export function validateEvidence(input: EvidenceInput): EvidenceInput {
  if (!['manual', 'packaging', 'authorized_reference'].includes(input.type)) throw new Error('Choose a supported source type.');
  if (!input.attribution.trim()) throw new Error('Describe the source of this code or verification.');
  return { type: input.type, attribution: input.attribution.trim(), externalUrl: safeUrl(input.externalUrl) };
}
export function validateIdentifierInput(input: IdentifierInput): IdentifierInput {
  if (!['UPC_A', 'EAN_13', 'EAN_8', 'PLU', 'STORE_CODE', 'OTHER'].includes(input.type)) throw new Error('Choose a supported identifier type.');
  const validation = validateIdentifier(input.code, input.type);
  if (!validation.valid) throw new Error(validation.message);
  return { ...input, source: validateEvidence(input.source), reason: requireReason(input.reason) };
}
/** UPC-A and its leading-zero EAN-13 representation encode the same identifier. */
export function equivalentCode(a: Pick<Identifier, 'code' | 'type'>, b: Pick<Identifier, 'code' | 'type'>): boolean {
  if (a.code === b.code) return true;
  const canonical = (i: Pick<Identifier, 'code' | 'type'>) => i.type === 'UPC_A' ? `0${i.code}` : i.code;
  return ['UPC_A', 'EAN_13'].includes(a.type) && ['UPC_A', 'EAN_13'].includes(b.type) && canonical(a) === canonical(b);
}
export function identifierConflicts(candidate: Pick<Identifier, 'id' | 'code' | 'type'>, identifiers: Identifier[]): Identifier[] {
  return identifiers.filter(other => other.isActive && other.id !== candidate.id && equivalentCode(candidate, other));
}
const normalize = (value?: string) => (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
export function similarProducts(input: ProductInput, products: Product[], excludeId?: string): Product[] {
  return products.filter(product => product.id !== excludeId && !product.archivedAt && normalize(product.name) === normalize(input.name) && normalize(product.brand) === normalize(input.brand));
}
export function reviewReasons(product: Product, identifiers: Identifier[], allIdentifiers: Identifier[]): string[] {
  const active = identifiers.filter(identifier => identifier.isActive);
  if (!active.length) return ['No active identifiers'];
  const reasons = new Set<string>();
  for (const identifier of active) {
    if (identifier.verificationStatus === 'unverified') reasons.add('Unverified code');
    if (identifier.verificationStatus === 'packaging_verified') reasons.add('Register compatibility unverified');
    if (!validateIdentifier(identifier.code, identifier.type).valid) reasons.add('Invalid code');
    if (identifierConflicts(identifier, allIdentifiers).length) reasons.add('Duplicate identifier association');
    if (identifier.type === 'OTHER' && identifier.verificationStatus !== 'rejected') reasons.add('Unknown identifier type');
  }
  if (product.isDemo && active.some(identifier => ['packaging_verified', 'pos_verified'].includes(identifier.verificationStatus))) reasons.add('Demo cannot be verified');
  return [...reasons];
}
