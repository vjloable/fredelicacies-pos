import { useCallback, useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { formatManilaDay, formatManilaTime } from '@/lib/manilaTime';
import { faceAttendanceService, faceErrorMessage, type KioskDevice } from '@/services/faceAttendanceService';
import { ConfirmModal, panel } from './ui';

const when = (iso: string | null) => (iso ? `${formatManilaDay(iso)}, ${formatManilaTime(iso)}` : 'never');

// Kiosk tablets paired to this branch.
export default function TabletsPanel({ branchId }: { branchId: string }) {
  const [devices, setDevices] = useState<KioskDevice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<KioskDevice | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setDevices((await faceAttendanceService.listDevices(branchId)).devices);
      setError(null);
    } catch (err) {
      setError(faceErrorMessage(err));
    }
  }, [branchId]);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async () => {
    if (!revoking) return;
    setBusy(true);
    try {
      await faceAttendanceService.revokeDevice(branchId, revoking.id);
      setRevoking(null);
      await load();
    } catch (err) {
      setError(faceErrorMessage(err));
      setRevoking(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={panel}>
      <h3 className='font-bold text-secondary mb-1'>Kiosk tablets</h3>
      <p className='text-xs text-secondary/60 mb-4'>
        To pair a tablet, open <span className='font-semibold'>pos.fredelicacies.com/kiosk</span> on it and sign in as a manager or owner.
      </p>
      {error && <p className='text-3.5 text-error mb-3'>{error}</p>}
      {!devices ? (
        !error && (
          <div className='flex items-center justify-center py-8'>
            <LoadingSpinner size='md' />
          </div>
        )
      ) : devices.length === 0 ? (
        <p className='text-3.5 text-secondary/50'>No tablets paired yet.</p>
      ) : (
        <ul className='divide-y divide-secondary/10'>
          {devices.map((d) => (
            <li key={d.id} className='flex items-center justify-between py-3 gap-4'>
              <div className='min-w-0'>
                <div className={`font-medium truncate ${d.revokedAt ? 'text-secondary/40 line-through' : 'text-secondary'}`}>{d.label}</div>
                <div className='text-xs text-secondary/60'>
                  Paired {when(d.createdAt)} · last used {when(d.lastSeenAt)}
                </div>
              </div>
              {d.revokedAt ? (
                <span className='text-xs text-secondary/50'>Revoked</span>
              ) : (
                <button onClick={() => setRevoking(d)} className='text-xs font-semibold text-error hover:underline'>
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {revoking && (
        <ConfirmModal
          busy={busy}
          title={`Revoke “${revoking.label}”?`}
          message='The tablet stops working as a kiosk immediately. Pair it again to reuse it.'
          confirmLabel='REVOKE'
          onCancel={() => setRevoking(null)}
          onConfirm={revoke}
        />
      )}
    </section>
  );
}
