export type IdentifierType = 'UPC_A' | 'EAN_13' | 'EAN_8' | 'PLU' | 'STORE_CODE' | 'OTHER';
export type VerificationStatus = 'unverified' | 'packaging_verified' | 'pos_verified' | 'rejected';
export interface ProductCategory { id: string; name: string; parentId: string | null; level: 'department' | 'category' | 'subcategory'; sortOrder: number }
// Legacy backup metadata only; manual entry never creates this field.
export interface ExternalCategories { source: 'open_food_facts'; labels: string[]; ids: string[] }
// variant is retained only as legacy backup metadata, not an active product field.
export interface Product {
  id: string; name: string; brand?: string; category?: string; categoryId?: string; externalCategories?: ExternalCategories; variant?: string; size?: string;
  photoDataUrl?: string; barcodePhotoDataUrl?: string; packaging?: string; keywords: string[]; imageUrl?: string; imageAttribution?: string;
  isDemo?: boolean; createdAt: string; updatedAt: string; archivedAt?: string;
}
export interface Identifier {
  id: string; productId: string; code: string; type: IdentifierType; verificationStatus: VerificationStatus;
  verifiedAt?: string; verificationMethod?: string; sourceId?: string; isActive: boolean; createdAt: string; updatedAt: string;
}
// The legacy imported-source value remains readable to preserve existing provenance.
export interface Source {
  id: string; type: 'open_food_facts' | 'packaging' | 'authorized_reference' | 'manual';
  externalUrl?: string; externalId?: string; attribution?: string; capturedAt: string;
}
export interface ChangeEvent {
  id: string; entityType: 'product' | 'identifier' | 'category'; entityId: string; eventType: string;
  before?: unknown; after?: unknown; reason?: string; timestamp: string;
}
export interface SavedProduct { productId: string; savedAt?: string; lastUsedAt?: string; useCount: number }
export interface Catalog { categories: ProductCategory[]; products: Product[]; identifiers: Identifier[]; sources: Source[]; saved: SavedProduct[] }
export const statusLabels: Record<VerificationStatus, string> = {
  unverified: 'Not checked', packaging_verified: 'Checked on package', pos_verified: 'Checked at register', rejected: 'Marked incorrect',
};
export function prioritizedIdentifiers(identifiers: Identifier[]): Identifier[] {
  const rank: Record<VerificationStatus, number> = { pos_verified: 0, packaging_verified: 1, unverified: 2, rejected: 3 };
  return identifiers.filter(i => i.isActive).sort((a, b) => rank[a.verificationStatus] - rank[b.verificationStatus] || a.createdAt.localeCompare(b.createdAt));
}
