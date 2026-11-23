import { useCallback, useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { formatManilaDay } from '@/lib/manilaTime';
import { faceAttendanceService, faceErrorMessage, type Employee } from '@/services/faceAttendanceService';
import EnrollFaceModal from '../EnrollFaceModal';
import EmployeeFormModal from './EmployeeFormModal';
import { ConfirmModal, panel } from './ui';

type Confirm = { kind: 'removeFace' | 'deactivate'; employee: Employee } | null;

// Kiosk staff list. Admins/owners maintain it; managers enroll faces.
export default function StaffPanel({ branchId }: { branchId: string }) {
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [canAdmin, setCanAdmin] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Employee | 'new' | null>(null);
  const [enrolling, setEnrolling] = useState<Employee | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await faceAttendanceService.listEmployees(branchId);
      setEmployees(res.employees);
      setCanAdmin(res.canAdmin);
      setError(null);
    } catch (err) {
      setError(faceErrorMessage(err));
    }
  }, [branchId]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      setConfirm(null);
      await load();
    } catch (err) {
      setError(faceErrorMessage(err));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  if (!employees) {
    return error ? (
      <p className='text-3.5 text-error py-8 text-center'>{error}</p>
    ) : (
      <div className='flex items-center justify-center py-8'>
        <LoadingSpinner size='md' />
      </div>
    );
  }

  const active = employees.filter((e) => e.active);
  const inactive = employees.filter((e) => !e.active);
  const shown = showInactive ? employees : active;

  return (
    <section className={panel}>
      <div className='flex items-center justify-between gap-4 mb-1'>
        <h3 className='font-bold text-secondary'>
          Staff <span className='text-secondary/50 font-normal'>({active.length})</span>
        </h3>
        {canAdmin && (
          <button onClick={() => setEditing('new')} className='text-xs font-black text-primary bg-accent px-3 py-1.5 rounded-lg'>
            + ADD STAFF
          </button>
        )}
      </div>
      <p className='text-xs text-secondary/60 mb-4'>
        Everyone who times in at this branch, with or without a POS login. This is separate from the POS cashier clock-in.
        {!canAdmin && ' Only admins and owners can add or edit staff.'}
      </p>
      {error && <p className='text-3.5 text-error mb-3'>{error}</p>}

      {shown.length === 0 ? (
        <p className='text-3.5 text-secondary/50'>No staff yet.{canAdmin && ' Add the people who work at this branch.'}</p>
      ) : (
        <ul className='divide-y divide-secondary/10'>
          {shown.map((e) => (
            <li key={e.id} className='flex flex-wrap items-center justify-between py-3 gap-x-4 gap-y-2'>
              <div className='min-w-0'>
                <div className={`font-medium truncate ${e.active ? 'text-secondary' : 'text-secondary/40'}`}>
                  {e.name}
                  {e.position && <span className='text-xs text-secondary/50 font-normal ml-2'>{e.position}</span>}
                </div>
                <div className='text-xs'>
                  {!e.active ? (
                    <span className='text-secondary/40'>Inactive</span>
                  ) : e.enrolled ? (
                    <span className='text-success'>Face enrolled {e.enrolledAt && formatManilaDay(e.enrolledAt)}</span>
                  ) : (
                    <span className='text-error'>Face not enrolled — can&apos;t use the kiosk yet</span>
                  )}
                  {e.openSince && <span className='text-success font-semibold ml-2'>● In now</span>}
                </div>
              </div>
              <div className='flex items-center gap-4 shrink-0'>
                {e.active ? (
                  <>
                    {canAdmin && (
                      <>
                        <button onClick={() => setEditing(e)} className='text-xs font-semibold text-secondary hover:underline'>
                          Edit
                        </button>
                        <button onClick={() => setConfirm({ kind: 'deactivate', employee: e })} className='text-xs font-semibold text-error hover:underline'>
                          Deactivate
                        </button>
                      </>
                    )}
                    {e.enrolled && (
                      <button onClick={() => setConfirm({ kind: 'removeFace', employee: e })} className='text-xs font-semibold text-error hover:underline'>
                        Remove face
                      </button>
                    )}
                    <button onClick={() => setEnrolling(e)} className='text-xs font-black text-primary bg-accent px-3 py-1.5 rounded-lg'>
                      {e.enrolled ? 'RE-ENROLL' : 'ENROLL FACE'}
                    </button>
                  </>
                ) : (
                  canAdmin && (
                    <button
                      disabled={busy}
                      onClick={() => run(() => faceAttendanceService.updateEmployee(branchId, e.id, { active: true }))}
                      className='text-xs font-semibold text-accent hover:underline'>
                      Reactivate
                    </button>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {inactive.length > 0 && (
        <button onClick={() => setShowInactive((v) => !v)} className='mt-4 text-xs text-secondary/60 underline'>
          {showInactive ? 'Hide' : 'Show'} {inactive.length} inactive
        </button>
      )}

      {editing && (
        <EmployeeFormModal branchId={branchId} employee={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={load} />
      )}
      {enrolling && (
        <EnrollFaceModal
          branchId={branchId}
          person={{ id: enrolling.id, name: enrolling.name, enrolled: enrolling.enrolled }}
          onClose={() => setEnrolling(null)}
          onEnrolled={load}
        />
      )}
      {confirm && (
        <ConfirmModal
          busy={busy}
          title={confirm.kind === 'deactivate' ? `Deactivate ${confirm.employee.name}?` : `Remove ${confirm.employee.name}'s face?`}
          message={
            confirm.kind === 'deactivate'
              ? 'They disappear from the kiosk and their face data is erased. Their past time records are kept. Use this when someone leaves.'
              : "Their face template is deleted. They can't use the kiosk until they are enrolled again."
          }
          confirmLabel={confirm.kind === 'deactivate' ? 'DEACTIVATE' : 'REMOVE'}
          onCancel={() => setConfirm(null)}
          onConfirm={() =>
            run(() =>
              confirm.kind === 'deactivate'
                ? faceAttendanceService.updateEmployee(branchId, confirm.employee.id, { active: false })
                : faceAttendanceService.deleteEnrollment(branchId, confirm.employee.id),
            )
          }
        />
      )}
    </section>
  );
}
