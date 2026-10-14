import { afterEach, expect, it } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { maintenanceStub } from './testing/repository';
import { LocalCatalogRepository, type CatalogRepository } from './data/repository';
const repositories: LocalCatalogRepository[] = [];
afterEach(async () => { for (const repository of repositories.splice(0)) await repository.deleteDatabase(); });
function setup() { const store = new LocalCatalogRepository(`ui-${crypto.randomUUID()}`); repositories.push(store); return { store, user: userEvent.setup() }; }
it('searches, distinguishes variants, opens details, saves and retains saved state after reload', async () => {
  const { store, user } = setup(); const view = render(<App store={store} />);
  await screen.findByText('6 products');
  await user.type(screen.getByRole('searchbox'), 'oat');
  expect(screen.getByRole('status')).toHaveTextContent('3 products');
  expect(screen.queryByText('Unsweetened', { exact: false })).not.toBeInTheDocument();
  const match = screen.getAllByRole('button', { name: /Fictional Meadow Demo Oat Drink/ })[1];
  await user.click(match);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Demo Oat Drink');
  expect(screen.getByText('000002')).toBeVisible();
  expect(screen.getByText(/Made-up example code/)).toBeVisible();
  expect(document.querySelector('.barcode-artwork svg')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Save product' }));
  await screen.findByRole('button', { name: 'Remove from saved' });
  await user.click(screen.getByRole('button', { name: 'Back to search' }));
  expect(screen.getByRole('searchbox')).toHaveValue('oat');
  await user.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name: 'Saved' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 product'));
  view.unmount(); render(<App store={store} />);
  await screen.findByText('6 products');
  await user.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name: 'Saved' }));
  expect(screen.getByRole('button', { name: /Fictional Meadow Demo Oat Drink/ })).toBeVisible();
  await user.click(screen.getByRole('button', { name: /Fictional Meadow Demo Oat Drink/ }));
  await user.click(screen.getByRole('button', { name: 'Remove from saved' }));
  await screen.findByRole('button', { name: 'Save product' });
  await user.click(screen.getByRole('button', { name: 'Back to saved' }));
  expect(screen.getByText('No saved products yet')).toBeVisible();
});
it('filters products on Search and finds leading-zero codes with clear empty states', async () => {
  const { store, user } = setup(); render(<App store={store} />); await screen.findByText('6 products');
  await user.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name: 'Search' }));
  expect(screen.queryByRole('combobox', { name: 'Department' })).not.toBeInTheDocument();
  await user.click(screen.getByText('Browse by department'));
  await user.click(screen.getByRole('button', { name: 'Produce 1 product' }));
  expect(screen.getByRole('status')).toHaveTextContent('1 product');
  await user.click(screen.getByRole('button', { name: 'Clear filters' }));
  await user.type(screen.getByRole('searchbox'), '000004');
  expect(screen.getByRole('button', { name: /Demo Chickpeas/ })).toBeVisible();
  await user.clear(screen.getByRole('searchbox')); await user.type(screen.getByRole('searchbox'), 'missing product');
  expect(screen.getByText('No matching products')).toBeVisible();
});
it('reports local database failures rather than silently resetting data', async () => {
  const store: CatalogRepository = { ...maintenanceStub, load: () => Promise.reject(new Error('blocked')), setSaved: async () => {}, recordUse: async () => {} };
  render(<App store={store} />);
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Your saved products could not be opened');
  expect(alert).toHaveTextContent('Error: blocked');
  expect(alert).not.toHaveTextContent('Allow this site to save data in your browser settings');
});

it('retrieves a verified code from local search and distinguishes a packaging-only alternative', async () => {
  // Synthetic states are test-only: these records never enter the application database.
  const { testIdentifier } = await import('./testing/identifier');
  const { demoProducts } = await import('./data/demo');
  const product = { ...demoProducts[0], name: 'Test-only variant', isDemo: false };
  const identifiers = [testIdentifier({ productId: product.id, verificationStatus: 'packaging_verified', id: 'packaging' }), testIdentifier({ productId: product.id, code: '00123', type: 'PLU', id: 'pos' })];
  const store: CatalogRepository = { ...maintenanceStub,
    load: async () => ({ categories: [], products: [product], identifiers, sources: [], saved: [] }),
    setSaved: async () => {}, recordUse: async () => {},
  };
  const user = userEvent.setup(); render(<App store={store} />);
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 product'));
  await user.type(screen.getByRole('searchbox'), '00123');
  await user.click(screen.getByRole('button', { name: /Test-only variant/ }));
  const cards = screen.getAllByRole('article');
  expect(cards[0]).toHaveAccessibleName('PLU code');
  expect(within(cards[0]).getByText('Ready to use · Checked at register')).toBeVisible();
  expect(within(cards[0]).queryByRole('img')).toBeNull();
  expect(within(cards[1]).getByRole('img', { name: /012345678905/ })).toBeVisible();
  expect(within(cards[1]).queryByText(/Ready to use/)).toBeNull();
  expect(within(cards[1]).getByText(/It has not been checked at the register/)).toBeVisible();
});
