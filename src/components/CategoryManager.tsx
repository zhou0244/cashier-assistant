import { useState } from 'react';
import { ArrowLeft, ArrowUp, ArrowDown, Pencil, Trash2 } from 'lucide-react';
import type { Catalog, ProductCategory } from '../domain/models';
import type { CatalogRepository } from '../data/repository';
import { childrenOf, matchesClassification } from '../domain/classification';
export function CategoryManager({ catalog, store, onDone }: { catalog: Catalog; store: CatalogRepository; onDone: () => void }) {
  const [editing, setEditing] = useState<ProductCategory>(); const [name, setName] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  function reset() { setEditing(undefined); setName(''); }
  async function run(action: () => Promise<void>) { setBusy(true); setError(''); setMessage(''); try { await action(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save departments.'); } finally { setBusy(false); } }
  function rows(parent: string | null, depth = 0): React.ReactNode {
    const siblings = childrenOf(catalog.categories, parent);
    return siblings.map((node, index) => <li key={node.id}>
      <div className="category-row" style={{ paddingLeft: `${depth * 16}px` }}><span><strong>{node.name}</strong></span>
        <div className="category-row-actions"><button disabled={busy} aria-label={`Edit ${node.name}`} onClick={() => { setEditing(node); setName(node.name); }}><Pencil size={16} aria-hidden="true" /></button>
        <button disabled={busy || index === 0} aria-label={`Move ${node.name} up`} onClick={() => { void run(() => store.moveCategory(node.id, 'up')); }}><ArrowUp size={16} aria-hidden="true" /></button>
        <button disabled={busy || index === siblings.length - 1} aria-label={`Move ${node.name} down`} onClick={() => { void run(() => store.moveCategory(node.id, 'down')); }}><ArrowDown size={16} aria-hidden="true" /></button>
        <button disabled={busy || catalog.products.some(product => matchesClassification(product, node.id, catalog.categories))} aria-label={`Remove empty ${node.name}`} onClick={() => { void run(async () => { await store.deleteCategory(node.id, node); if (editing?.id === node.id) reset(); setMessage('Empty department removed.'); }); }}><Trash2 size={16} aria-hidden="true" /></button></div>
      </div>
    </li>);
  }
  return <section className="maintenance category-manager"><button className="back" onClick={onDone}><ArrowLeft size={18} aria-hidden="true" />Back to settings</button><h1>Departments</h1>
    <p className="muted">Arrange products into departments. These starting groups are examples, not an official retailer list. Removing a group is allowed only when it has no products.</p>
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status">{message}</p>}
    <form onSubmit={event => { event.preventDefault(); void run(async () => {
      await store.saveCategory({ name, level: 'department', parentId: null, sortOrder: editing ? editing.sortOrder : childrenOf(catalog.categories, null).length }, editing?.id, editing);
      reset(); setMessage('Department saved.');
    }); }}><fieldset disabled={busy}><h2>{editing ? `Edit ${editing.name}` : 'Add department'}</h2>
      <label htmlFor="category-name">Name<input id="category-name" required value={name} onChange={event => setName(event.target.value)} /></label>
      <div className="actions"><button className="primary" type="submit">Save department</button>{editing && <button type="button" onClick={reset}>Cancel edit</button>}</div>
    </fieldset></form><ul className="category-tree">{rows(null)}</ul>
  </section>;
}
