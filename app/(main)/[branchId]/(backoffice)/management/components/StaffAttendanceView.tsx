import { useState } from 'react';
import StaffPanel from './staff-attendance/StaffPanel';
import TabletsPanel from './staff-attendance/TabletsPanel';
import TimeRecordsPanel from './staff-attendance/TimeRecordsPanel';

type Section = 'records' | 'staff' | 'tablets';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'records', label: 'Time records' },
  { id: 'staff', label: 'Staff' },
  { id: 'tablets', label: 'Tablets' },
];

// Management → Staff Attendance: the face kiosk system for everyone at the
// branch. Separate from the POS cashier clock-in shown under "Attendance".
export default function StaffAttendanceView({ branchId }: { branchId: string }) {
  const [section, setSection] = useState<Section>('records');

  return (
    <div className='space-y-4'>
      <div className='flex gap-2'>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
              section === s.id ? 'bg-secondary text-primary border-secondary' : 'border-secondary/20 text-secondary'
            }`}>
            {s.label}
          </button>
        ))}
      </div>
      {section === 'records' && <TimeRecordsPanel branchId={branchId} />}
      {section === 'staff' && <StaffPanel branchId={branchId} />}
      {section === 'tablets' && <TabletsPanel branchId={branchId} />}
    </div>
  );
}
