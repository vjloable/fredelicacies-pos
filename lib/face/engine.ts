// Browser face engine for the attendance kiosk and enrollment. @vladmandic/human
// finds the face, its mesh and head pose and scores anti-spoof / liveness; the
// SFace recognizer (OpenCV Zoo, run with onnxruntime-web) turns the aligned face
// into the 128-number template. The image never leaves the device: only the
// template plus the anti-spoof / liveness scores are sent to the face service.
import type { Config, Human, Result } from '@vladmandic/human';
import type * as Ort from 'onnxruntime-web';
import { alignFace, l2normalize, landmarksFromMesh, SFACE_SIZE, type Point2 } from './sface';
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
export const FACE_MODEL = 'sface-2021dec';
// Keep in step with the @vladmandic/human and onnxruntime-web devDependencies (used for types only).
const HUMAN_CDN = 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6';
const ORT_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/';
// fp32 model pinned to a Hugging Face revision (37 MB). The int8 build drifts
// from OpenCV's reference output and is slower under WASM.
const SFACE_URL =
  'https://huggingface.co/opencv/face_recognition_sface/resolve/3d7082438a6e4551e840c9b2bb60b71e8da4b524/face_recognition_sface_2021dec.onnx';
const MODEL_CACHE = 'face-models-v1';

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
    // Templates come from SFace, not Human's own descriptor.
    description: { enabled: false },
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

interface FaceEngine {
  human: Human;
  ort: typeof Ort;
  sface: Ort.InferenceSession;
}

let enginePromise: Promise<FaceEngine> | null = null;

/** Download once into Cache Storage so kiosks don't refetch 37 MB when the HTTP cache is evicted. */
async function fetchModel(url: string): Promise<ArrayBuffer> {
  const cache = typeof caches === 'undefined' ? null : await caches.open(MODEL_CACHE).catch(() => null);
  const hit = await cache?.match(url);
  if (hit) return hit.arrayBuffer();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Face model download failed (${res.status})`);
  await cache?.put(url, res.clone()).catch(() => {});
  return res.arrayBuffer();
}

/** Load the models once per page (about 60 MB on first use, then cached). */
export function loadFaceEngine(): Promise<FaceEngine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      // Human's default entry is a Node/tfjs-node build that Next can't bundle, and
      // onnxruntime-web ships its WASM separately, so both load from the CDN.
      const humanUrl = `${HUMAN_CDN}/dist/human.esm.js`;
      const ortUrl = `${ORT_CDN}ort.wasm.min.mjs`;
      const [humanMod, ort, model] = await Promise.all([
        import(/* webpackIgnore: true */ /* turbopackIgnore: true */ humanUrl) as Promise<typeof import('@vladmandic/human')>,
        import(/* webpackIgnore: true */ /* turbopackIgnore: true */ ortUrl) as Promise<typeof Ort>,
        fetchModel(SFACE_URL),
      ]);
      ort.env.wasm.wasmPaths = ORT_CDN;
      ort.env.wasm.numThreads = 1; // threads need cross-origin isolation, which the app doesn't set
      const human = new humanMod.Human(config);
      const [sface] = await Promise.all([
        ort.InferenceSession.create(new Uint8Array(model), { executionProviders: ['wasm'] }),
        human.load().then(() => human.warmup()),
      ]);
      return { human, ort, sface };
    })().catch((err) => {
      enginePromise = null;
      throw err;
    });
  }
  return enginePromise;
}

/** 128-number SFace template of the face at `landmarks` in the frame. */
async function embed(engine: FaceEngine, frame: ImageData, landmarks: Point2[]): Promise<number[]> {
  const input = new engine.ort.Tensor('float32', alignFace(frame, landmarks), [1, 3, SFACE_SIZE, SFACE_SIZE]);
  const out = await engine.sface.run({ [engine.sface.inputNames[0]!]: input });
  return l2normalize(out[engine.sface.outputNames[0]!]!.data as Float32Array);
}

type Detected = DetectedFace & { meshRaw: Result['face'][number]['meshRaw'] };

function toDetected(result: Result): Detected[] {
  return result.face.map((f) => ({
    score: f.score,
    boxRaw: f.boxRaw,
    angle: f.rotation?.angle ?? null,
    real: f.real,
    live: f.live,
    meshRaw: f.meshRaw,
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
  const engine = await loadFaceEngine();
  const deadline = Date.now() + timeoutMs;
  // Detection and the crop for the template must use the same pixels, so each
  // frame is copied out of the video once and both work on the copy.
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  let good: { face: DetectedFace; embedding: number[] }[] = [];

  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('ABORTED');
    if (video.readyState >= 2 && video.videoWidth > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const faces = toDetected(await engine.human.detect(canvas));
      const now = Date.now();
      onFrame?.(faces.length === 1 ? faces[0]! : null);
      if (session) {
        if (faces.length === 1) session.lastFaceAt = now;
        else if (session.lastFaceAt && now - session.lastFaceAt > MAX_GAP_MS) throw new Error('LOST_FACE');
      }
      const { face, issue } = assessFaces(faces, maxYaw);
      const poseHint = face && pose ? pose(face.angle ?? null) : null;
      const mesh = (face as Detected | null)?.meshRaw;
      const usable = face && !poseHint && mesh && mesh.length >= 468;
      onHint?.(issue ?? poseHint ?? (face && !usable ? 'unclear' : null));
      if (usable) {
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const embedding = await embed(engine, frame, landmarksFromMesh(mesh, canvas.width, canvas.height));
        good = [...good, { face, embedding }];
      } else {
        good = [];
      }
      if (good.length >= frames) {
        return {
          embedding: l2normalize(averageEmbedding(good.map((g) => g.embedding))),
          antispoof: mean(good.map((g) => g.face.real ?? 0)),
          liveness: mean(good.map((g) => g.face.live ?? 0)),
          angle: good[good.length - 1]!.face.angle ?? null,
        };
      }
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error('TIMEOUT');
}
