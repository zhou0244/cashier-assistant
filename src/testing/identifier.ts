import type { Identifier } from '../domain/models';
import { demoIdentifiers } from '../data/demo';
/** Test-only synthetic states, never seeded into the user's catalog. */
export function testIdentifier(overrides: Partial<Identifier> = {}): Identifier {
  return { ...demoIdentifiers[0], type: 'UPC_A', code: '012345678905', verificationStatus: 'pos_verified', ...overrides };
}
