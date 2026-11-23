import type { RefObject } from 'react';
import type { CameraError } from '@/lib/face/useCamera';

interface FaceCameraProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  hint: string | null;
  cameraError: CameraError;
  /** Ring colour: neutral while guiding, green once the frame is good. */
  state: 'guiding' | 'good' | 'busy';
}

// Mirrored front-camera preview inside a face-shaped ring with one line of guidance.
export default function FaceCamera({ videoRef, hint, cameraError, state }: FaceCameraProps) {
  if (cameraError) {
    return (
      <div className='w-full aspect-square max-w-72 mx-auto rounded-full bg-gray-100 flex items-center justify-center p-8 text-center'>
        <p className='text-3.5 text-secondary'>
          {cameraError === 'denied'
            ? 'Camera access is blocked. Allow the camera for this site in the browser settings, then reload.'
            : 'No camera found on this device.'}
        </p>
      </div>
    );
  }

  const ring = state === 'good' ? 'ring-success' : state === 'busy' ? 'ring-accent animate-pulse' : 'ring-secondary/20';

  return (
    <div className='flex flex-col items-center gap-4'>
      <div className={`relative w-full aspect-square max-w-72 rounded-full overflow-hidden ring-8 ${ring} bg-black transition-colors`}>
        <video ref={videoRef} playsInline muted className='w-full h-full object-cover -scale-x-100' />
      </div>
      <p className='text-3.5 font-medium text-secondary text-center min-h-5' aria-live='polite'>
        {hint ?? ' '}
      </p>
    </div>
  );
}
