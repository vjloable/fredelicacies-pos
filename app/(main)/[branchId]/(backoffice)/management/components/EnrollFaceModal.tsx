import { useEffect, useRef, useState } from 'react';
import FaceCamera from '@/components/face/FaceCamera';
import { captureFace, FACE_MODEL } from '@/lib/face/engine';
import { FACE_HINTS, type FaceIssue } from '@/lib/face/quality';
import { useCamera } from '@/lib/face/useCamera';
import { faceAttendanceService, faceErrorMessage } from '@/services/faceAttendanceService';

// Small natural variations make the enrollment robust to how people actually
// stand at the kiosk, while staying inside the frontal-face quality limits.
const SHOTS = [
  'Look straight at the camera',
  'Turn your head slightly to the left',
  'Turn your head slightly to the right',
  'Lower your chin a little',
  'Look straight again and relax',
];

type Step = 'consent' | 'capture' | 'saving' | 'done' | 'error';

interface EnrollFaceModalProps {
  branchId: string;
  /** Person on the kiosk staff list. */
  person: { id: string; name: string; enrolled: boolean };
  onClose: () => void;
  onEnrolled: () => void;
}

export default function EnrollFaceModal({ branchId, person, onClose, onEnrolled }: EnrollFaceModalProps) {
  const [step, setStep] = useState<Step>('consent');
  const [agreed, setAgreed] = useState(false);
  const [shot, setShot] = useState(0);
  const [issue, setIssue] = useState<FaceIssue | null>('no_face');
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
        for (let i = 0; i < SHOTS.length; i++) {
          setShot(i);
          await new Promise((r) => setTimeout(r, 900)); // time to follow the prompt
          const sample = await captureFace(videoRef.current!, { frames: 2, timeoutMs: 30_000, signal: ctrl.signal, onHint: setIssue });
          embeddings.push(sample.embedding);
        }
        setStep('saving');
        await faceAttendanceService.enroll(branchId, person.id, embeddings, FACE_MODEL);
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
  }, [step, ready, videoRef, branchId, person.id, onEnrolled]);

  const close = () => {
    abortRef.current?.abort();
    onClose();
  };

  return (
    <div className='fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50'>
      <div className='bg-white rounded-2xl p-6 sm:p-8 max-w-lg w-full max-h-full overflow-y-auto'>
        <div className='flex items-start justify-between mb-5'>
          <div>
            <h3 className='text-lg font-bold text-secondary'>{person.enrolled ? 'Re-enroll face' : 'Enroll face'}</h3>
            <p className='text-xs text-secondary/70'>{person.name}</p>
          </div>
          <button aria-label='Close' onClick={close} className='text-gray-400 hover:text-gray-600 p-2'>
            ✕
          </button>
        </div>

        {step === 'consent' && (
          <>
            <div className='text-3.5 text-secondary space-y-3 bg-gray-50 rounded-lg p-4 mb-4'>
              <p className='font-semibold'>Privacy notice — please read this to them</p>
              <p>
                Fredelicacies uses face verification to record your time in and time out at the branch kiosk. We will
                take a few face scans now to create a <span className='font-semibold'>numeric face template</span>. No
                photo of you is stored.
              </p>
              <p>
                The template is used only for attendance. It is kept until you ask us to remove it or you leave the
                company. You can ask a manager at any time to delete it, and a manager can always time you in manually
                instead.
              </p>
              <p className='text-3 text-secondary/60'>Data Privacy Act of 2012 (RA 10173).</p>
            </div>
            <label className='flex items-start gap-3 text-3.5 text-secondary mb-6'>
              <input type='checkbox' className='mt-1' checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>{person.name} has read or heard this notice and agrees to face enrollment.</span>
            </label>
            {person.enrolled && (
              <p className='text-3 text-secondary/70 mb-4'>This replaces the face currently enrolled for {person.name}.</p>
            )}
            <button
              disabled={!agreed}
              onClick={() => setStep('capture')}
              className='w-full py-3 rounded-lg bg-accent text-primary font-black disabled:opacity-40'>
              START SCAN
            </button>
          </>
        )}

        {step === 'capture' && (
          <>
            <div className='text-center mb-4'>
              <div className='text-3 font-semibold text-accent tracking-widest'>
                SCAN {shot + 1} OF {SHOTS.length}
              </div>
              <div className='text-4 font-bold text-secondary'>{SHOTS[shot]}</div>
            </div>
            <FaceCamera
              videoRef={videoRef}
              cameraError={cameraError}
              state={issue ? 'guiding' : 'good'}
              hint={!ready ? 'Starting camera…' : issue ? FACE_HINTS[issue] : 'Hold still…'}
            />
            <div className='flex justify-center gap-2 mt-4'>
              {SHOTS.map((_, i) => (
                <span key={i} className={`w-2.5 h-2.5 rounded-full ${i < shot ? 'bg-success' : i === shot ? 'bg-accent' : 'bg-secondary/15'}`} />
              ))}
            </div>
          </>
        )}

        {step === 'saving' && <p className='text-center text-secondary py-10'>Saving face template…</p>}

        {step === 'done' && (
          <div className='text-center py-6'>
            <div className='text-5 font-bold text-success mb-2'>Face enrolled</div>
            <p className='text-3.5 text-secondary/70 mb-6'>{person.name} can now time in and out at the kiosk.</p>
            <button onClick={onClose} className='w-full py-3 rounded-lg bg-accent text-primary font-black'>
              DONE
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className='text-center py-4'>
            <p className='text-4 text-error font-semibold mb-6'>{error}</p>
            <div className='flex gap-3'>
              <button onClick={close} className='flex-1 py-3 rounded-lg border border-secondary/20 text-secondary font-semibold'>
                Close
              </button>
              <button
                onClick={() => {
                  setError(null);
                  setIssue('no_face');
                  setShot(0);
                  setStep('capture');
                }}
                className='flex-1 py-3 rounded-lg bg-accent text-primary font-black'>
                RETAKE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
