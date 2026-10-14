import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { vi } from 'vitest';
vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW: () => ({ offlineReady: [false, () => {}], needRefresh: [false, () => {}], updateServiceWorker: async () => {} }) }));
import { afterEach } from 'vitest';
afterEach(cleanup);
