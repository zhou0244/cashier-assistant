import { afterEach, expect, it, vi } from 'vitest';
import { newId } from './id';
afterEach(() => vi.unstubAllGlobals());
it('uses the native secure ID generator when available', () => {
  const randomUUID = vi.fn(() => '01234567-89ab-4def-8123-456789abcdef');
  vi.stubGlobal('crypto', { randomUUID });
  expect(newId()).toBe('01234567-89ab-4def-8123-456789abcdef');
  expect(randomUUID).toHaveBeenCalledOnce();
});
it('creates valid distinct UUID v4 IDs when randomUUID is unavailable', () => {
  const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  vi.stubGlobal('crypto', { getRandomValues });
  const ids = new Set(Array.from({ length: 100 }, newId));
  expect(ids.size).toBe(100);
  for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
