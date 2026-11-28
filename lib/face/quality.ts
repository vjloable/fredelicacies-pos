// Pure face-frame checks for the kiosk and enrollment cameras. Kept free of
// the ML library so they are unit-testable.

export type FaceIssue = 'no_face' | 'multiple_faces' | 'too_far' | 'not_facing' | 'unclear';

export interface DetectedFace {
  score: number;
  /** Face box normalized to the frame, [x, y, width, height] in 0..1. */
  boxRaw: [number, number, number, number];
  /** Head angles in radians. */
  angle?: { yaw: number; pitch: number; roll: number } | null;
  real?: number;
  live?: number;
}

// Face must fill at least this share of the frame width (roughly arm's length on a tablet).
const MIN_FACE_WIDTH = 0.2;
// About 20 degrees: beyond this the embedding drifts enough to hurt matching.
// The kiosk's turn-your-head check raises it, since those frames aren't matched.
export const MAX_YAW = 0.35;
const MAX_PITCH = 0.35;
// The detector's confidence runs lower for darker skin and in dim or backlit
// light, so a high floor locks those faces out. The face match on the server is
// the real identity check; this only rejects frames too poor to embed.
const MIN_SCORE = 0.6;

export const FACE_HINTS: Record<FaceIssue, string> = {
  no_face: 'Position your face inside the circle',
  multiple_faces: 'Only one person in front of the camera, please',
  too_far: 'Move a little closer',
  not_facing: 'Look straight at the camera',
  unclear: 'Hold still in good lighting',
};

export function assessFaces(
  faces: DetectedFace[],
  maxYaw = MAX_YAW,
): { face: DetectedFace | null; issue: FaceIssue | null } {
  if (faces.length === 0) return { face: null, issue: 'no_face' };
  if (faces.length > 1) return { face: null, issue: 'multiple_faces' };
  const face = faces[0]!;
  if (face.boxRaw[2] < MIN_FACE_WIDTH) return { face: null, issue: 'too_far' };
  if (face.angle && (Math.abs(face.angle.yaw) > maxYaw || Math.abs(face.angle.pitch) > MAX_PITCH)) {
    return { face: null, issue: 'not_facing' };
  }
  if (face.score < MIN_SCORE) return { face: null, issue: 'unclear' };
  return { face, issue: null };
}

/** Element-wise mean of several embeddings from consecutive good frames. */
export function averageEmbedding(embeddings: number[][]): number[] {
  const dim = embeddings[0]?.length ?? 0;
  const out = new Array<number>(dim).fill(0);
  for (const e of embeddings) for (let i = 0; i < dim; i++) out[i]! += e[i]! / embeddings.length;
  return out;
}

export const mean = (values: number[]): number =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

// ---- Head pose ---------------------------------------------------------------
// Poses are measured against the person's own "looking straight" baseline, so
// a slightly tilted camera or posture doesn't matter. Turn direction is checked
// by sign relative to that baseline (left/right enrollment shots must be on
// opposite sides), so the result doesn't depend on the engine's sign convention.

export interface HeadAngle {
  yaw: number;
  pitch: number;
  roll: number;
}

export type PoseHint = 'look_straight' | 'turn_more' | 'turn_less' | 'turn_other_way' | 'chin_more' | 'unclear_pose';

export const POSE_HINTS: Record<PoseHint, string> = {
  look_straight: 'Look straight at the camera',
  turn_more: 'Turn your head a little more',
  turn_less: 'Not so far, turn back a little',
  turn_other_way: 'Turn to the other side',
  chin_more: 'Lower your chin a little more',
  unclear_pose: 'Hold still in good lighting',
};

export const hintText = (hint: FaceIssue | PoseHint): string =>
  (FACE_HINTS as Record<string, string>)[hint] ?? POSE_HINTS[hint as PoseHint];

/** ~10° off the baseline counts as a deliberate turn; ~7° as a chin tilt. */
export const TURN_MIN = 0.18;
export const TILT_MIN = 0.12;
/** Within ~7° of the baseline counts as facing straight. */
const STRAIGHT_MAX = 0.12;
// Without a baseline the estimate is compared to zero, and the estimated angle
// of a face looking straight ahead varies with face shape (nose bridge, brow,
// cheekbones) and with where the tablet sits. So the first shot only needs to
// be roughly frontal (~14° yaw, ~17° pitch); later checks use it as the baseline.
const ABS_STRAIGHT_YAW = 0.25;
const ABS_STRAIGHT_PITCH = 0.3;

export const yawSide = (angle: HeadAngle, base: HeadAngle): 1 | -1 => (angle.yaw - base.yaw >= 0 ? 1 : -1);

/** Facing the camera: near the baseline if one is known, otherwise roughly frontal. */
export function checkStraight(angle: HeadAngle | null | undefined, base?: HeadAngle): PoseHint | null {
  if (!angle) return 'unclear_pose';
  if (!base) {
    return Math.abs(angle.yaw) <= ABS_STRAIGHT_YAW && Math.abs(angle.pitch) <= ABS_STRAIGHT_PITCH ? null : 'look_straight';
  }
  const yaw = angle.yaw - base.yaw;
  const pitch = angle.pitch - base.pitch;
  return Math.abs(yaw) <= STRAIGHT_MAX && Math.abs(pitch) <= STRAIGHT_MAX * 1.5 ? null : 'look_straight';
}

/** Head turned sideways from the baseline; `side` forces a particular side; `max` caps the turn. */
export function checkTurn(
  angle: HeadAngle | null | undefined,
  base: HeadAngle,
  opts: { side?: 1 | -1; max?: number } = {},
): PoseHint | null {
  if (!angle) return 'unclear_pose';
  const d = angle.yaw - base.yaw;
  if (opts.side && Math.sign(d) !== opts.side && Math.abs(d) >= TURN_MIN / 2) return 'turn_other_way';
  if (Math.abs(d) < TURN_MIN) return 'turn_more';
  if (opts.side && Math.sign(d) !== opts.side) return 'turn_other_way';
  if (opts.max !== undefined && Math.abs(d) > opts.max) return 'turn_less';
  return null;
}

/** Chin tilted from the baseline while still facing forward. */
export function checkChin(angle: HeadAngle | null | undefined, base: HeadAngle): PoseHint | null {
  if (!angle) return 'unclear_pose';
  if (Math.abs(angle.yaw - base.yaw) > TURN_MIN) return 'look_straight';
  return Math.abs(angle.pitch - base.pitch) >= TILT_MIN ? null : 'chin_more';
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}
