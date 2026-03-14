// Domain entity for Inventory Item
export interface InventoryItem {
  id: string;
  branch_id: string;
  category_id: string | null;
  category_ids?: string[]; // populated from inventory_item_categories junction table
  name: string;
  description: string | null;
  price: number;
  cost: number | null;
  grab_price: number | null;
  stock: number;
  barcode: string | null;
  img_url: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface CreateInventoryItemData {
  name: string;
  price: number;
  category_id?: string;
  category_ids?: string[];
  description?: string;
  cost?: number;
  grab_price?: number | null;
  stock?: number;
  barcode?: string;
  img_url?: string;
  status?: 'active' | 'inactive';
}

export interface UpdateInventoryItemData {
  name?: string;
  description?: string;
  price?: number;
  cost?: number;
  grab_price?: number | null;
  stock?: number;
  category_id?: string;
  category_ids?: string[];
  barcode?: string;
  img_url?: string;
  status?: 'active' | 'inactive';
}
