import { afterEach, expect, it, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import type { ProductInput } from './domain/maintenance';
import { ProductForm } from './components/ProductForm';
import { LocalCatalogRepository } from './data/repository';
import { demoProducts } from './data/demo';
import { seedCategories, seedCategoryId } from './data/taxonomy';
const stores: LocalCatalogRepository[] = [];
function setup() { const store = new LocalCatalogRepository(`classification-ui-${crypto.randomUUID()}`, { seedDemo: false }); stores.push(store); return { store, user: userEvent.setup() }; }
afterEach(async () => { for (const store of stores.splice(0)) await store.deleteDatabase(); });
async function addFixtures(store: LocalCatalogRepository) {
  await store.createProduct({ ...demoProducts[0], name: 'Test apples', categoryId: seedCategoryId('Produce') }, 'Test fixture');
  await store.createProduct({ ...demoProducts[0], name: 'Test fruit', categoryId: seedCategoryId('Produce') }, 'Test fixture');
  await store.createProduct({ ...demoProducts[0], name: 'Test bread', categoryId: seedCategoryId('Bakery') }, 'Test fixture');
}
it('filters a global query by department and clears classification without clearing the query', async () => {
  const { store, user } = setup(); await addFixtures(store); render(<App store={store} />); await screen.findByText('3 products');
  await user.type(screen.getByRole('searchbox'), 'Test');
  expect(screen.queryByRole('combobox', { name: 'Department' })).not.toBeInTheDocument();
  await user.click(screen.getByText('Browse by department'));
  await user.click(screen.getByRole('button', { name: 'Produce 2 products' })); expect(screen.getByRole('status')).toHaveTextContent('2 products');
  expect(screen.queryByLabelText('Category')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Subcategory')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Clear filters' })); expect(screen.getByRole('searchbox')).toHaveValue('Test'); expect(screen.getByRole('status')).toHaveTextContent('3 products');
});
it('browses only departments with counts and returns to all products', async () => {
  const { store, user } = setup(); await addFixtures(store); render(<App store={store} />); await screen.findByText('3 products');
  await user.click(screen.getByText('Browse by department'));
  await user.click(screen.getByRole('button', { name: 'Produce 2 products' }));
  expect(screen.getByRole('status')).toHaveTextContent('2 products');
  const crumbs = within(screen.getByRole('navigation', { name: 'Product classification' }));
  expect(crumbs.getByRole('button', { name: 'Produce' })).toHaveAttribute('aria-current', 'location');
  expect(screen.queryByRole('button', { name: /Fruits/ })).not.toBeInTheDocument();
  await user.click(crumbs.getByRole('button', { name: 'All products' })); expect(screen.getByRole('status')).toHaveTextContent('3 products');
});
it('product form provides only an optional department', async () => {
  const user = userEvent.setup(); const save = vi.fn(async (_input: ProductInput, _reason: string) => {});
  render(<ProductForm products={[]} categories={seedCategories} onSave={save} onCancel={() => {}} />);
  await user.type(screen.getByLabelText('Product name'), 'Test-only loaf');
  await user.selectOptions(screen.getByLabelText('Department'), seedCategoryId('Bakery'));
  expect(screen.queryByLabelText('Category (optional)')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Subcategory (optional)')).not.toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('Department'), seedCategoryId('Produce'));
  await user.click(screen.getByRole('button', { name: 'Save product' }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ categoryId: seedCategoryId('Produce') }), 'Product added manually.');
  expect(save.mock.calls[0][0]).not.toHaveProperty('departmentId');
});
it('settings manages departments only, prevents duplicates and protects departments with products', async () => {
  const { store, user } = setup(); await addFixtures(store); render(<App store={store} />); await screen.findByText('3 products');
  await user.click(screen.getByRole('button', { name: 'Settings' })); await user.click(screen.getByRole('button', { name: 'Manage departments' }));
  expect(screen.queryByLabelText('Level')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Belongs to')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Remove empty Produce' })).toBeDisabled();
  await user.type(screen.getByLabelText('Name'), 'Personal department'); await user.click(screen.getByRole('button', { name: 'Save department' }));
  await screen.findByRole('button', { name: 'Edit Personal department' });
  await user.type(screen.getByLabelText('Name'), ' personal DEPARTMENT '); await user.click(screen.getByRole('button', { name: 'Save department' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
  await user.click(screen.getByRole('button', { name: 'Edit Personal department' })); await user.clear(screen.getByLabelText('Name')); await user.type(screen.getByLabelText('Name'), 'Renamed department'); await user.click(screen.getByRole('button', { name: 'Save department' }));
  await screen.findByRole('button', { name: 'Edit Renamed department' });
  await user.click(screen.getByRole('button', { name: 'Remove empty Renamed department' })); expect(await screen.findByText('Empty department removed.')).toBeVisible();
});
