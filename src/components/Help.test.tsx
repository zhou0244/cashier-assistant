import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeType } from './CodeType';
import { Credits } from './Credits';
it('explains the code type on hover, focus and tap, links the explanation and closes with Escape', async () => {
  const user = userEvent.setup(); render(<CodeType type="UPC_A" />);
  const help = screen.getByRole('button', { name: 'Explain UPC-A' });
  expect(screen.queryByRole('tooltip')).toBeNull();
  await user.hover(help); expect(screen.getByRole('tooltip')).toHaveTextContent('12 numbers');
  expect(help).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id);
  await user.unhover(help); expect(screen.queryByRole('tooltip')).toBeNull();
  await user.tab(); expect(help).toHaveFocus(); expect(screen.getByRole('tooltip')).toBeVisible();
  await user.keyboard('{Escape}'); expect(screen.queryByRole('tooltip')).toBeNull();
  await user.click(help); expect(screen.getByRole('tooltip')).toBeVisible();
  await user.click(help); expect(screen.queryByRole('tooltip')).toBeNull();
});
it('shows the exact recorded credit and source link without provider-specific content', () => {
  render(<Credits text="My permitted product reference" url="https://example.com/reference" />);
  expect(screen.getByText(/My permitted product reference/)).toBeVisible();
  expect(screen.getByRole('link', { name: 'Original source' })).toHaveAttribute('href', 'https://example.com/reference');
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});
