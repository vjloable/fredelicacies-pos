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

// Management → Staff Attendance: the face kiosk system for all staff. It is
// company-wide (staff rotate between branches; tablets record GPS location) and
// separate from the POS cashier clock-in shown under "Attendance".
export default function StaffAttendanceView() {
  const [section, setSection] = useState<Section>('records');

  return (
    <div className='space-y-4'>
      <p className='text-xs text-secondary/60'>
        Company-wide: all staff and tablets across every branch. Each time in and out records the tablet used and its
        location.
      </p>
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
      {section === 'records' && <TimeRecordsPanel />}
      {section === 'staff' && <StaffPanel />}
      {section === 'tablets' && <TabletsPanel />}
    </div>
  );
}
