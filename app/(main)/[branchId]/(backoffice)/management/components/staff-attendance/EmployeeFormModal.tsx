import { useState } from 'react';
import { faceAttendanceService, faceErrorMessage, type Employee } from '@/services/faceAttendanceService';
import { input, Modal, primaryButton, secondaryButton } from './ui';

// Add or rename a person on the kiosk staff list (admins and owners only).
export default function EmployeeFormModal({
  employee,
  onClose,
  onSaved,
}: {
  employee?: Employee;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(employee?.name ?? '');
  const [position, setPosition] = useState(employee?.position ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const pos = position.trim() || null;
      if (employee) await faceAttendanceService.updateEmployee(employee.id, { name: name.trim(), position: pos });
      else await faceAttendanceService.addEmployee(name.trim(), pos);
      onSaved();
      onClose();
    } catch (err) {
      setError(faceErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={employee ? 'Edit staff' : 'Add staff'} subtitle='Shown on the attendance kiosk' onClose={onClose}>
      <form onSubmit={save} className='space-y-4'>
        <label className='block text-3 font-semibold text-secondary'>
          Name
          <input className={`${input} mt-1`} value={name} maxLength={80} required autoFocus onChange={(e) => setName(e.target.value)} />
        </label>
        <label className='block text-3 font-semibold text-secondary'>
          Position <span className='font-normal text-secondary/50'>(optional)</span>
          <input
            className={`${input} mt-1`}
            value={position}
            maxLength={60}
            placeholder='e.g. Kitchen, Cashier, Driver'
            onChange={(e) => setPosition(e.target.value)}
          />
        </label>
        {error && <p className='text-3.5 text-error'>{error}</p>}
        <div className='flex gap-3'>
          <button type='button' onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button disabled={busy || !name.trim()} className={primaryButton}>
            {busy ? 'Saving…' : employee ? 'SAVE' : 'ADD'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
