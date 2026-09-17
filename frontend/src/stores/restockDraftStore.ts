/**
 * Restock draft store
 * 
 * Purpose : Holds the in-progress restock popup across the trip to the Suppliers screen and back, including the edited flag.
 * Spec    : Section 6.5
 * Look here when : An edit is lost when changing supplier.
 */

import type { RestockDraft, RestockLine, SupplierView } from '../types/api';

let draft: RestockDraft | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDraft(): RestockDraft | null {
  return draft;
}

export function openDraft(
  lines: RestockLine[],
  supplier: SupplierView | null,
  message: string,
  warnings: string[] = [],
  allowDuplicate = false,
) {
  draft = {
    supplier,
    lines,
    message_body: message,
    generated_message: message,
    message_edited: false,
    warnings,
    allow_duplicate: allowDuplicate,
    requested_delivery_date: null,
    notes: '',
  };
  emit();
}

export function closeDraft() {
  draft = null;
  emit();
}

/**
 * Spec 6.5: edited state is tracked by comparing against the generated text, not by a flag the
 * UI sets on every keystroke. If the customer edits and then types the original back, nothing
 * has actually been lost and they should not be warned.
 */
export function editMessage(text: string) {
  if (!draft) return;
  draft = {
    ...draft,
    message_body: text,
    message_edited: text.trim() !== draft.generated_message.trim(),
  };
  emit();
}

/** Lines are keyed by catalog product: one per product per order, and a new product has no stock item. */
export function setQuantity(catalogProductId: string, quantity: number) {
  if (!draft) return;
  draft = {
    ...draft,
    lines: draft.lines.map((l) =>
      l.catalog_product_id === catalogProductId ? { ...l, quantity_requested: quantity } : l,
    ),
  };
  emit();
}

export function removeLine(catalogProductId: string) {
  if (!draft) return;
  draft = { ...draft, lines: draft.lines.filter((l) => l.catalog_product_id !== catalogProductId) };
  emit();
}

export function setField(field: 'notes' | 'requested_delivery_date', value: string) {
  if (!draft) return;
  draft = { ...draft, [field]: value };
  emit();
}

/**
 * Replaces the text after the backend has rebuilt it, which happens when a note or the
 * delivery date changes — the message names both. The new text becomes the generated
 * baseline too, so the customer is not warned about an edit they never made.
 *
 * Only called while message_edited is false: their own wording is theirs to keep.
 */
export function applyRegenerated(text: string) {
  if (!draft) return;
  draft = { ...draft, message_body: text, generated_message: text, message_edited: false };
  emit();
}

/**
 * Spec 6.5: the message is regenerated in full by the backend, never patched by find and
 * replace, because a different supplier has different prices, availability and minimums.
 */
export function changeSupplier(supplier: SupplierView, regenerated: string) {
  if (!draft) return;
  draft = {
    ...draft,
    supplier,
    message_body: regenerated,
    generated_message: regenerated,
    message_edited: false,
    lines: draft.lines.map((l) => ({
      ...l,
      quantity_available: supplier.listing?.quantity_available ?? null,
      min_order_quantity: supplier.listing?.min_order_quantity ?? null,
      unit_price: supplier.listing?.unit_price ?? null,
    })),
  };
  emit();
}

/**
 * Spec 6.5 quantity validation. Returns one message per offending line, naming the product
 * and the limit. Send is disabled while this is non-empty, and the reason is always shown.
 */
export function validate(d: RestockDraft | null): string[] {
  if (!d) return [];
  if (!d.supplier) return ['Choose a supplier before sending.'];
  if (d.lines.length === 0) return ['Add at least one product.'];

  const problems: string[] = [];
  for (const line of d.lines) {
    if (line.quantity_requested <= 0) {
      problems.push(`Enter a quantity for ${line.name}.`);
      continue;
    }
    if (line.quantity_available != null && line.quantity_requested > line.quantity_available) {
      problems.push(
        `${d.supplier.business_name} has only ${line.quantity_available} units of ${line.name} ${line.pack_size}.`,
      );
    }
    if (line.min_order_quantity != null && line.quantity_requested < line.min_order_quantity) {
      problems.push(
        `${d.supplier.business_name} needs at least ${line.min_order_quantity} units of ${line.name} ${line.pack_size}.`,
      );
    }
  }
  return problems;
}
