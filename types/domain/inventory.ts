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
  // Suggested default price only — the cashier can leave this unset and price
  // the item in the order cart at checkout, like bundles.
  price: number | null;
  cost: number | null;
  grab_price: number | null;
  stock: number;
  uncarried_stock: number;
  reserved_stock: number;
  synced_from_main_at: string | null;
  // Durable FK to the commissary source product this branch row mirrors.
  // NULL on the commissary's own rows and on branch-only items. Used to repoint
  // references from branch-local ids to commissary ids in the centralized menu.
  commissary_item_id: string | null;
  // Human-assigned SKU/code, e.g. "BEV-CFLT". Unique when present.
  code: string | null;
  barcode: string | null;
  img_url: string | null;
  // Commissary custom production goods measured by a unit of measure (NULL for sellable items).
  kind: InventoryItemKind;
  is_custom: boolean;
  unit_type: InventoryUnitType | null;
  unit: string | null;
  measurement: number | null;
  // Native/atomic form of a kakanin piece, sellable standalone and/or usable
  // as a bundle component inside bilao/combo bundles. Informational only.
  is_source_piece: boolean;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface CreateInventoryItemData {
  name: string;
  price?: number | null;
  category_id?: string;
  category_ids?: string[];
  description?: string;
  stock?: number;
  code?: string;
  barcode?: string;
  img_url?: string;
  status?: 'active' | 'inactive';
  kind?: InventoryItemKind;
  is_custom?: boolean;
  unit_type?: InventoryUnitType | null;
  unit?: string | null;
  measurement?: number | null;
  is_source_piece?: boolean;
}

export interface UpdateInventoryItemData {
  name?: string;
  description?: string;
  price?: number | null;
  stock?: number;
  uncarried_stock?: number;
  category_id?: string;
  category_ids?: string[];
  code?: string;
  barcode?: string;
  img_url?: string;
  status?: 'active' | 'inactive';
  kind?: InventoryItemKind;
  is_custom?: boolean;
  unit_type?: InventoryUnitType | null;
  unit?: string | null;
  measurement?: number | null;
  is_source_piece?: boolean;
}
