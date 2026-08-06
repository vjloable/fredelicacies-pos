// Domain entity for Bundle
export interface Bundle {
  id: string;
  branch_id: string;
  name: string;
  description: string | null;
  // Suggested default price only — the cashier can leave this unset and price
  // the bundle in the order cart at checkout, like regular items.
  price: number | null;
  grab_price: number | null;
  img_url: string | null;
  is_custom: boolean;
  max_pieces: number | null;
  category_id?: string | null;
  category_ids?: string[]; // populated from bundle_categories junction table
  // Durable FK to the commissary source bundle this branch row mirrors.
  // NULL on the commissary's own bundles and on branch-only bundles.
  commissary_bundle_id?: string | null;
  // When set, this bundle is one variant ("prefix") of a single-type bundle
  // group — e.g. "Small - 50pcs - Round container" under "Macaroons Bilao".
  // The bundle itself stays an ordinary fixed bundle (own components/price);
  // this is purely a grouping/display link.
  bundle_group_id?: string | null;
  variant_label?: string | null;
  status: 'active' | 'inactive';
  needs_attention: boolean;
  created_at: string;
  updated_at: string;
}

// A single-type bundle group: shared name/image/category for a set of
// fixed-bundle variants (sizes/prefixes) of the same kakanin type.
export interface BundleGroup {
  id: string;
  branch_id: string;
  name: string;
  description: string | null;
  img_url: string | null;
  category_id?: string | null;
  category_ids?: string[]; // populated from bundle_group_categories junction table
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface BundleGroupWithVariants extends BundleGroup {
  variants: BundleWithComponents[];
}

// One variant row as authored in the Add/Edit Bundle modal's group mode.
export interface BundleGroupVariantInput {
  id?: string; // present when editing an existing variant bundle
  variantLabel: string;
  price: number | null;
  grab_price: number | null;
  components: Array<{ inventoryItemId: string; quantity: number }>;
}

export interface CreateBundleGroupData {
  name: string;
  description?: string;
  img_url?: string;
  category_id?: string | null;
  category_ids?: string[];
  status?: 'active' | 'inactive';
  variants: BundleGroupVariantInput[];
}

export interface UpdateBundleGroupData {
  name?: string;
  description?: string;
  img_url?: string;
  category_id?: string | null;
  category_ids?: string[];
  status?: 'active' | 'inactive';
  variants: BundleGroupVariantInput[];
}

export interface BundleComponent {
  id: string;
  bundle_id: string;
  inventory_item_id: string;
  quantity: number;
  created_at: string;
  inventory_item?: any; // For joined queries
}

export interface BundleAdditionalItem {
  id: string;
  bundle_id: string;
  inventory_item_id: string;
  quantity: number;
  created_at: string;
  inventory_item?: any; // For joined queries
}

export interface BundleWithComponents extends Bundle {
  components: BundleComponent[];
  additional_items: BundleAdditionalItem[];
}

export interface CreateBundleData {
  name: string;
  price?: number | null;
  grab_price?: number | null;
  description?: string;
  img_url?: string;
  is_predefined?: boolean;
  is_custom?: boolean;
  max_pieces?: number | null;
  category_id?: string | null;
  category_ids?: string[];
  status?: 'active' | 'inactive';
  bundle_group_id?: string | null;
  variant_label?: string | null;
}

export interface UpdateBundleData {
  name?: string;
  description?: string;
  price?: number | null;
  grab_price?: number | null;
  img_url?: string;
  is_custom?: boolean;
  max_pieces?: number | null;
  category_id?: string | null;
  category_ids?: string[];
  status?: 'active' | 'inactive';
  bundle_group_id?: string | null;
  variant_label?: string | null;
}
