import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IdentifierCard } from './IdentifierCard';
import { testIdentifier } from '../testing/identifier';
it('renders a verified barcode and copies the exact code with leading zeros', async () => {
  const user = userEvent.setup();
  const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  render(<IdentifierCard identifier={testIdentifier()} isDemo={false} />);
  expect(screen.getByRole('img', { name: /UPC-A barcode for 012345678905/ })).toBeVisible();
  expect(screen.getByText('Ready to use · Checked at register')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Copy code' }));
  expect(copy).toHaveBeenCalledWith('012345678905');
  expect(screen.getByRole('status')).toHaveTextContent('Code copied.');
});
it('shows packaging verification without calling it checkout-ready', () => {
  render(<IdentifierCard identifier={testIdentifier({ verificationStatus: 'packaging_verified' })} isDemo={false} />);
  expect(screen.getByText(/It has not been checked at the register/)).toBeVisible();
  expect(screen.getByRole('img')).toBeVisible();
  expect(screen.queryByText(/Ready to use/)).toBeNull();
});
it('removes previously rendered artwork immediately when a code becomes unsafe', () => {
  const identifier = testIdentifier();
  const view = render(<IdentifierCard identifier={identifier} isDemo={false} />);
  expect(screen.getByRole('img')).toBeVisible();
  for (const changed of [{ ...identifier, verificationStatus: 'unverified' as const }, { ...identifier, code: '012345678906' }, { ...identifier, isActive: false }]) {
    view.rerender(<IdentifierCard identifier={changed} isDemo={false} />);
    expect(screen.queryByRole('img')).toBeNull(); expect(screen.queryByRole('button', { name: 'Copy code' })).toBeNull();
  }
  view.rerender(<IdentifierCard identifier={identifier} isDemo={true} />);
  expect(screen.queryByRole('img')).toBeNull(); expect(screen.queryByRole('button', { name: 'Copy code' })).toBeNull();
});
it.each(['PLU', 'STORE_CODE'] as const)('shows verified %s numerically without barcode art', type => {
  render(<IdentifierCard identifier={testIdentifier({ type, code: '00123' })} isDemo={false} />);
  expect(screen.getByText('00123')).toBeVisible();
  expect(screen.getByText(/Type this code into the register by hand/)).toBeVisible();
  expect(screen.queryByRole('img')).toBeNull();
});
it('explains invalid code and clipboard denial without hiding the stored value', async () => {
  const user = userEvent.setup();
  const copy = vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
  const view = render(<IdentifierCard identifier={testIdentifier({ code: '012345678906' })} isDemo={false} />);
  expect(screen.getByText(/The final digit does not match/)).toBeVisible();
  expect(screen.getByText('012345678906')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Copy code' })).toBeNull();
  view.rerender(<IdentifierCard identifier={testIdentifier()} isDemo={false} />);
  await user.click(screen.getByRole('button', { name: 'Copy code' }));
  expect(copy).toHaveBeenCalledWith('012345678905');
  expect(screen.getByRole('status')).toHaveTextContent('Copy unavailable');
});
