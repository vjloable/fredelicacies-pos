// Domain entity for Worker
export interface Worker {
  id: string;
  user_id: string;
  branch_id: string;
  role: 'owner' | 'manager' | 'worker';
  pin: string | null;
  face_descriptor: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface CreateWorkerData {
  user_id: string;
  role: 'owner' | 'manager' | 'worker';
  pin?: string;
  face_descriptor?: string;
  status?: 'active' | 'inactive';
}

export interface UpdateWorkerData {
  role?: 'owner' | 'manager' | 'worker';
  pin?: string;
  face_descriptor?: string;
  status?: 'active' | 'inactive';
}
