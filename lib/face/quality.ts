// Pure face-frame checks for the kiosk and enrollment cameras. Kept free of
// the ML library so they are unit-testable.

export type FaceIssue = 'no_face' | 'multiple_faces' | 'too_far' | 'not_facing' | 'unclear';

export interface DetectedFace {
  score: number;
  /** Face box normalized to the frame, [x, y, width, height] in 0..1. */
  boxRaw: [number, number, number, number];
  /** Head angles in radians. */
  angle?: { yaw: number; pitch: number; roll: number } | null;
  embedding?: number[];
  real?: number;
  live?: number;
}

// Face must fill at least this share of the frame width (roughly arm's length on a tablet).
const MIN_FACE_WIDTH = 0.2;
// About 20 degrees: beyond this the embedding drifts enough to hurt matching.
const MAX_YAW = 0.35;
const MAX_PITCH = 0.35;
const MIN_SCORE = 0.75;

export const FACE_HINTS: Record<FaceIssue, string> = {
  no_face: 'Position your face inside the circle',
  multiple_faces: 'Only one person in front of the camera, please',
  too_far: 'Move a little closer',
  not_facing: 'Look straight at the camera',
  unclear: 'Hold still in good lighting',
};

export function assessFaces(faces: DetectedFace[]): { face: DetectedFace | null; issue: FaceIssue | null } {
  if (faces.length === 0) return { face: null, issue: 'no_face' };
  if (faces.length > 1) return { face: null, issue: 'multiple_faces' };
  const face = faces[0]!;
  if (face.boxRaw[2] < MIN_FACE_WIDTH) return { face: null, issue: 'too_far' };
  if (face.angle && (Math.abs(face.angle.yaw) > MAX_YAW || Math.abs(face.angle.pitch) > MAX_PITCH)) {
    return { face: null, issue: 'not_facing' };
  }
  if (face.score < MIN_SCORE || !face.embedding || face.embedding.length === 0) {
    return { face: null, issue: 'unclear' };
  }
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
