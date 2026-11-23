import { useEffect, useRef, useState } from 'react';

export type CameraError = 'denied' | 'unavailable' | null;

/** Front camera stream bound to a <video>; stopped when `active` turns false or on unmount. */
export function useCamera(active: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<CameraError>(null);

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    const video = videoRef.current;

    (async () => {
      setError(null);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          // Closed while the permission prompt was open: cleanup already ran.
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (video) {
          video.srcObject = stream;
          await video.play();
          setReady(true);
        }
      } catch (err) {
        if (cancelled) return;
        const name = (err as DOMException)?.name;
        setError(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
      }
    })();

    return () => {
      cancelled = true;
      setReady(false);
      stream?.getTracks().forEach((t) => t.stop());
      if (video) video.srcObject = null;
    };
  }, [active]);

  return { videoRef, ready, error };
}
