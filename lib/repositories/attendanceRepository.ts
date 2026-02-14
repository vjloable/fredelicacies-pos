// Attendance Repository - Handles time tracking data access
import { supabase } from '@/lib/supabase';
import type { Attendance } from '@/types/domain/attendance';

export const attendanceRepository = {
  // Clock in a worker
  async clockIn(branchId: string, workerId: string): Promise<{ attendance: Attendance | null; error: any }> {
    const { data, error } = await supabase
      .from('attendance')
      .insert({
        branch_id: branchId,
        worker_id: workerId,
        clock_in: new Date().toISOString(),
      })
      .select()
      .single();

    return { attendance: data, error };
  },

  // Clock out a worker
  async clockOut(attendanceId: string): Promise<{ attendance: Attendance | null; error: any }> {
    const { data, error } = await supabase
      .from('attendance')
      .update({
        clock_out: new Date().toISOString(),
      })
      .eq('id', attendanceId)
      .select()
      .single();

    return { attendance: data, error };
  },

  // Get active attendance for a worker (not clocked out)
  async getActiveByWorker(workerId: string): Promise<{ attendance: Attendance | null; error: any }> {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('worker_id', workerId)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
      .maybeSingle();

    return { attendance: data, error };
  },

  // Get attendance records by branch with date filter
  async getByBranch(
    branchId: string,
    options?: { startDate?: Date; endDate?: Date }
  ): Promise<{ records: Attendance[]; error: any }> {
    let query = supabase
      .from('attendance')
      .select('*')
      .eq('branch_id', branchId)
      .order('clock_in', { ascending: false });

    if (options?.startDate) {
      query = query.gte('clock_in', options.startDate.toISOString());
    }
    if (options?.endDate) {
      query = query.lte('clock_in', options.endDate.toISOString());
    }

    const { data, error } = await query;

    return { records: data || [], error };
  },

  // Get attendance records by worker
  async getByWorker(
    workerId: string,
    options?: { startDate?: Date; endDate?: Date; limit?: number }
  ): Promise<{ records: Attendance[]; error: any }> {
    let query = supabase
      .from('attendance')
      .select('*')
      .eq('worker_id', workerId)
      .order('clock_in', { ascending: false });

    if (options?.startDate) {
      query = query.gte('clock_in', options.startDate.toISOString());
    }
    if (options?.endDate) {
      query = query.lte('clock_in', options.endDate.toISOString());
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    return { records: data || [], error };
  },

  // Get single attendance record by ID
  async getById(id: string): Promise<{ attendance: Attendance | null; error: any }> {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('id', id)
      .single();

    return { attendance: data, error };
  },

  // Subscribe to attendance changes for a branch
  subscribe(branchId: string, callback: (records: Attendance[]) => void) {
    // Initial fetch
    this.getByBranch(branchId).then(({ records }) => callback(records));

    const channel = supabase
      .channel(`attendance-${branchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `branch_id=eq.${branchId}`,
        },
        () => {
          this.getByBranch(branchId).then(({ records }) => callback(records));
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  },
};
