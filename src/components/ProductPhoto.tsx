import { useMemo, useState } from 'react';
import { Package } from 'lucide-react';
import type { Product } from '../domain/models';
import { validatePhoto } from '../domain/photo';
export function ProductPhoto({ product }: { product: Product }) {
  const [failed, setFailed] = useState<string>();
  const valid = useMemo(() => { try { return !!validatePhoto(product.photoDataUrl); } catch { return false; } }, [product.photoDataUrl]);
  if (!valid || failed === product.photoDataUrl) return <div className="product-photo photo-placeholder" role="img" aria-label={`No photo of ${product.name}`}><Package size={32} strokeWidth={1.5} aria-hidden="true" /><small>No photo</small></div>;
  return <img className="product-photo" src={product.photoDataUrl} alt={`Photo of ${product.name}`} onError={() => setFailed(product.photoDataUrl)} />;
}
