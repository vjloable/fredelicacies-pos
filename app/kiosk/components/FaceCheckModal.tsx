import { useCallback, useEffect, useRef, useState } from 'react';
import FaceCamera from '@/components/face/FaceCamera';
import { captureFace, FACE_MODEL } from '@/lib/face/engine';
import { getDeviceLocation, type LocationResult } from '@/lib/face/location';
import { FACE_HINTS, type FaceIssue } from '@/lib/face/quality';
import { useCamera } from '@/lib/face/useCamera';
import {
  FaceApiError,
  faceAttendanceService,
  faceErrorMessage,
  type KioskAction,
  type KioskWorker,
} from '@/services/faceAttendanceService';
import { formatTime } from '../format';

type Step = 'intro' | 'scanning' | 'sending' | 'success' | 'error';

interface FaceCheckModalProps {
  worker: KioskWorker;
  onClose: () => void;
  /** Called after a recorded punch, or when the roster is out of date. */
  onRosterChanged: (highlightWorkerId?: string) => void;
}

const SUCCESS_MS = 3500;

export default function FaceCheckModal({ worker, onClose, onRosterChanged }: FaceCheckModalProps) {
  const [step, setStep] = useState<Step>('intro');
  const [issue, setIssue] = useState<FaceIssue | null>('no_face');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ action: KioskAction; at: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const locationRef = useRef<Promise<LocationResult> | null>(null);
  const { videoRef, ready, error: cameraError } = useCamera(step === 'scanning' || step === 'sending');

  const isTimeIn = worker.nextAction === 'time_in';
  const actionLabel = isTimeIn ? 'Time In' : 'Time Out';

  const close = useCallback(() => {
    abortRef.current?.abort();
    onClose();
  }, [onClose]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Run one capture + punch once the camera is live. There is deliberately no
  // cleanup abort: the run must survive the scanning → sending step change.
  // Only Cancel/close or unmount abort it.
  useEffect(() => {
    if (step !== 'scanning' || !ready || !videoRef.current) return;
    if (abortRef.current && !abortRef.current.signal.aborted) return; // already running
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    (async () => {
      try {
        // Locate the tablet while the face is being scanned so it adds no wait.
        locationRef.current ??= getDeviceLocation();
        const sample = await captureFace(videoRef.current!, { signal: ctrl.signal, onHint: setIssue });
        setStep('sending');
        const where = await locationRef.current;
        locationRef.current = null; // a retry takes a fresh reading
        const res = await faceAttendanceService.punch({
          workerId: worker.workerId,
          expected: worker.nextAction,
          model: FACE_MODEL,
          ...sample,
          ...where,
        });
        setResult({ action: res.action, at: res.at });
        setStep('success');
        onRosterChanged(worker.workerId);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        if (err instanceof FaceApiError && err.code === 'STATE_CHANGED') onRosterChanged();
        setError(faceErrorMessage(err));
        setStep('error');
      } finally {
        // Mark this run finished so TRY AGAIN can start a new one.
        if (abortRef.current === ctrl) abortRef.current = null;
      }
    })();
  }, [step, ready, videoRef, worker, onRosterChanged]);

  useEffect(() => {
    if (step !== 'success') return;
    const t = setTimeout(onClose, SUCCESS_MS);
    return () => clearTimeout(t);
  }, [step, onClose]);

  return (
    <div className='fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50'>
      <div className='bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full max-h-full overflow-y-auto'>
        <div className='text-center mb-6'>
          <div className={`text-3 font-bold tracking-widest ${isTimeIn ? 'text-success' : 'text-secondary/70'}`}>
            {actionLabel.toUpperCase()}
          </div>
          <h2 className='text-6 font-bold text-secondary'>{worker.name}</h2>
        </div>

        {step === 'intro' && (
          <>
            <ul className='space-y-2 text-3.5 text-secondary mb-5'>
              <li>• Remove your mask, sunglasses or cap</li>
              <li>• Face the camera straight on, about an arm&apos;s length away</li>
              <li>• Stay in good lighting and hold still for a moment</li>
              <li>• Only you should be in front of the camera</li>
            </ul>
            <div className='text-3 text-secondary/70 bg-light-accent/40 rounded-lg p-3 mb-6'>
              <span className='font-semibold'>Privacy:</span> your face is checked on this tablet. Only a numeric face
              template is sent to confirm it&apos;s you — no photo is taken or saved. The tablet&apos;s location is
              recorded with each time in and time out. Both are used only for attendance, as provided under the Data
              Privacy Act of 2012.
            </div>
            <div className='flex gap-3'>
              <button onClick={close} className='flex-1 py-3 rounded-lg border border-secondary/20 text-secondary font-semibold'>
                Cancel
              </button>
              <button
                onClick={() => setStep('scanning')}
                className={`flex-1 py-3 rounded-lg font-black text-primary ${isTimeIn ? 'bg-success' : 'bg-secondary'}`}>
                START
              </button>
            </div>
          </>
        )}

        {(step === 'scanning' || step === 'sending') && (
          <>
            <FaceCamera
              videoRef={videoRef}
              cameraError={cameraError}
              state={step === 'sending' ? 'busy' : issue ? 'guiding' : 'good'}
              hint={step === 'sending' ? 'Checking…' : !ready ? 'Starting camera…' : issue ? FACE_HINTS[issue] : 'Hold still…'}
            />
            <button onClick={close} className='mt-6 w-full py-3 rounded-lg border border-secondary/20 text-secondary font-semibold'>
              Cancel
            </button>
          </>
        )}

        {step === 'success' && result && (
          <div className='text-center py-4'>
            <div className='w-20 h-20 mx-auto rounded-full bg-success/15 flex items-center justify-center mb-4'>
              <svg className='w-10 h-10 text-success' fill='none' stroke='currentColor' strokeWidth={3} viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' d='M5 13l4 4L19 7' />
              </svg>
            </div>
            <div className='text-5 font-bold text-secondary'>
              {result.action === 'time_in' ? 'Timed in' : 'Timed out'} at {formatTime(result.at)}
            </div>
            <p className='text-3.5 text-secondary/60 mt-2'>
              {result.action === 'time_in' ? 'Have a great shift!' : 'Thank you, see you next time!'}
            </p>
          </div>
        )}

        {step === 'error' && (
          <div className='text-center'>
            <div className='text-4 text-error font-semibold mb-6'>{error}</div>
            <div className='flex gap-3'>
              <button onClick={close} className='flex-1 py-3 rounded-lg border border-secondary/20 text-secondary font-semibold'>
                Close
              </button>
              <button
                onClick={() => {
                  setError(null);
                  setIssue('no_face');
                  setStep('scanning');
                }}
                className='flex-1 py-3 rounded-lg bg-accent text-primary font-black'>
                TRY AGAIN
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
