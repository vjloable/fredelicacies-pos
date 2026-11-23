import { useState } from 'react';
import { fromManilaInput, toManilaInput } from '@/lib/manilaTime';
import { faceAttendanceService, faceErrorMessage, type Employee, type KioskAction } from '@/services/faceAttendanceService';
import { input, Modal, primaryButton, secondaryButton } from './ui';

interface ManualPunchModalProps {
  action: KioskAction;
  /** Fixed person (e.g. closing their open shift), or a list to choose from. */
  employee?: Employee;
  choices?: Employee[];
  onClose: () => void;
  onDone: () => void;
}

// Manager correction: time someone in or out by hand, optionally at an earlier
// time (e.g. closing a shift they forgot to time out of). Recorded as MANUAL.
export default function ManualPunchModal({ action, employee, choices = [], onClose, onDone }: ManualPunchModalProps) {
  const [employeeId, setEmployeeId] = useState(employee?.id ?? choices[0]?.id ?? '');
  const [when, setWhen] = useState(() => toManilaInput(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isIn = action === 'time_in';

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await faceAttendanceService.manualPunch(employeeId, action, fromManilaInput(when));
      onDone();
      onClose();
    } catch (err) {
      setError(faceErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={isIn ? 'Time in manually' : 'Time out manually'} subtitle={employee?.name} onClose={onClose}>
      <div className='space-y-4'>
        {!employee && (
          <label className='block text-3 font-semibold text-secondary'>
            Person
            <select className={`${input} mt-1`} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              {choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className='block text-3 font-semibold text-secondary'>
          {isIn ? 'Time in' : 'Time out'} (Philippine time)
          <input type='datetime-local' className={`${input} mt-1`} value={when} max={toManilaInput(new Date())} onChange={(e) => setWhen(e.target.value)} />
        </label>
        <p className='text-3 text-secondary/60'>This is recorded as a manual entry under your name.</p>
        {error && <p className='text-3.5 text-error'>{error}</p>}
        <div className='flex gap-3'>
          <button onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button disabled={busy || !employeeId || !when} onClick={save} className={primaryButton}>
            {busy ? 'Saving…' : isIn ? 'TIME IN' : 'TIME OUT'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
