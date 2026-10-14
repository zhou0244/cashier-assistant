import { useId } from 'react';
import type { ProductCategory, Product } from '../domain/models';
import { categoryPath, childrenOf, matchesClassification, UNCATEGORIZED } from '../domain/classification';
export function ClassificationSelectors({ categories, value, onChange, products, mode = 'filter' }: { categories: ProductCategory[]; value?: string; onChange: (id?: string) => void; products?: Product[]; mode?: 'filter' | 'edit' }) {
  const id = useId(); const departmentId = categoryPath(categories, value)[0]?.id ?? (value === UNCATEGORIZED ? UNCATEGORIZED : '');
  const count = (department: string) => products ? ` (${products.filter(product => !product.archivedAt && matchesClassification(product, department, categories)).length})` : '';
  return <div className={`classification-selectors ${mode}`}><div>
    {mode === 'edit' && <label htmlFor={id}>Department</label>}
    <select id={id} aria-label={mode === 'filter' ? 'Department' : undefined} value={departmentId} onChange={event => onChange(event.target.value || undefined)}>
      <option value="">{mode === 'filter' ? 'All departments' : 'No department selected'}</option>
      {mode === 'filter' && <option value={UNCATEGORIZED}>No department{count(UNCATEGORIZED)}</option>}
      {childrenOf(categories, null).map(node => <option key={node.id} value={node.id}>{node.name}{count(node.id)}</option>)}
    </select>
  </div></div>;
}
