// Domain entity for Bundle
export interface Bundle {
  id: string;
  branch_id: string;
  name: string;
  description: string | null;
  price: number;
  img_url: string | null;
  is_custom: boolean;
  max_pieces: number | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface BundleComponent {
  id: string;
  bundle_id: string;
  inventory_item_id: string;
  quantity: number;
  created_at: string;
  inventory_item?: any; // For joined queries
}

export interface BundleWithComponents extends Bundle {
  components: BundleComponent[];
}

export interface CreateBundleData {
  name: string;
  price: number;
  description?: string;
  img_url?: string;
  is_predefined?: boolean;
  is_custom?: boolean;
  max_pieces?: number | null;
  status?: 'active' | 'inactive';
}

export interface UpdateBundleData {
  name?: string;
  description?: string;
  price?: number;
  img_url?: string;
  is_custom?: boolean;
  max_pieces?: number | null;
  status?: 'active' | 'inactive';
}
