/**
 * Database types
 * 
 * Purpose : TypeScript interfaces generated from the Supabase schema. Regenerate after every migration.
 * Spec    : Section 5
 * Look here when : A field name mismatch between app and database.
 */

import type { OrderStatus } from './orderStatus';

export type Role = 'customer' | 'supplier';
export type Channel = 'in_app' | 'whatsapp' | 'email';
export type UploadStatus = 'pending' | 'needs_mapping' | 'applied' | 'failed';
export type AdjustmentReason =
  | 'sales_upload'
  | 'manual'
  | 'order_received'
  | 'damage'
  | 'correction';

/** Spec 5.1 */
export interface Profile {
  id: string;
  role: Role;
  business_name: string;
  contact_person: string;
  phone: string;
  whatsapp_number: string | null;
  email: string;
  address: string | null;
  city: string | null;
  delivery_areas: string[] | null;
  is_active: boolean;
}

/** Spec 5.2 */
export interface CatalogProduct {
  id: string;
  name: string;
  category: string;
  pack_size: string;
  unit: string;
  barcode: string | null;
  is_seasonal: boolean;
  is_active: boolean;
}

/** Spec 5.3 */
export interface SupplierListing {
  id: string;
  supplier_id: string;
  catalog_product_id: string;
  quantity_available: number;
  unit_price: number;
  min_order_quantity: number;
  lead_time_days: number;
  is_active: boolean;
}

/** Spec 5.4 */
export interface StockItem {
  id: string;
  owner_id: string;
  catalog_product_id: string;
  quantity_on_hand: number;
  low_threshold: number;
  preferred_supplier_id: string | null;
  restock_requested: boolean;
  last_counted_at: string | null;
}

/** Spec 5.5 */
export interface Order {
  id: string;
  customer_id: string;
  supplier_id: string;
  status: OrderStatus;
  channel: Channel;
  message_body: string;
  message_edited: boolean;
  requested_delivery_date: string | null;
  rejection_reason: string | null;
  requested_at: string;
  confirmed_at: string | null;
  rejected_at: string | null;
  processing_at: string | null;
  put_to_delivery_at: string | null;
  on_the_way_at: string | null;
  supplier_marked_delivered_at: string | null;
  purchased_at: string | null;
  auto_confirmed: boolean;
}

/** Spec 5.6 */
export interface OrderItem {
  id: string;
  order_id: string;
  stock_item_id: string;
  listing_id: string;
  catalog_product_id: string;
  quantity_requested: number;
  unit_price_at_order: number;
}

/** Spec 5.7 */
export interface SupplierRating {
  id: string;
  order_id: string;
  customer_id: string;
  supplier_id: string;
  quality_score: number;
  comment: string | null;
}

/** Spec 5.10 */
export interface StockAdjustment {
  id: string;
  stock_item_id: string;
  change_quantity: number;
  quantity_after: number;
  reason: AdjustmentReason;
  source_id: string | null;
  created_by: string;
  created_at: string;
}

/** Spec 5.11 */
export interface SeasonalEvent {
  id: string;
  name: string;
  event_date: string;
  lead_time_months: number;
  affected_categories: string[];
  expected_uplift_pct: number;
}

/** Spec 5.12 */
export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  related_order_id: string | null;
  related_stock_item_id: string | null;
  read_at: string | null;
  created_at: string;
}
