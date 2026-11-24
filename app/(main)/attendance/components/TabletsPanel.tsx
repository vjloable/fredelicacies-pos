import { useCallback, useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { formatManilaDay, formatManilaTime } from '@/lib/manilaTime';
import { faceAttendanceService, faceErrorMessage, type KioskDevice } from '@/services/faceAttendanceService';
import { Badge, ConfirmModal, EmptyState, ErrorBanner, Icon, panel, rowDanger, SectionHeader } from './ui';

const when = (iso: string | null) => (iso ? `${formatManilaDay(iso)}, ${formatManilaTime(iso)}` : 'Never');

const PAIR_STEPS = [
  <>
    On the tablet, open <span className='font-semibold text-secondary'>pos.fredelicacies.com/kiosk</span> (or tap Staff Attendance on the
    login page).
  </>,
  <>Sign in as a manager, owner or admin.</>,
  <>Name it after where it sits, e.g. “Talisay front counter”, and allow location access.</>,
];

// Kiosk tablets (company-wide; any tablet can be used by any staff member).
export default function TabletsPanel() {
  const [devices, setDevices] = useState<KioskDevice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<KioskDevice | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setDevices((await faceAttendanceService.listDevices()).devices);
      setError(null);
    } catch (err) {
      setError(faceErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async () => {
    if (!revoking) return;
    setBusy(true);
    try {
      await faceAttendanceService.revokeDevice(revoking.id);
      setRevoking(null);
      await load();
    } catch (err) {
      setError(faceErrorMessage(err));
      setRevoking(null);
    } finally {
      setBusy(false);
    }
  };

  const activeCount = devices?.filter((d) => !d.revokedAt).length ?? 0;

  return (
    <div className='grid gap-5 lg:grid-cols-[1fr_18rem] items-start'>
      <section className={panel}>
        <SectionHeader
          title='Kiosk tablets'
          description={devices ? `${activeCount} active tablet${activeCount === 1 ? '' : 's'}` : undefined}
        />
        {error && (
          <div className='px-5 pb-4'>
            <ErrorBanner message={error} onRetry={load} />
          </div>
        )}
        {!devices ? (
          !error && (
            <div className='flex items-center justify-center py-16'>
              <LoadingSpinner size='md' />
            </div>
          )
        ) : devices.length === 0 ? (
          <EmptyState icon={<Icon.Tablet className='w-5 h-5' />} title='No tablets paired yet'>
            Follow the steps beside this list to set up the first kiosk.
          </EmptyState>
        ) : (
          <ul className='divide-y divide-secondary/10 border-t border-secondary/10'>
            {devices.map((d) => (
              <li key={d.id} className='flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3.5'>
                <div className='flex items-center gap-3 min-w-0 flex-1'>
                  <span
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      d.revokedAt ? 'bg-secondary/5 text-secondary/30' : 'bg-light-accent/60 text-accent'
                    }`}>
                    <Icon.Tablet className='w-4.5 h-4.5' />
                  </span>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-2'>
                      <span className={`font-semibold truncate ${d.revokedAt ? 'text-secondary/40' : 'text-secondary'}`}>{d.label}</span>
                      {d.revokedAt ? <Badge tone='muted'>Revoked</Badge> : <Badge tone='success'>Active</Badge>}
                    </div>
                    <div className='text-3 text-secondary/50 mt-0.5'>
                      Paired {when(d.createdAt)} · Last used {when(d.lastSeenAt)}
                    </div>
                  </div>
                </div>
                {!d.revokedAt && (
                  <button onClick={() => setRevoking(d)} className={`${rowDanger} self-start sm:self-auto ml-12 sm:ml-0`}>
                    <Icon.Close className='w-3.5 h-3.5' />
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className={`${panel} p-5`}>
        <div className='flex items-center gap-2 mb-3'>
          <Icon.Info className='w-4 h-4 text-accent' />
          <h4 className='font-bold text-secondary text-3.5'>Pair a new tablet</h4>
        </div>
        <ol className='space-y-3'>
          {PAIR_STEPS.map((step, i) => (
            <li key={i} className='flex gap-3 text-3 text-secondary/70'>
              <span className='w-5 h-5 rounded-full bg-secondary/5 text-secondary text-2.5 font-bold flex items-center justify-center shrink-0'>{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </aside>

      {revoking && (
        <ConfirmModal
          busy={busy}
          title={`Revoke “${revoking.label}”?`}
          message='The tablet stops working as a kiosk immediately. Pair it again to reuse it.'
          confirmLabel='Revoke'
          onCancel={() => setRevoking(null)}
          onConfirm={revoke}
        />
      )}
    </div>
  );
}
