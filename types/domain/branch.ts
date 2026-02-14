// Domain entity for Branch
export interface Branch {
  id: string;
  name: string;
  address: string | null;
  contact_number: string | null;
  status: 'active' | 'inactive';
  logo_url: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBranchData {
  name: string;
  address?: string;
  contact_number?: string;
  logo_url?: string;
}

export interface UpdateBranchData {
  name?: string;
  address?: string;
  contact_number?: string;
  status?: 'active' | 'inactive';
  logo_url?: string;
}
