// Domain entity for Activity Log

export type LogAction =
  | 'login'
  | 'logout'
  | 'time_in'
  | 'time_out'
  | 'item_created'
  | 'item_deleted'
  | 'item_renamed'
  | 'item_price_changed'
  | 'item_photo_changed'
  | 'item_category_changed'
  | 'stock_added'
  | 'stock_removed'
  | 'bundle_created'
  | 'bundle_updated'
  | 'bundle_deleted'
  | 'bundle_status_changed'
  | 'order_created'
  | 'discount_created'
  | 'discount_updated'
  | 'discount_deleted'
  | 'worker_added'
  | 'worker_removed'
  | 'eod_lock_item'
  | 'eod_unlock_item'
  | 'eod_submit'
  | 'transfer_created'
  | 'transfer_fulfilled'
  | 'transfer_received'
  | 'transfer_cancelled'
  | 'catalog_synced'
  | 'bundle_marked_inactive'
  | 'order_voided'
  | 'order_refunded'
  | 'shift_opened'
  | 'shift_closed'
  | 'safe_drop'
  | 'write_off_created';

export interface ActivityLog {
  id: string;
  branch_id: string | null;
  user_id: string | null;
  action: LogAction | string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, any> | null;
  created_at: string;
  user_name?: string; // populated by join with user_profiles
}
