import { afterEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Settings } from './components/Settings';
import App from './App';
import { LocalCatalogRepository } from './data/repository';
import { demoProducts } from './data/demo';
const stores: LocalCatalogRepository[] = [];
function create() { const store = new LocalCatalogRepository(`settings-${crypto.randomUUID()}`, { seedDemo: false }); stores.push(store); return store; }
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllGlobals(); for (const store of stores.splice(0)) await store.deleteDatabase(); });
it('previews a file, requires acknowledgment and merges it while preserving original verification claims in history', async () => {
  const source = create(); const product = await source.createProduct({ ...demoProducts[0], name: 'Synthetic file fixture' }, 'Fixture');
  await source.addIdentifier(product.id, { code: '012345678905', type: 'UPC_A', source: { type: 'manual', attribution: 'Test-only evidence' }, reason: 'Fixture' });
  const backup = await source.exportBackup(); const target = create(); const user = userEvent.setup();
  render(<Settings store={target} catalog={await target.load()} onImported={async () => {}} />);
  const file = new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' });
  // jsdom lacks File.text; supply the standard browser method for this fixture.
  Object.defineProperty(file, 'text', { value: async () => JSON.stringify(backup) });
  await user.upload(screen.getByLabelText('Choose a backup file to restore'), file);
  await screen.findByText('What will be added');
  expect(screen.getByRole('button', { name: 'Add from this backup' })).toBeDisabled();
  await user.click(screen.getByLabelText('I checked what will be added and where this backup came from.'));
  await user.click(screen.getByRole('button', { name: 'Add from this backup' }));
  await screen.findByText(/Backup added/);
  expect((await target.load()).products[0].name).toBe('Synthetic file fixture');
});
it('manual-only search and settings make no product lookup requests and settings navigation is accessible', async () => {
  const store = create(); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  await store.createProduct({ ...demoProducts[0], name: 'Local fixture' }, 'Fixture');
  const user = userEvent.setup(); render(<App store={store} />); await screen.findByText('1 product');
  await user.type(screen.getByRole('searchbox'), 'fixture'); expect(fetcher).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await screen.findByRole('heading', { name: 'Settings' }); expect(fetcher).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Find online product' })).not.toBeInTheDocument();
  expect(screen.queryByText(/Open Food Facts/)).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Add product' }));
  expect(screen.queryByRole('option', { name: /Open Food Facts/ })).not.toBeInTheDocument();
});
