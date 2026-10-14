import { validateIdentifier } from '../domain/identifier-policy';
import { CodeType } from './CodeType';
import { PhotoInput } from './PhotoInput';
import { categoryPath } from '../domain/classification';
import { plainMessage } from '../ui/words';
import { useState } from 'react';
import { ClassificationSelectors } from './ClassificationSelectors';
import type { Product, ProductCategory } from '../domain/models';
import { similarProducts, type ProductInput } from '../domain/maintenance';
export function ProductForm({ product, products, categories = [], onSave, onCancel }: { product?: Product; products: Product[]; categories?: ProductCategory[]; onSave: (input: ProductInput, reason: string) => Promise<void>; onCancel: () => void }) {
  const [input, setInput] = useState<ProductInput>(product ? { ...product, categoryId: categoryPath(categories, product.categoryId)[0]?.id } : { name: '', brand: '', category: '', keywords: [] });
  const [plu, setPlu] = useState(''); const [barcodePhotoBusy, setBarcodePhotoBusy] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const similar = similarProducts(input, products, product?.id);
  const fields = [['name', 'Product name'], ['brand', 'Brand']] as const;
  return <section className="maintenance"><h1>{product ? 'Edit product' : 'Add product'}</h1>
    <p className="muted">Record the product name and brand. Changing product identity means its codes need checking again. Changing only its group keeps code checks intact. Earlier checks stay in the change history.</p>
    {product?.isDemo && <p className="notice">This is a made-up example. It cannot be marked as checked.</p>}
    <form onSubmit={async event => {
      event.preventDefault(); if (photoBusy || barcodePhotoBusy) return; setError('');
      if (similar.length && !acknowledged) { setError('Compare the similar products and confirm that this is the right product.'); return; }
      setBusy(true); try { await onSave({ ...input, ...(!product && plu ? { plu } : {}) }, product ? 'Product details edited manually.' : 'Product added manually.'); } catch (failure) { setError(failure instanceof Error ? plainMessage(failure.message) : 'Could not save product.'); } finally { setBusy(false); }
    }}>
      <fieldset disabled={busy || photoBusy || barcodePhotoBusy}>{fields.map(([key, label]) => <label key={key} htmlFor={`product-${key}`}>{label}<input id={`product-${key}`} required={key === 'name'} type="text" value={input[key] ?? ''} onChange={event => { setInput({ ...input, [key]: event.target.value }); setAcknowledged(false); }} /></label>)}
      <PhotoInput value={input.photoDataUrl} onChange={photoDataUrl => setInput(previous => ({ ...previous, photoDataUrl }))} onBusy={setPhotoBusy} />
      <ClassificationSelectors categories={categories} value={input.categoryId} mode="edit" onChange={categoryId => setInput({ ...input, categoryId })} />
      <label htmlFor="product-keywords">Search words (separate with commas)<input id="product-keywords" value={input.keywords.join(',')} onChange={event => setInput({ ...input, keywords: event.target.value.split(',') })} /></label>
      <section className="product-codes-entry" aria-label="Product codes"><h2>Product codes</h2>
        {!product && <><label htmlFor="product-plu"><span><CodeType type="PLU" /></span><input id="product-plu" aria-label="PLU" type="text" inputMode="numeric" pattern="[0-9]*" value={plu} onChange={event => setPlu(event.target.value)} /></label>
        {plu && !validateIdentifier(plu, 'PLU').valid && <p className="error">Enter the PLU using numbers only, without spaces.</p>}</>}
        {product && <p className="muted">Update saved codes from the product’s code cards.</p>}
        <PhotoInput kind="barcode" value={input.barcodePhotoDataUrl} onChange={barcodePhotoDataUrl => setInput(previous => ({ ...previous, barcodePhotoDataUrl }))} onBusy={setBarcodePhotoBusy} />
        <p className="muted">Both are optional. Codes need checking before checkout. The photo is a reference; it does not verify or read the barcode number.</p>
      </section>
      {similar.length > 0 && <aside className="notice"><strong>Similar products already exist</strong><ul>{similar.map(match => <li key={match.id}>{match.name} · {match.brand}</li>)}</ul><label className="checkbox"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />I compared these products and confirmed the right product.</label></aside>}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="actions"><button className="primary" type="submit" disabled={!product && !!plu && !validateIdentifier(plu, 'PLU').valid}>{busy ? 'Saving…' : 'Save product'}</button><button type="button" onClick={onCancel}>Cancel</button></div></fieldset>
    </form>
  </section>;
}
