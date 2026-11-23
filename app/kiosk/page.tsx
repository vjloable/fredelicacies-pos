'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageLoader from '@/components/PageLoader';
import { loadFaceEngine } from '@/lib/face/engine';
import { isLocationBlocked } from '@/lib/face/location';
import {
  FaceApiError,
  faceAttendanceService,
  faceErrorMessage,
  kioskToken,
  type KioskRoster,
  type KioskWorker,
} from '@/services/faceAttendanceService';
import FaceCheckModal from './components/FaceCheckModal';
import KioskPairing from './components/KioskPairing';
import WorkerCard from './components/WorkerCard';
import { formatHeaderDate, formatTime } from './format';

// Picks up time-ins/outs made by managers in the POS while the kiosk sits idle.
const POLL_MS = 15_000;

export default function KioskPage() {
  const [paired, setPaired] = useState<boolean | null>(null);
  const [roster, setRoster] = useState<KioskRoster | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<KioskWorker | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [confirmUnpair, setConfirmUnpair] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [locationBlocked, setLocationBlocked] = useState(false);

  useEffect(() => setPaired(Boolean(kioskToken.get())), []);

  const refresh = useCallback(async () => {
    try {
      setRoster(await faceAttendanceService.roster());
      setError(null);
    } catch (err) {
      if (err instanceof FaceApiError && err.code === 'KIOSK_NOT_PAIRED') {
        // Revoked by a manager, or the token was cleared.
        kioskToken.clear();
        setPaired(false);
        setRoster(null);
        return;
      }
      setError(faceErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    if (!paired) return;
    refresh();
    // Warm the face models in the background so the first scan starts quickly.
    loadFaceEngine().catch(() => {});
    isLocationBlocked().then((blocked) => setLocationBlocked(blocked === true));
    const poll = setInterval(refresh, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [paired, refresh]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const onRosterChanged = useCallback(
    (workerId?: string) => {
      refresh();
      if (workerId) {
        setHighlight(workerId);
        setTimeout(() => setHighlight((h) => (h === workerId ? null : h)), 8000);
      }
    },
    [refresh],
  );

  const closeModal = useCallback(() => setSelected(null), []);

  const selectWorker = (w: KioskWorker) => {
    if (!w.enrolled) return setNotice(`${w.name}: face not set up yet. Ask a manager to enroll you.`);
    if (w.blockedReason) return setNotice(`${w.name}: your last shift was never timed out. Ask a manager to fix it.`);
    setSelected(w);
  };

  const workers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = roster?.workers ?? [];
    return term ? list.filter((w) => w.name.toLowerCase().includes(term)) : list;
  }, [roster, search]);

  const inCount = roster?.workers.filter((w) => w.status === 'in').length ?? 0;

  if (paired === null) return <PageLoader text='Loading…' className='min-h-screen' />;
  if (!paired) return <KioskPairing onPaired={() => setPaired(true)} />;
  if (!roster && !error) return <PageLoader text='Loading staff…' className='min-h-screen' />;

  return (
    <div className='h-screen flex flex-col bg-background'>
      <header className='shrink-0 px-6 pt-6 pb-4 bg-background'>
        <div className='flex items-end justify-between gap-4 mb-4'>
          <div>
            <div className='text-3 font-semibold tracking-widest text-accent'>FREDELICACIES</div>
            <h1 className='text-7 font-bold text-secondary'>Staff Attendance</h1>
          </div>
          <div className='text-right'>
            <div className='text-7 font-bold text-secondary tabular-nums'>{formatTime(now.toISOString())}</div>
            <div className='text-3.5 text-secondary/60'>
              {formatHeaderDate(now)} · {inCount} in now
            </div>
          </div>
        </div>
        <input
          type='search'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder='Search your name…'
          className='w-full border border-secondary/20 rounded-xl px-4 py-3 text-4 text-secondary bg-white'
        />
        {error && <p className='mt-3 text-3.5 text-error'>{error}</p>}
        {locationBlocked && (
          <p className='mt-3 text-3.5 text-error'>
            Location is blocked for this site, so time records here won&apos;t include the tablet&apos;s location. A manager
            can allow it in the browser&apos;s site settings.
          </p>
        )}
        {notice && <p className='mt-3 text-3.5 font-semibold text-secondary bg-light-accent rounded-lg px-4 py-3'>{notice}</p>}
      </header>

      <main className='flex-1 overflow-y-auto px-6 pb-6'>
        {workers.length === 0 ? (
          <p className='text-center text-secondary/60 py-16'>{search ? 'No name matches your search.' : 'No staff added yet. An admin adds them in Management → Staff Attendance → Staff.'}</p>
        ) : (
          <div className='grid grid-cols-3 gap-3'>
            {workers.map((w) => (
              <WorkerCard key={w.workerId} worker={w} now={now} highlighted={highlight === w.workerId} onSelect={selectWorker} />
            ))}
          </div>
        )}
      </main>

      <footer className='shrink-0 px-6 py-3 flex items-center justify-between text-3 text-secondary/50'>
        <span>Tablet: {roster?.device.label}</span>
        <button onClick={() => setConfirmUnpair(true)} className='underline'>
          Unpair tablet
        </button>
      </footer>

      {selected && <FaceCheckModal worker={selected} onClose={closeModal} onRosterChanged={onRosterChanged} />}

      {confirmUnpair && (
        <div className='fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50'>
          <div className='bg-white rounded-2xl p-6 max-w-sm w-full'>
            <h2 className='text-5 font-bold text-secondary'>Unpair this tablet?</h2>
            <p className='text-3.5 text-secondary/70 mt-2 mb-6'>
              Staff won&apos;t be able to time in here until a manager pairs it again. To block it completely, also revoke it in
              Management → Staff Attendance → Tablets.
            </p>
            <div className='flex gap-3'>
              <button onClick={() => setConfirmUnpair(false)} className='flex-1 py-3 rounded-lg border border-secondary/20 text-secondary font-semibold'>
                Cancel
              </button>
              <button
                onClick={() => {
                  kioskToken.clear();
                  setConfirmUnpair(false);
                  setRoster(null);
                  setPaired(false);
                }}
                className='flex-1 py-3 rounded-lg bg-error text-primary font-black'>
                UNPAIR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
