/**
 * API types
 * 
 * Purpose : TypeScript mirrors of the backend schemas.py models. These are the shapes the screens read: table rows joined and enriched, which is why they differ from database.ts.
 * Spec    : Section 3
 * Look here when : The app expects a field the backend does not send.
 */

import type { OrderStatus } from './orderStatus';
import type { CatalogProduct, Role } from './database';

/** Spec 6.2 — three states, matching the three pie segments exactly. */
export type StockStatus = 'in_stock' | 'low_stock' | 'restock_requested';

/** A stock item as the Stocks feed renders it: the row joined to its catalog product. */
export interface StockItemView {
  id: string;
  product: CatalogProduct;
  quantity_on_hand: number;
  low_threshold: number;
  restock_requested: boolean;
  preferred_supplier_id: string | null;
  preferred_supplier_name: string | null;
  unit_price: number | null;
  /** Derived by the backend so the chart and the list can never disagree. Spec 6.2. */
  status: StockStatus;
}

export interface StockSummary {
  total: number;
  in_stock: number;
  low_stock: number;
  restock_requested: number;
}

/** Spec 6.2 seasonal warning card. */
export interface SeasonalWarning {
  id: string;
  name: string;
  event_date: string;
  weeks_away: number;
  affected_categories: string[];
  products: {
    stock_item_id: string;
    name: string;
    pack_size: string;
    suggested_quantity: number;
  }[];
}

/** Spec 9.1 and 12 — a supplier as the Suppliers feed renders it. */
export interface SupplierView {
  id: string;
  business_name: string;
  city: string | null;
  is_active: boolean;
  /** Spec 12: composite rank score out of 100. Null until the daily job has run. */
  score: number | null;
  average_rating: number | null;
  rating_count: number;
  /** Measured from completed orders, never the supplier's own stated lead time. Spec 12.1. */
  measured_delivery_days: number | null;
  /** Spec 12.2 — fewer than the configured minimum of completed orders. */
  is_new_supplier: boolean;
  /** Selection mode only, spec 9.3: shown but marked when they cannot fill the order. */
  can_meet_quantity?: boolean;
  /** Product-search results carry the matching listing. Spec 9.1. */
  listing?: {
    unit_price: number;
    quantity_available: number;
    lead_time_days: number;
    min_order_quantity: number;
  };
}

export interface SupplierProfileView extends SupplierView {
  contact_person: string;
  phone: string;
  whatsapp_number: string | null;
  email: string;
  address: string | null;
  delivery_areas: string[] | null;
  listings: ListingView[];
  order_history: OrderSummary[];
}

/** Spec 10.1 — a supplier's own listing, joined to the catalog product. */
export interface ListingView {
  id: string;
  product: CatalogProduct;
  quantity_available: number;
  unit_price: number;
  min_order_quantity: number;
  lead_time_days: number;
  is_active: boolean;
  /** Spec 10.1 — drives the supplier's own low-availability warning. */
  is_low: boolean;
}

/** The order card in both roles' feeds. Spec 8.2 and 10.2. */
export interface OrderSummary {
  id: string;
  reference: string;
  status: OrderStatus;
  channel: string;
  counterparty_name: string;
  counterparty_city: string | null;
  item_count: number;
  total_quantity: number;
  total_value: number;
  requested_at: string;
  requested_delivery_date: string | null;
  supplier_marked_delivered_at: string | null;
  rejection_reason: string | null;
  /** "Papadam", or "Papadam +2 more". Null on an order with no lines. */
  product_summary: string | null;
}

export interface OrderDetailView extends OrderSummary {
  message_body: string;
  items: {
    catalog_product_id: string;
    name: string;
    pack_size: string;
    quantity_requested: number;
    unit_price_at_order: number;
  }[];
  stage_history: { status: OrderStatus; at: string }[];
  counterparty_phone: string | null;
  counterparty_address: string | null;
  rating: { quality_score: number; comment: string | null } | null;
}

/** Spec 6.5 — everything the restock popup needs, in one payload. */
export interface RestockLine {
  /** Null for a product the shop has never stocked, ordered from the Suppliers feed. */
  stock_item_id: string | null;
  catalog_product_id: string;
  name: string;
  pack_size: string;
  quantity_requested: number;
  /** From the chosen supplier's listing. Drives the validation message in spec 6.5. */
  quantity_available: number | null;
  min_order_quantity: number | null;
  unit_price: number | null;
}

export interface RestockDraft {
  supplier: SupplierView | null;
  message_body: string;
  /** The last text the backend produced, kept so an edit can be detected anywhere. Spec 6.5. */
  generated_message: string;
  /** True once the customer edits the text. Drives the overwrite warning. Spec 6.5. */
  message_edited: boolean;
  requested_delivery_date: string | null;
  notes: string;
  lines: RestockLine[];
  /** Same product already on order with someone else. Shown, never blocking. Spec 6.5. */
  warnings: string[];
  /** True once the owner has confirmed a repeat order with the same supplier. */
  allow_duplicate: boolean;
}

export interface AuthProfile {
  id: string;
  role: Role;
  business_name: string;
  contact_person: string;
  email: string;
  phone: string;
}

/** Spec 7.1 — the five reports that need no machine learning. */
export interface ReportSection {
  key: string;
  title: string;
  description: string;
  icon: string;
}

/** One day on the inventory line. Spec 7.1. */
export interface TrendPoint {
  date: string;
  total_units: number;
}

export interface InventoryLine {
  stock_item_id: string;
  name: string;
  pack_size: string;
  quantity_on_hand: number;
  low_threshold: number;
  unit_price: number | null;
  value: number | null;
  status: StockStatus;
}

/**
 * Spec 7.1. Every figure is computed by the backend, including `status`, which comes from
 * the same classifier the pie chart reads — so a report cannot disagree with the Stocks
 * screen it was generated from.
 */
export interface InventoryReport {
  generated_at: string;
  days: number;
  total_products: number;
  total_units: number;
  /** Null, not zero, when nothing has a price — zero would read as "worth nothing". */
  total_value: number | null;
  priced_products: number;
  in_stock: number;
  low_stock: number;
  restock_requested: number;
  at_zero: number;
  trend: TrendPoint[];
  items: InventoryLine[];
}
