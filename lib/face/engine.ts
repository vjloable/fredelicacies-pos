// Browser face engine for the attendance kiosk and enrollment (@vladmandic/human).
// The image never leaves the device: only the 1024-number embedding plus the
// anti-spoof / liveness scores are sent to the face attendance service.
import type { Config, Human, Result } from '@vladmandic/human';
import {
  assessFaces,
  averageEmbedding,
  mean,
  MAX_YAW,
  type DetectedFace,
  type FaceIssue,
  type HeadAngle,
  type PoseHint,
} from './quality';

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
  /** Head angle of the last accepted frame (the pose baseline for later checks). */
  angle: HeadAngle | null;
}

/**
 * Shared across the captures of one check so the face must stay in view the
 * whole time; a gap longer than MAX_GAP_MS fails with 'LOST_FACE'.
 */
export interface FaceSession {
  lastFaceAt: number;
}

const MAX_GAP_MS = 1500;

export interface CaptureOptions {
  /** Consecutive accepted frames required (the pose must be held this long). */
  frames?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** What the person should fix; null while the frame is good. */
  onHint?: (hint: FaceIssue | PoseHint | null) => void;
  /** Extra condition on the head pose, e.g. "turned to the side". */
  pose?: (angle: HeadAngle | null) => PoseHint | null;
  /** Allowed head turn before a frame is rejected (raise it for the turn check). */
  maxYaw?: number;
  session?: FaceSession;
  /** Raw reading of each frame (null when there isn't exactly one face), for tuning. */
  onFrame?: (face: DetectedFace | null) => void;
}

/**
 * Watch the video until `frames` consecutive frames pass the quality checks and
 * the optional `pose` condition, then return their averaged embedding and
 * scores. Rejects with 'TIMEOUT', 'ABORTED' or 'LOST_FACE'.
 */
export async function captureFace(video: HTMLVideoElement, opts: CaptureOptions = {}): Promise<FaceSample> {
  const { frames = 3, timeoutMs = 20_000, signal, onHint, pose, maxYaw = MAX_YAW, session, onFrame } = opts;
  const human = await loadFaceEngine();
  const deadline = Date.now() + timeoutMs;
  let good: DetectedFace[] = [];

  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('ABORTED');
    if (video.readyState >= 2) {
      const faces = toDetected(await human.detect(video));
      onFrame?.(faces.length === 1 ? faces[0]! : null);
      const now = Date.now();
      if (session) {
        if (faces.length === 1) session.lastFaceAt = now;
        else if (session.lastFaceAt && now - session.lastFaceAt > MAX_GAP_MS) throw new Error('LOST_FACE');
      }
      const { face, issue } = assessFaces(faces, maxYaw);
      const poseHint = face && pose ? pose(face.angle ?? null) : null;
      onHint?.(issue ?? poseHint);
      good = face && !poseHint ? [...good, face] : [];
      if (good.length >= frames) {
        return {
          embedding: averageEmbedding(good.map((f) => f.embedding!)),
          antispoof: mean(good.map((f) => f.real ?? 0)),
          liveness: mean(good.map((f) => f.live ?? 0)),
          angle: good[good.length - 1]!.angle ?? null,
        };
      }
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error('TIMEOUT');
}
