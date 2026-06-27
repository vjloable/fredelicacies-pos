'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import {
  openShift as openShiftService,
  closeShift as closeShiftService,
  getActiveShift,
} from '@/services/shiftService';
import { createSafeDrop, getDropsByShift } from '@/services/safeDropService';
import { supabase } from '@/lib/supabase';
import { createWriteOff, getWriteOffsByShift } from '@/services/writeOffService';
import type { Shift, ShiftReportData } from '@/types/domain/shift';
import type { SafeDrop } from '@/types/domain/safeDrop';
import type { WriteOff, WriteOffType } from '@/types/domain/writeOff';

interface ShiftContextValue {
  // State
  activeShift: Shift | null;
  safeDrops: SafeDrop[];
  writeOffs: WriteOff[];
  safeDropTotal: number;
  loading: boolean;
  error: string | null;
  isExempt: boolean;
  hasActiveShift: boolean;
  canManageShift: boolean;

  // Modal visibility
  showOpenShiftModal: boolean;
  showCloseShiftModal: boolean;
  showShiftReport: boolean;
  shiftReportData: ShiftReportData | null;

  // Actions
  openShift: (beginningCash: number) => Promise<void>;
  closeShift: (actualCash: number, remarks?: string) => Promise<void>;
  addSafeDrop: (amount: number, receiverId: string) => Promise<void>;
  addWriteOff: (data: {
    type: WriteOffType;
    itemId?: string;
    itemName: string;
    quantity: number;
    amount: number;
    reason?: string;
  }) => Promise<void>;
  refreshShift: () => Promise<void>;

  // Modal control
  requestOpenShift: () => void;
  requestCloseShift: () => void;
  dismissOpenShiftModal: () => void;
  dismissCloseShiftModal: () => void;
  dismissShiftReport: () => void;
  clearError: () => void;
}

const ShiftContext = createContext<ShiftContextValue | null>(null);

const noop = async () => {};
const noopShift: ShiftContextValue = {
  activeShift: null,
  safeDrops: [],
  writeOffs: [],
  safeDropTotal: 0,
  loading: false,
  error: null,
  isExempt: true,
  hasActiveShift: false,
  canManageShift: false,
  showOpenShiftModal: false,
  showCloseShiftModal: false,
  showShiftReport: false,
  shiftReportData: null,
  openShift: noop,
  closeShift: noop,
  addSafeDrop: noop,
  addWriteOff: noop,
  refreshShift: noop,
  requestOpenShift: () => {},
  requestCloseShift: () => {},
  dismissOpenShiftModal: () => {},
  dismissCloseShiftModal: () => {},
  dismissShiftReport: () => {},
  clearError: () => {},
};

/** Safe to call outside ShiftProvider — returns inert defaults on pages without a branch. */
export function useShift(): ShiftContextValue {
  const ctx = useContext(ShiftContext);
  return ctx ?? noopShift;
}

export function ShiftProvider({ children }: { children: ReactNode }) {
  const { user, isUserOwner } = useAuth();
  const { currentBranch } = useBranch();

  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [safeDrops, setSafeDrops] = useState<SafeDrop[]>([]);
  const [writeOffs, setWriteOffs] = useState<WriteOff[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [showShiftReport, setShowShiftReport] = useState(false);
  const [shiftReportData, setShiftReportData] = useState<ShiftReportData | null>(null);

  const isExempt = isUserOwner();
  const hasActiveShift = isExempt || !!activeShift;
  const safeDropTotal = safeDrops.reduce((sum, d) => sum + d.amount, 0);

  // Managers and owners can open/close shifts
  const canManageShift = isExempt || (user?.roleAssignments?.some(
    (ra) => ra.role === 'manager' && ra.branchId === currentBranch?.id && ra.isActive
  ) ?? false);

  // Load active shift for the branch on mount / branch change
  useEffect(() => {
    if (!currentBranch) return;
    let cancelled = false;

    (async () => {
      const { shift } = await getActiveShift(currentBranch.id);
      if (cancelled) return;
      if (shift) {
        setActiveShift(shift);
        const [dropsResult, writeOffsResult] = await Promise.all([
          getDropsByShift(shift.id),
          getWriteOffsByShift(shift.id),
        ]);
        if (!cancelled) {
          setSafeDrops(dropsResult.drops || []);
          setWriteOffs(writeOffsResult.writeOffs || []);
        }
      } else {
        setActiveShift(null);
        setSafeDrops([]);
        setWriteOffs([]);
      }
    })();

    return () => { cancelled = true; };
  }, [currentBranch]);

  const refreshShift = useCallback(async () => {
    if (!currentBranch) return;
    const { shift } = await getActiveShift(currentBranch.id);
    setActiveShift(shift);
    if (shift) {
      const [d, w] = await Promise.all([
        getDropsByShift(shift.id),
        getWriteOffsByShift(shift.id),
      ]);
      setSafeDrops(d.drops || []);
      setWriteOffs(w.writeOffs || []);
    } else {
      setSafeDrops([]);
      setWriteOffs([]);
    }
  }, [currentBranch]);

  const openShift = useCallback(async (beginningCash: number) => {
    if (!user || !currentBranch) return;
    setLoading(true);
    setError(null);
    const { shift, error: err } = await openShiftService(
      currentBranch.id,
      user.uid,
      beginningCash,
    );
    setLoading(false);
    if (err && !shift) {
      setError(err.message || 'Failed to open shift');
      return;
    }
    if (shift) {
      setActiveShift(shift);
      setSafeDrops([]);
      setWriteOffs([]);
    }
    setShowOpenShiftModal(false);
  }, [user, currentBranch]);

  const closeShift = useCallback(async (actualCash: number, remarks?: string) => {
    if (!activeShift || !user || !currentBranch) return;
    setLoading(true);
    setError(null);
    const { reportData, error: err } = await closeShiftService(
      activeShift.id,
      currentBranch.id,
      user.uid,
      actualCash,
      remarks,
    );
    setLoading(false);
    if (err) {
      setError(err.message || 'Failed to close shift');
      return;
    }

    // Auto-clock-out all workers still clocked in at this branch
    const now = new Date().toISOString();
    await supabase
      .from('attendance')
      .update({ clock_out: now })
      .eq('branch_id', currentBranch.id)
      .is('clock_out', null);

    setActiveShift(null);
    setSafeDrops([]);
    setWriteOffs([]);
    setShowCloseShiftModal(false);
    if (reportData) {
      setShiftReportData(reportData);
      setShowShiftReport(true);
    }
  }, [activeShift, user, currentBranch]);

  const addSafeDrop = useCallback(async (amount: number, receiverId: string) => {
    if (!activeShift || !user || !currentBranch) return;
    setLoading(true);
    setError(null);
    const { safeDrop, error: err } = await createSafeDrop(
      activeShift.id,
      currentBranch.id,
      user.uid,
      amount,
      receiverId,
    );
    setLoading(false);
    if (err) {
      setError(err.message || 'Failed to create safe drop');
      return;
    }
    if (safeDrop) {
      setSafeDrops(prev => [...prev, safeDrop]);
    }
  }, [activeShift, user, currentBranch]);

  const addWriteOff = useCallback(async (data: {
    type: WriteOffType;
    itemId?: string;
    itemName: string;
    quantity: number;
    amount: number;
    reason?: string;
  }) => {
    if (!user || !currentBranch) return;
    setLoading(true);
    setError(null);
    const { writeOff, error: err } = await createWriteOff(
      currentBranch.id,
      user.uid,
      {
        shiftId: activeShift?.id,
        type: data.type,
        itemId: data.itemId,
        itemName: data.itemName,
        quantity: data.quantity,
        amount: data.amount,
        reason: data.reason,
      },
    );
    setLoading(false);
    if (err) {
      setError(err.message || 'Failed to create write-off');
      return;
    }
    if (writeOff) {
      setWriteOffs(prev => [...prev, writeOff]);
    }
  }, [activeShift, user, currentBranch]);

  // Modal control — shift is managed independently, not tied to clock-in/out
  const requestOpenShift = useCallback(() => {
    if (!canManageShift) return;
    setShowOpenShiftModal(true);
  }, [canManageShift]);

  const requestCloseShift = useCallback(() => {
    if (!canManageShift || !activeShift) return;
    setShowCloseShiftModal(true);
  }, [canManageShift, activeShift]);

  const dismissOpenShiftModal = useCallback(() => {
    setShowOpenShiftModal(false);
    setError(null);
  }, []);

  const dismissCloseShiftModal = useCallback(() => {
    setShowCloseShiftModal(false);
    setError(null);
  }, []);

  const dismissShiftReport = useCallback(() => {
    setShowShiftReport(false);
    setShiftReportData(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <ShiftContext.Provider
      value={{
        activeShift,
        safeDrops,
        writeOffs,
        safeDropTotal,
        loading,
        error,
        isExempt,
        hasActiveShift,
        canManageShift,
        showOpenShiftModal,
        showCloseShiftModal,
        showShiftReport,
        shiftReportData,
        openShift,
        closeShift,
        addSafeDrop,
        addWriteOff,
        refreshShift,
        requestOpenShift,
        requestCloseShift,
        dismissOpenShiftModal,
        dismissCloseShiftModal,
        dismissShiftReport,
        clearError,
      }}
    >
      {children}
    </ShiftContext.Provider>
  );
}
