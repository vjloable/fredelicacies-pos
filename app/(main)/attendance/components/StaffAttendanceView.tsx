import { useState, type ReactNode } from 'react';
import StaffPanel from './StaffPanel';
import TabletsPanel from './TabletsPanel';
import TimeRecordsPanel from './TimeRecordsPanel';
import { Icon } from './ui';

type Section = 'records' | 'staff' | 'tablets';

const SECTIONS: { id: Section; label: string; icon: ReactNode }[] = [
  { id: 'records', label: 'Time records', icon: <Icon.Clock /> },
  { id: 'staff', label: 'Staff', icon: <Icon.Users /> },
  { id: 'tablets', label: 'Tablets', icon: <Icon.Tablet /> },
];

const TAB_KEY = 'attendance_tab';

const savedTab = (): Section => {
  try {
    const v = localStorage.getItem(TAB_KEY);
    return v === 'staff' || v === 'tablets' ? v : 'records';
  } catch {
    return 'records';
  }
};

// Attendance: the face kiosk system for all staff. It is company-wide
// (staff rotate between branches; tablets record GPS location) and lives outside
// any branch.
export default function StaffAttendanceView() {
  // Only mounts client-side (the page shows a loader until auth resolves), so
  // reading localStorage in the initializer can't cause a hydration mismatch.
  const [section, setSection] = useState<Section>(savedTab);

  const choose = (id: Section) => {
    setSection(id);
    try {
      localStorage.setItem(TAB_KEY, id);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className='space-y-5'>
      <div role='tablist' aria-label='Attendance sections' className='flex gap-1 p-1 bg-secondary/5 rounded-xl w-full sm:w-fit overflow-x-auto'>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            role='tab'
            aria-selected={section === s.id}
            onClick={() => choose(s.id)}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg text-3 font-semibold whitespace-nowrap transition-colors ${
              section === s.id ? 'bg-white text-secondary shadow-sm' : 'text-secondary/60 hover:text-secondary'
            }`}>
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>
      {section === 'records' && <TimeRecordsPanel />}
      {section === 'staff' && <StaffPanel />}
      {section === 'tablets' && <TabletsPanel />}
    </div>
  );
}
