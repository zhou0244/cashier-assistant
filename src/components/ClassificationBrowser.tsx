import { ArrowLeft, ChevronRight } from 'lucide-react';
import type { Product, ProductCategory } from '../domain/models';
import { categoryPath, childrenOf, matchesClassification, UNCATEGORIZED } from '../domain/classification';
export function ClassificationBrowser({ categories, products, value, onChange }: { categories: ProductCategory[]; products: Product[]; value?: string; onChange: (id?: string) => void }) {
  const path = categoryPath(categories, value).slice(0, 1); const selected = path.at(-1);
  const children = value ? [] : childrenOf(categories, null);
  const count = (id: string) => products.filter(product => !product.archivedAt && matchesClassification(product, id, categories)).length;
  return <details className="classification-browser"><summary>Browse by department</summary>
    <nav className="breadcrumbs" aria-label="Product classification"><button onClick={() => onChange(undefined)}>All products</button>{path.map(node => <span key={node.id}><ChevronRight size={14} aria-hidden="true" /><button aria-current={node.id === value ? 'location' : undefined} onClick={() => onChange(node.id)}>{node.name}</button></span>)}{value === UNCATEGORIZED && <span>No department</span>}</nav>
    {value && <button className="back" onClick={() => onChange(selected?.parentId ?? undefined)}><ArrowLeft size={16} aria-hidden="true" />All departments</button>}
    <div className="classification-tiles">{children.map(node => <button key={node.id} onClick={() => onChange(node.id)}><strong>{node.name}</strong><span>{count(node.id)} {count(node.id) === 1 ? 'product' : 'products'}</span><ChevronRight size={18} aria-hidden="true" /></button>)}</div>
    {selected && <p className="muted">Viewing all products in {selected.name}. Use the search above to narrow the results.</p>}
    {!value && <button onClick={() => onChange(UNCATEGORIZED)}>No department ({count(UNCATEGORIZED)})</button>}
  </details>;
}
