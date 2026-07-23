// Measurement family for commissary custom items.
export type InventoryUnitType = 'liquid' | 'solid' | 'piece';

// Commissary classification of an inventory row.
export type InventoryItemKind = 'item' | 'product' | 'ingredient';

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
  uncarried_stock: number;
  reserved_stock: number;
  synced_from_main_at: string | null;
  barcode: string | null;
  img_url: string | null;
  // Commissary custom production goods measured by a unit of measure (NULL for sellable items).
  kind: InventoryItemKind;
  is_custom: boolean;
  unit_type: InventoryUnitType | null;
  unit: string | null;
  measurement: number | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface CreateInventoryItemData {
  name: string;
  price?: number;
  category_id?: string;
  category_ids?: string[];
  description?: string;
  stock?: number;
  barcode?: string;
  img_url?: string;
  status?: 'active' | 'inactive';
  kind?: InventoryItemKind;
  is_custom?: boolean;
  unit_type?: InventoryUnitType | null;
  unit?: string | null;
  measurement?: number | null;
}

export interface UpdateInventoryItemData {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  uncarried_stock?: number;
  category_id?: string;
  category_ids?: string[];
  barcode?: string;
  img_url?: string;
  status?: 'active' | 'inactive';
  kind?: InventoryItemKind;
  is_custom?: boolean;
  unit_type?: InventoryUnitType | null;
  unit?: string | null;
  measurement?: number | null;
}
