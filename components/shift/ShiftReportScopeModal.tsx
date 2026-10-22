'use client';

import type { Shift } from '@/types/domain/shift';
import type { ShiftReportScope } from '@/services/shiftService';
import { shiftOverlapsToday } from '@/services/shiftService';

interface ShiftReportScopeModalProps {
  shift: Shift;
  onSelect: (scope: ShiftReportScope) => void;
  onCancel: () => void;
}

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function ScopeOption({ title, description, disabled, onClick }: { title: string; description: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left px-4 py-3 border border-gray-200 rounded-xl hover:border-accent hover:bg-accent/5 transition-colors disabled:opacity-40 disabled:pointer-events-none"
    >
      <p className="text-xs font-semibold text-secondary">{title}</p>
      <p className="text-2.5 text-secondary/60 mt-0.5">{description}</p>
    </button>
  );
}

export default function ShiftReportScopeModal({ shift, onSelect, onCancel }: ShiftReportScopeModalProps) {
  const hasToday = shiftOverlapsToday(shift);
  const endLabel = shift.closed_at ? formatDay(shift.closed_at) : 'now';

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl max-w-sm w-full shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-sm font-bold text-secondary">Print Shift Report</h3>
          <p className="text-xs text-secondary/50 mt-0.5">
            This shift ran from {formatDay(shift.opened_at)} to {endLabel}. What should the report cover?
          </p>
        </div>

        <div className="px-5 pb-4 space-y-2">
          <ScopeOption
            title="Today's sales only"
            description={hasToday ? "Sales and cash from today only. Earlier days of this shift are left out." : `No sales today. This shift closed on ${endLabel}.`}
            disabled={!hasToday}
            onClick={() => onSelect('today')}
          />
          <ScopeOption
            title="Whole shift"
            description={`All sales from ${formatDay(shift.opened_at)} to ${endLabel}.`}
            onClick={() => onSelect('full')}
          />
        </div>

        <div className="px-5 py-3 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="w-full py-2 text-xs font-medium text-secondary border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
