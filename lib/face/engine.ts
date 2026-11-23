// Browser face engine for the attendance kiosk and enrollment (@vladmandic/human).
// The image never leaves the device: only the 1024-number embedding plus the
// anti-spoof / liveness scores are sent to the face attendance service.
import type { Config, Human, Result } from '@vladmandic/human';
import { assessFaces, averageEmbedding, mean, type DetectedFace, type FaceIssue } from './quality';

// Must equal FACE_MODEL on the face attendance service. Changing the model
// version means re-enrolling everyone.
export const FACE_MODEL = 'human-faceres';
// Keep in step with the @vladmandic/human devDependency (used for types only).
const HUMAN_CDN = 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6';

const config: Partial<Config> = {
  modelBasePath: `${HUMAN_CDN}/models/`,
  backend: 'webgl',
  cacheSensitivity: 0,
  filter: { enabled: true, flip: false },
  face: {
    enabled: true,
    detector: { rotation: true, maxDetected: 2, minConfidence: 0.5, return: false },
    mesh: { enabled: true },
    attention: { enabled: false },
    iris: { enabled: false },
    description: { enabled: true },
    emotion: { enabled: false },
    antispoof: { enabled: true },
    liveness: { enabled: true },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: false },
  segmentation: { enabled: false },
};

let humanPromise: Promise<Human> | null = null;

/** Load the models once per page (about 10 MB on first use, then browser-cached). */
export function loadFaceEngine(): Promise<Human> {
  if (!humanPromise) {
    humanPromise = (async () => {
      // The package's default entry is a Node/tfjs-node build that Next can't bundle,
      // so the self-contained browser bundle is loaded from the CDN at runtime.
      const url = `${HUMAN_CDN}/dist/human.esm.js`;
      const mod = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url)) as typeof import('@vladmandic/human');
      const human = new mod.Human(config);
      await human.load();
      await human.warmup();
      return human;
    })().catch((err) => {
      humanPromise = null;
      throw err;
    });
  }
  return humanPromise;
}

function toDetected(result: Result): DetectedFace[] {
  return result.face.map((f) => ({
    score: f.score,
    boxRaw: f.boxRaw,
    angle: f.rotation?.angle ?? null,
    embedding: f.embedding,
    real: f.real,
    live: f.live,
  }));
}

export interface FaceSample {
  embedding: number[];
  antispoof: number;
  liveness: number;
}

/**
 * Watch the video until `frames` consecutive good frames are seen, then return
 * their averaged embedding and scores. `onHint` receives what the person should
 * fix (null while the frame is good). Rejects with 'TIMEOUT' or 'ABORTED'.
 */
export async function captureFace(
  video: HTMLVideoElement,
  opts: { frames?: number; timeoutMs?: number; signal?: AbortSignal; onHint?: (issue: FaceIssue | null) => void } = {},
): Promise<FaceSample> {
  const { frames = 3, timeoutMs = 20_000, signal, onHint } = opts;
  const human = await loadFaceEngine();
  const deadline = Date.now() + timeoutMs;
  let good: DetectedFace[] = [];

  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('ABORTED');
    if (video.readyState >= 2) {
      const { face, issue } = assessFaces(toDetected(await human.detect(video)));
      onHint?.(issue);
      good = face ? [...good, face] : [];
      if (good.length >= frames) {
        return {
          embedding: averageEmbedding(good.map((f) => f.embedding!)),
          antispoof: mean(good.map((f) => f.real ?? 0)),
          liveness: mean(good.map((f) => f.live ?? 0)),
        };
      }
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error('TIMEOUT');
}
