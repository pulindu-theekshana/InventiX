/**
 * Suppliers data hook
 * 
 * Purpose : Supplier search and profile fetching.
 * Spec    : Section 9
 * Look here when : Supplier data is stale.
 */

import { useAsync } from './useAsync';
import { getSupplier, listSuppliers, searchByProduct, searchForOrder } from '../api/suppliers';

export function useSuppliers(query: string) {
  return useAsync(() => listSuppliers(query), [query]);
}

export function useSupplier(id: string) {
  return useAsync(() => getSupplier(id), [id]);
}

/** Spec 9.1 by-product search, already in ranking order from the backend. */
export function useSuppliersForProduct(catalogProductId: string | null) {
  return useAsync(
    () => (catalogProductId ? searchByProduct(catalogProductId) : Promise.resolve([])),
    [catalogProductId],
  );
}

/** Spec 9.3 selection mode, which additionally marks who cannot meet the quantity. */
export function useSuppliersForOrder(catalogProductId: string | null, quantity: number) {
  return useAsync(
    () => (catalogProductId ? searchForOrder(catalogProductId, quantity) : Promise.resolve([])),
    [catalogProductId, quantity],
  );
}
