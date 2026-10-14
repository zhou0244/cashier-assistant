import { afterEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductForm } from './ProductForm';
import { photoFixture } from '../testing/photo';
import type { ProductInput } from '../domain/maintenance';
import App from '../App';
import { LocalCatalogRepository } from '../data/repository';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function imageBrowser() {
  vi.stubGlobal('Image', class {
    naturalWidth = 4000; naturalHeight = 3000; onload?: () => void;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  });
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillStyle: '', fillRect: vi.fn(), drawImage } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(photoFixture);
  return drawImage;
}
it('offers separate gallery and rear-camera pickers, previews and saves a local photo without removed fields', async () => {
  const draw = imageBrowser(); const user = userEvent.setup(); const save = vi.fn(async (_input: ProductInput, _reason: string) => {});
  render(<ProductForm products={[]} onSave={save} onCancel={() => {}} />);
  expect(screen.getByRole('group', { name: 'Add photo' })).toBeVisible();
  expect(screen.getByLabelText('Choose photo from gallery')).not.toHaveAttribute('capture');
  expect(screen.getByLabelText('Take a product photo')).toHaveAttribute('capture', 'environment');
  expect(screen.queryByLabelText('Photo link')).not.toBeInTheDocument();
  const gallery = screen.getByLabelText('Choose photo from gallery'); const choose = vi.spyOn(gallery, 'click');
  await user.click(screen.getByRole('button', { name: 'Choose from gallery' })); expect(choose).toHaveBeenCalled();
  await user.upload(gallery, new File(['image fixture'], 'product.png', { type: 'image/png' }));
  await screen.findByRole('img', { name: 'Selected product photo' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save product' })).toBeEnabled());
  expect(draw).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 1200);
  await user.type(screen.getByLabelText('Product name'), 'Photo fixture'); await user.click(screen.getByRole('button', { name: 'Save product' }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ photoDataUrl: photoFixture }), 'Product added manually.');
});
it('supports camera selection and removal, and preserves a selected photo after upload failure', async () => {
  imageBrowser(); const user = userEvent.setup({ applyAccept: false }); const save = vi.fn(async (_input: ProductInput, _reason: string) => {});
  render(<ProductForm products={[]} onSave={save} onCancel={() => {}} />);
  await user.upload(screen.getByLabelText('Take a product photo'), new File(['camera fixture'], 'camera.jpg', { type: 'image/jpeg' }));
  const preview = await screen.findByRole('img', { name: 'Selected product photo' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save product' })).toBeEnabled());
  await user.upload(screen.getByLabelText('Choose photo from gallery'), new File(['bad'], 'bad.txt', { type: 'text/plain' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose a photo'); expect(preview).toHaveAttribute('src', photoFixture);
  await user.click(screen.getByRole('button', { name: 'Remove photo' })); expect(screen.queryByRole('img')).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('Product name'), 'Without photo'); await user.click(screen.getByRole('button', { name: 'Save product' }));
  expect(save.mock.calls[0][0].photoDataUrl).toBeUndefined();
});
it('saves a gallery photo through the app and shows it on details, search and reopening', async () => {
  imageBrowser(); const user = userEvent.setup();
  const store = new LocalCatalogRepository(`photo-flow-${crypto.randomUUID()}`, { seedDemo: false });
  try {
    const view = render(<App store={store} />); await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('0 products'));
    await user.click(screen.getByRole('button', { name: 'Settings' })); await user.click(screen.getByRole('button', { name: 'Add product' }));
    await user.type(screen.getByLabelText('Product name'), 'Local photo product');
    await user.upload(screen.getByLabelText('Choose photo from gallery'), new File(['fixture'], 'local.png', { type: 'image/png' }));
    await screen.findByRole('img', { name: 'Selected product photo' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save product' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Save product' }));
    expect(await screen.findByRole('img', { name: 'Photo of Local photo product' })).toHaveAttribute('src', photoFixture);
    await user.click(screen.getByRole('button', { name: 'Back to search' }));
    expect(screen.getByRole('img', { name: 'Photo of Local photo product' })).toBeVisible();
    view.unmount(); render(<App store={store} />);
    expect(await screen.findByRole('img', { name: 'Photo of Local photo product' })).toHaveAttribute('src', photoFixture);
  } finally { await store.deleteDatabase(); }
});
it('saves a PLU and barcode reference from the new product form without creating barcode artwork', async () => {
  imageBrowser(); const user = userEvent.setup();
  const store = new LocalCatalogRepository(`plu-flow-${crypto.randomUUID()}`, { seedDemo: false });
  try {
    render(<App store={store} />); await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('0 products'));
    await user.click(screen.getByRole('button', { name: 'Settings' })); await user.click(screen.getByRole('button', { name: 'Add product' }));
    expect(screen.getByRole('region', { name: 'Product codes' })).toBeVisible();
    await user.type(screen.getByLabelText('Product name'), 'PLU photo fixture');
    await user.type(screen.getByLabelText('PLU'), 'bad'); expect(screen.getByRole('button', { name: 'Save product' })).toBeDisabled();
    await user.clear(screen.getByLabelText('PLU')); await user.type(screen.getByLabelText('PLU'), '04011');
    expect(screen.getByLabelText('Capture barcode image')).toHaveAttribute('capture', 'environment');
    await user.upload(screen.getByLabelText('Select barcode image from gallery'), new File(['fixture'], 'barcode.png', { type: 'image/png' }));
    await screen.findByRole('img', { name: 'Selected barcode photo' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save product' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Save product' })); await screen.findByText('04011');
    expect(document.querySelector('.barcode-artwork svg')).toBeNull();
    await user.click(screen.getByText('Barcode photo · reference only'));
    expect(screen.getByRole('img', { name: 'Saved barcode reference photo' })).toHaveAttribute('src', photoFixture);
    const data = await store.load(); expect(data.identifiers[0].verificationStatus).toBe('unverified');
    expect(data.products[0].photoDataUrl).toBeUndefined();
  } finally { await store.deleteDatabase(); }
});
