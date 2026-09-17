/**
 * Open restock
 *
 * Purpose : Writes the restock message for one or more stock items and opens the restock flow. Shared by the Stocks home and the festival screen, so both pick the supplier the same way.
 * Spec    : Section 6.4, 6.5 and 9.1
 * Look here when : Tapping Restock or a festival product does nothing, or picks the wrong supplier.
 */

import { router } from 'expo-router';
import { useSuppliers } from './useSuppliers';
import { useSubmit } from './useSubmit';
import { searchByProduct } from '../api/suppliers';
import { generateMessage } from '../api/ordering';
import * as draftStore from '../stores/restockDraftStore';
import type { StockItemView } from '../types/api';

export function useOpenRestock() {
  const suppliers = useSuppliers('');
  const submit = useSubmit();

  async function open(chosen: StockItemView[], suggestedQuantity?: number) {
    await submit.run(async () => {
      const supplierName = chosen[0]?.preferred_supplier_name ?? null;
      let supplier = (suppliers.data ?? []).find((s) => s.business_name === supplierName) ?? null;

      /**
       * A product the shop has never ordered has no preferred supplier, and the message
       * cannot be written without one -- the prices, the minimum and the availability all
       * come from that supplier's listing. The backend returns whoever sells it, best
       * ranked first (spec 9.1), which is the same choice the Suppliers feed would offer.
       */
      if (!supplier && chosen.length === 1) {
        const ranked = await searchByProduct(chosen[0].product.id);
        supplier = ranked[0] ?? null;
      }
      if (!supplier) {
        throw new Error(
          `No supplier on InventiX lists ${chosen[0]?.product.name ?? 'that product'} yet.`,
        );
      }

      const lines = chosen.map((item) => ({
        stock_item_id: item.id,
        catalog_product_id: item.product.id,
        name: item.product.name,
        pack_size: item.product.pack_size,
        quantity_requested:
          suggestedQuantity ?? Math.max(item.low_threshold * 2 - item.quantity_on_hand, 1),
        quantity_available: supplier.listing?.quantity_available ?? null,
        min_order_quantity: supplier.listing?.min_order_quantity ?? null,
        // The row price can be a different supplier's cheapest; the order uses this supplier's.
        unit_price: supplier.listing?.unit_price ?? item.unit_price ?? null,
      }));

      const { message_body, warnings } = await generateMessage(lines, supplier);
      draftStore.openDraft(lines, supplier, message_body, warnings);
      router.push('/(customer)/restock' as never);
    });
  }

  return { open, error: submit.error };
}
