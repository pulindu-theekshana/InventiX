/**
 * Orders data hook
 * 
 * Purpose : Fetching and refreshing orders for both roles.
 * Spec    : Section 8 and 10.2
 * Look here when : An order list does not refresh after an action.
 */

import { useAsync } from './useAsync';
import * as delivery from '../api/delivery';
import * as orders from '../api/orders';

/** Customer Delivery feed, spec 8.1. */
export function useCustomerOrders() {
  return useAsync(() => delivery.listOrders(), []);
}

export function useCustomerOrder(id: string) {
  return useAsync(() => delivery.getOrder(id), [id]);
}

/** Supplier Orders and Delivery feeds, spec 10.2 and 10.3. Same rows, different filters. */
export function useSupplierOrders() {
  return useAsync(() => orders.listOrders(), []);
}

export function useSupplierOrder(id: string) {
  return useAsync(() => orders.getOrder(id), [id]);
}
