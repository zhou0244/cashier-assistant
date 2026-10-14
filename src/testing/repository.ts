import type { CatalogRepository } from '../data/repository';
const unavailable = async (): Promise<never> => { throw new Error('Maintenance is not available in this read-only test fixture.'); };
export const maintenanceStub: Pick<CatalogRepository, 'saveCategory' | 'moveCategory' | 'deleteCategory' | 'createProduct' | 'updateProduct' | 'addIdentifier' | 'correctIdentifier' | 'verifyIdentifier' | 'retireIdentifier' | 'getHistory' | 'exportBackup' | 'previewBackup' | 'importBackup'> = {
  saveCategory: unavailable, moveCategory: unavailable, deleteCategory: unavailable, createProduct: unavailable, updateProduct: unavailable, addIdentifier: unavailable, correctIdentifier: unavailable, verifyIdentifier: unavailable, retireIdentifier: unavailable, getHistory: async () => [], exportBackup: unavailable, previewBackup: unavailable, importBackup: unavailable,
};
