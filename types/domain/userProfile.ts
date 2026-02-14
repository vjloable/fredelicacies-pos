// User Profile Domain Types
export interface UserProfile {
  id: string; // References auth.users(id)
  email: string;
  name: string;
  phone_number?: string;
  employee_id?: string;
  profile_picture?: string;
  is_owner: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CreateUserProfileData {
  id: string; // Must match auth.users(id)
  email: string;
  name: string;
  phone_number?: string;
  employee_id?: string;
  profile_picture?: string;
  is_owner?: boolean;
  created_by?: string;
}

export interface UpdateUserProfileData {
  name?: string;
  phone_number?: string;
  employee_id?: string;
  profile_picture?: string;
  is_active?: boolean;
  // is_owner can only be updated by owners (handled by RLS)
  is_owner?: boolean;
}

// Extended User Profile with Role Assignments (for compatibility with existing code)
export interface RoleAssignment {
  branchId: string;
  role: 'manager' | 'worker';
  assignedAt: string | Date;
  assignedBy?: string;
  isActive: boolean;
}

export interface UserWithRoles extends UserProfile {
  roleAssignments: RoleAssignment[];
}
