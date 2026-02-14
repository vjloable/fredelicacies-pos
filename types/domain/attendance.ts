// Domain entity for Attendance
export interface Attendance {
  id: string;
  branch_id: string;
  worker_id: string;
  clock_in: string;
  clock_out: string | null;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAttendanceData {
  worker_id: string;
  clock_in?: string;
  notes?: string;
}

export interface UpdateAttendanceData {
  clock_out?: string;
  notes?: string;
}
