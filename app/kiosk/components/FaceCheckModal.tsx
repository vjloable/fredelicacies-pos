import { useCallback, useEffect, useRef, useState } from 'react';
import FaceCamera from '@/components/face/FaceCamera';
import { captureFace, FACE_MODEL, type FaceSession } from '@/lib/face/engine';
import { getDeviceLocation, type LocationResult } from '@/lib/face/location';
import {
  checkStraight,
  checkTurn,
  cosineSimilarity,
  hintText,
  MAX_YAW,
  type DetectedFace,
  type FaceIssue,
  type PoseHint,
} from '@/lib/face/quality';
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

// Active liveness: a printed photo or a phone screen can't turn its head. The
// person looks straight, turns to the side, then looks back; the face must stay
// in view throughout and the final (matched) face must be the person who
// started. Runs on the tablet, alongside the server's anti-spoof/liveness and
// face match.
type Phase = 'straight' | 'turn' | 'back';
const PHASES: { id: Phase; prompt: string }[] = [
  { id: 'straight', prompt: 'Look straight at the camera' },
  { id: 'turn', prompt: 'Now turn your head slightly to the side' },
  { id: 'back', prompt: 'Look back at the camera' },
];
// Same person at the start and the end of the check. Same-session SFace
// templates of one face score far higher; different people score below ~0.35.
const SAME_PERSON_MIN = 0.5;
const PHASE_TIMEOUT_MS = 10_000;
// Open the kiosk with ?facedebug to show the raw per-frame readings, for
// working out which check a face is failing.
const DEBUG = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('facedebug');
const deg = (rad: number) => `${Math.round((rad * 180) / Math.PI)}°`;

interface FaceCheckModalProps {
  worker: KioskWorker;
  onClose: () => void;
  /** Called after a recorded punch, or when the roster is out of date. */
  onRosterChanged: (highlightWorkerId?: string) => void;
}

const SUCCESS_MS = 3500;

export default function FaceCheckModal({ worker, onClose, onRosterChanged }: FaceCheckModalProps) {
  const [step, setStep] = useState<Step>('intro');
  const [issue, setIssue] = useState<FaceIssue | PoseHint | null>('no_face');
  const [phase, setPhase] = useState<Phase>('straight');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ action: KioskAction; at: string } | null>(null);
  const [reading, setReading] = useState<DetectedFace | null>(null);
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
        const video = videoRef.current!;
        const session: FaceSession = { lastFaceAt: 0 };
        const common = { signal: ctrl.signal, onHint: setIssue, session, onFrame: DEBUG ? setReading : undefined };

        setPhase('straight');
        const first = await captureFace(video, { ...common, pose: (a) => checkStraight(a) });
        const base = first.angle!;

        setPhase('turn');
        await captureFace(video, {
          ...common,
          frames: 2,
          timeoutMs: PHASE_TIMEOUT_MS,
          maxYaw: Math.abs(base.yaw) + MAX_YAW * 2,
          pose: (a) => checkTurn(a, base),
        }).catch((err: Error) => {
          throw new Error(err.message === 'TIMEOUT' ? 'NO_TURN' : err.message);
        });

        setPhase('back');
        const sample = await captureFace(video, { ...common, timeoutMs: PHASE_TIMEOUT_MS, pose: (a) => checkStraight(a, base) });
        if (cosineSimilarity(first.embedding, sample.embedding) < SAME_PERSON_MIN) throw new Error('FACE_CHANGED');
        setStep('sending');
        const where = await locationRef.current;
        locationRef.current = null; // a retry takes a fresh reading
        const res = await faceAttendanceService.punch({
          workerId: worker.workerId,
          expected: worker.nextAction,
          model: FACE_MODEL,
          embedding: sample.embedding,
          antispoof: sample.antispoof,
          liveness: sample.liveness,
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
              <li>• You&apos;ll be asked to turn your head slightly to the side, then look back</li>
              <li>• Stay in good lighting</li>
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
            <div className='text-center mb-4'>
              <div className='flex justify-center gap-2 mb-2'>
                {PHASES.map((p, i) => {
                  const current = PHASES.findIndex((x) => x.id === phase);
                  const done = step === 'sending' || i < current;
                  return (
                    <span key={p.id} className={`w-2.5 h-2.5 rounded-full ${done ? 'bg-success' : i === current ? 'bg-accent' : 'bg-secondary/15'}`} />
                  );
                })}
              </div>
              <div className='text-4.5 font-bold text-secondary'>
                {step === 'sending' ? 'Checking…' : PHASES.find((p) => p.id === phase)!.prompt}
              </div>
            </div>
            <FaceCamera
              videoRef={videoRef}
              cameraError={cameraError}
              state={step === 'sending' ? 'busy' : issue ? 'guiding' : 'good'}
              hint={step === 'sending' ? null : !ready ? 'Starting camera…' : issue ? hintText(issue) : 'Hold still…'}
            />
            {DEBUG && (
              <div className='mt-3 font-mono text-3 text-secondary/70 bg-light-accent/40 rounded-lg p-2'>
                {reading ? (
                  <>
                    score {reading.score.toFixed(2)} (min 0.60) · width {reading.boxRaw[2].toFixed(2)} (min 0.20)
                    <br />
                    yaw {reading.angle ? deg(reading.angle.yaw) : '–'} · pitch {reading.angle ? deg(reading.angle.pitch) : '–'}
                    <br />
                    real {reading.real?.toFixed(2) ?? '–'} · live {reading.live?.toFixed(2) ?? '–'} · issue {issue ?? 'none'}
                  </>
                ) : (
                  'no single face in frame'
                )}
              </div>
            )}
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
                  setPhase('straight');
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
