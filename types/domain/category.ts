// Domain entity for Category
export interface Category {
  id: string;
  branch_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoryData {
  name: string;
  color: string;
}

export interface UpdateCategoryData {
  name?: string;
  color?: string;
}
