import { attendanceRepository } from '@/lib/repositories';
import type { Attendance } from '@/types/domain';

export type { Attendance };

export interface AttendanceService {
  // Core CRUD operations
  clockIn: (branchId: string, workerId: string) => Promise<{ id: string | null; error: any }>;
  clockOut: (attendanceId: string) => Promise<{ attendance: Attendance | null; error: any }>;
  getActiveAttendance: (workerId: string) => Promise<{ attendance: Attendance | null; error: any }>;
  getAttendancesByBranch: (branchId: string, startDate?: Date, endDate?: Date) => Promise<{ records: Attendance[]; error: any }>;
  getAttendancesByWorker: (workerId: string, startDate?: Date, endDate?: Date, limit?: number) => Promise<{ records: Attendance[]; error: any }>;
}

export const attendanceService: AttendanceService = {
  clockIn: async (branchId: string, workerId: string): Promise<{ id: string | null; error: any }> => {
    const { attendance, error } = await attendanceRepository.clockIn(branchId, workerId);
    return { id: attendance?.id || null, error };
  },

  clockOut: async (attendanceId: string): Promise<{ attendance: Attendance | null; error: any }> => {
    return await attendanceRepository.clockOut(attendanceId);
  },

  getActiveAttendance: async (workerId: string): Promise<{ attendance: Attendance | null; error: any }> => {
    return await attendanceRepository.getActiveByWorker(workerId);
  },

  getAttendancesByBranch: async (
    branchId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ records: Attendance[]; error: any }> => {
    return await attendanceRepository.getByBranch(branchId, { startDate, endDate });
  },

  getAttendancesByWorker: async (
    workerId: string,
    startDate?: Date,
    endDate?: Date,
    limit?: number
  ): Promise<{ records: Attendance[]; error: any }> => {
    return await attendanceRepository.getByWorker(workerId, { startDate, endDate, limit });
  },
};
