import { useEffect, useRef, useState } from 'react';
import FaceCamera from '@/components/face/FaceCamera';
import { captureFace, FACE_MODEL } from '@/lib/face/engine';
import {
  checkChin,
  checkStraight,
  checkTurn,
  hintText,
  MAX_YAW,
  yawSide,
  type FaceIssue,
  type HeadAngle,
  type PoseHint,
} from '@/lib/face/quality';
import { useCamera } from '@/lib/face/useCamera';
import { faceAttendanceService, faceErrorMessage } from '@/services/faceAttendanceService';
import { Icon, primaryButton, secondaryButton } from './ui';

// Small natural variations make the enrollment robust to how people actually
// stand at the kiosk. Each shot waits until the pose is really taken and held
// (measured against the person's own first, straight-on shot), so a shot can't
// pass without the person moving. Left and right must be opposite sides; turns
// stay small enough (≤ ~20°) that the template still matches frontal faces.
interface PoseContext {
  base: HeadAngle | null;
  side: 1 | -1 | null;
}
const MAX_ENROLL_TURN = 0.35;
const SHOTS: { prompt: string; check: (a: HeadAngle | null, ctx: PoseContext) => PoseHint | null }[] = [
  { prompt: 'Look straight at the camera', check: (a) => checkStraight(a) },
  { prompt: 'Turn your head slightly to the left', check: (a, c) => checkTurn(a, c.base!, { max: MAX_ENROLL_TURN }) },
  {
    prompt: 'Now turn slightly to the right',
    check: (a, c) => checkTurn(a, c.base!, { side: c.side === 1 ? -1 : 1, max: MAX_ENROLL_TURN }),
  },
  { prompt: 'Look forward and lower your chin a little', check: (a, c) => checkChin(a, c.base!) },
  { prompt: 'Look straight again and relax', check: (a, c) => checkStraight(a, c.base!) },
];

type Step = 'consent' | 'capture' | 'saving' | 'done' | 'error';

interface EnrollFaceModalProps {
  /** Person on the kiosk staff list. */
  person: { id: string; name: string; enrolled: boolean };
  onClose: () => void;
  onEnrolled: () => void;
}

export default function EnrollFaceModal({ person, onClose, onEnrolled }: EnrollFaceModalProps) {
  const [step, setStep] = useState<Step>('consent');
  const [agreed, setAgreed] = useState(false);
  const [shot, setShot] = useState(0);
  const [issue, setIssue] = useState<FaceIssue | PoseHint | null>('no_face');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { videoRef, ready, error: cameraError } = useCamera(step === 'capture');

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (step !== 'capture' || !ready || !videoRef.current) return;
    if (abortRef.current && !abortRef.current.signal.aborted) return; // already running
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    (async () => {
      try {
        const embeddings: number[][] = [];
        const ctx: PoseContext = { base: null, side: null };
        for (let i = 0; i < SHOTS.length; i++) {
          setShot(i);
          setIssue(null);
          await new Promise((r) => setTimeout(r, 900)); // time to read the prompt
          const sample = await captureFace(videoRef.current!, {
            frames: 3, // hold the pose for a moment
            timeoutMs: 30_000,
            signal: ctrl.signal,
            onHint: setIssue,
            maxYaw: ctx.base ? Math.abs(ctx.base.yaw) + MAX_YAW : MAX_YAW,
            pose: (a) => SHOTS[i]!.check(a, ctx),
          });
          if (i === 0) ctx.base = sample.angle;
          if (i === 1 && ctx.base && sample.angle) ctx.side = yawSide(sample.angle, ctx.base);
          embeddings.push(sample.embedding);
        }
        setStep('saving');
        await faceAttendanceService.enroll(person.id, embeddings, FACE_MODEL);
        setStep('done');
        onEnrolled();
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setError(faceErrorMessage(err));
        setStep('error');
      } finally {
        if (abortRef.current === ctrl) abortRef.current = null;
      }
    })();
  }, [step, ready, videoRef, person.id, onEnrolled]);

  const close = () => {
    abortRef.current?.abort();
    onClose();
  };

  return (
    <div className='fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50'>
      <div role='dialog' aria-modal='true' aria-label='Enroll face' className='bg-white rounded-2xl p-6 sm:p-8 max-w-lg w-full max-h-full overflow-y-auto shadow-xl'>
        <div className='flex items-start gap-3 mb-5'>
          <span className='w-10 h-10 rounded-full bg-light-accent/60 text-accent flex items-center justify-center shrink-0'>
            <Icon.Face className='w-5 h-5' />
          </span>
          <div className='flex-1 min-w-0'>
            <h3 className='text-4.5 font-bold text-secondary leading-tight'>{person.enrolled ? 'Re-enroll face' : 'Enroll face'}</h3>
            <p className='text-3 text-secondary/60 mt-0.5'>{person.name}</p>
          </div>
          <button aria-label='Close' onClick={close} className='-mr-2 -mt-1 p-2 rounded-lg text-secondary/40 hover:text-secondary hover:bg-secondary/5'>
            <Icon.Close className='w-5 h-5' />
          </button>
        </div>

        {step === 'consent' && (
          <>
            <div className='text-3.5 text-secondary space-y-3 bg-background border border-secondary/10 rounded-lg p-4 mb-4'>
              <p className='flex items-center gap-2 font-semibold'>
                <Icon.Shield className='w-4 h-4 text-accent' />
                Privacy notice: please read this to them
              </p>
              <p>
                Fredelicacies uses face verification to record your time in and time out at the branch kiosk. We will
                take a few face scans now to create a <span className='font-semibold'>numeric face template</span>. No
                photo of you is stored.
              </p>
              <p>
                Each time you time in or out at the kiosk, the tablet&apos;s location is recorded with the time.
                The template and these records are used only for attendance. The template is kept until you ask us to
                remove it or you leave the company. You can ask a manager at any time to delete it, and a manager can always time you in manually
                instead.
              </p>
              <p className='text-3 text-secondary/60'>Data Privacy Act of 2012 (RA 10173).</p>
            </div>
            <label className='flex items-start gap-3 text-3.5 text-secondary mb-6 cursor-pointer'>
              <input type='checkbox' className='mt-1 accent-accent w-4 h-4' checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>{person.name} has read or heard this notice and agrees to face enrollment.</span>
            </label>
            {person.enrolled && (
              <p className='flex items-start gap-2 text-3 text-secondary/70 mb-4'>
                <Icon.Info className='w-3.5 h-3.5 mt-0.5' />
                This replaces the face currently enrolled for {person.name}.
              </p>
            )}
            <button disabled={!agreed} onClick={() => setStep('capture')} className={`${primaryButton} w-full py-3`}>
              <Icon.Face />
              Start scan
            </button>
          </>
        )}

        {step === 'capture' && (
          <>
            <div className='text-center mb-4'>
              <div className='text-3 font-semibold text-accent tracking-widest'>
                SCAN {shot + 1} OF {SHOTS.length}
              </div>
              <div className='text-4 font-bold text-secondary'>{SHOTS[shot]!.prompt}</div>
            </div>
            <FaceCamera
              videoRef={videoRef}
              cameraError={cameraError}
              state={issue ? 'guiding' : 'good'}
              hint={!ready ? 'Starting camera…' : issue ? hintText(issue) : 'Hold still…'}
            />
            <div className='flex justify-center gap-2 mt-4'>
              {SHOTS.map((_, i) => (
                <span key={i} className={`w-2.5 h-2.5 rounded-full ${i < shot ? 'bg-success' : i === shot ? 'bg-accent' : 'bg-secondary/15'}`} />
              ))}
            </div>
          </>
        )}

        {step === 'saving' && (
          <div className='flex flex-col items-center gap-3 py-10 text-secondary'>
            <span className='w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin' />
            Saving face template…
          </div>
        )}

        {step === 'done' && (
          <div className='text-center py-6'>
            <span className='w-14 h-14 mx-auto mb-3 rounded-full bg-success/10 text-success flex items-center justify-center'>
              <Icon.Check className='w-7 h-7' />
            </span>
            <div className='text-5 font-bold text-secondary mb-1'>Face enrolled</div>
            <p className='text-3.5 text-secondary/70 mb-6'>{person.name} can now time in and out at the kiosk.</p>
            <button onClick={onClose} className={`${primaryButton} w-full py-3`}>
              Done
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className='text-center py-4'>
            <span className='w-14 h-14 mx-auto mb-3 rounded-full bg-error/10 text-error flex items-center justify-center'>
              <Icon.Alert className='w-7 h-7' />
            </span>
            <p className='text-4 text-secondary font-semibold mb-6'>{error}</p>
            <div className='flex gap-3'>
              <button onClick={close} className={secondaryButton}>
                Close
              </button>
              <button
                onClick={() => {
                  setError(null);
                  setIssue('no_face');
                  setShot(0);
                  setStep('capture');
                }}
                className={primaryButton}>
                <Icon.Restore />
                Retake
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
