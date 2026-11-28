// Face alignment and input preparation for the SFace recognizer (OpenCV Zoo,
// Apache-2.0). Mirrors OpenCV's FaceRecognizerSF.alignCrop + feature: the five
// landmarks are mapped onto a fixed 112x112 template by a similarity transform,
// the face is resampled bilinearly, and fed as RGB 0..255 in NCHW with no
// normalization. Pure functions, kept free of the ML runtime so they are
// unit-testable against OpenCV's own output.

export type Point2 = [number, number];

/** Pixels as in ImageData: RGBA, row-major. */
export interface Pixels {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

export const SFACE_SIZE = 112;
export const SFACE_DIM = 128;

// Destination landmarks in the 112x112 crop, in image order: eye on the image
// left, eye on the image right, nose tip, mouth corner image left, image right.
const TEMPLATE: Point2[] = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
];

/** 2x3 affine: x' = m[0]x + m[1]y + m[2], y' = m[3]x + m[4]y + m[5]. */
export type Affine = [number, number, number, number, number, number];

/** Least-squares rotation + uniform scale + translation mapping src onto dst. */
export function similarityTransform(src: Point2[], dst: Point2[]): Affine {
  const n = src.length;
  let sx = 0, sy = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    sx += src[i]![0]; sy += src[i]![1];
    dx += dst[i]![0]; dy += dst[i]![1];
  }
  sx /= n; sy /= n; dx /= n; dy /= n;
  let num = 0, cross = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const ax = src[i]![0] - sx, ay = src[i]![1] - sy;
    const bx = dst[i]![0] - dx, by = dst[i]![1] - dy;
    num += ax * bx + ay * by;
    cross += ax * by - ay * bx;
    den += ax * ax + ay * ay;
  }
  const a = num / den;
  const b = cross / den;
  return [a, -b, dx - (a * sx - b * sy), b, a, dy - (b * sx + a * sy)];
}

export function invertAffine(m: Affine): Affine {
  const det = m[0] * m[4] - m[1] * m[3];
  const i0 = m[4] / det, i1 = -m[1] / det, i3 = -m[3] / det, i4 = m[0] / det;
  return [i0, i1, -(i0 * m[2] + i1 * m[5]), i3, i4, -(i3 * m[2] + i4 * m[5])];
}

/**
 * Warp the face onto the template and return the model input: Float32 NCHW
 * (1x3x112x112), RGB, 0..255. Pixels outside the image are black, as in
 * OpenCV's warpAffine default border.
 */
export function alignFace(img: Pixels, landmarks: Point2[]): Float32Array {
  const inv = invertAffine(similarityTransform(landmarks, TEMPLATE));
  const S = SFACE_SIZE;
  const plane = S * S;
  const out = new Float32Array(3 * plane);
  const { data, width, height } = img;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const fx = inv[0] * x + inv[1] * y + inv[2];
      const fy = inv[3] * x + inv[4] * y + inv[5];
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const wx = fx - x0, wy = fy - y0;
      const o = y * S + x;
      for (let c = 0; c < 3; c++) {
        let v = 0;
        for (let j = 0; j < 2; j++) {
          const py = y0 + j;
          if (py < 0 || py >= height) continue;
          const w = j ? wy : 1 - wy;
          for (let i = 0; i < 2; i++) {
            const px = x0 + i;
            if (px < 0 || px >= width) continue;
            v += w * (i ? wx : 1 - wx) * data[(py * width + px) * 4 + c]!;
          }
        }
        out[c * plane + o] = v;
      }
    }
  }
  return out;
}

// MediaPipe face-mesh indices (as returned by Human's face mesh).
const EYE_A = [33, 133, 159, 145];
const EYE_B = [263, 362, 386, 374];
const NOSE_TIP = 1;
const MOUTH_A = 61;
const MOUTH_B = 291;

/**
 * The five SFace landmarks from a 468-point face mesh normalized to 0..1,
 * scaled to the frame and put in template (image left → right) order.
 */
export function landmarksFromMesh(meshRaw: ArrayLike<ArrayLike<number | undefined>>, width: number, height: number): Point2[] {
  const pt = (i: number): Point2 => [meshRaw[i]![0]! * width, meshRaw[i]![1]! * height];
  const centre = (idx: number[]): Point2 => {
    const ps = idx.map(pt);
    return [ps.reduce((s, p) => s + p[0], 0) / ps.length, ps.reduce((s, p) => s + p[1], 0) / ps.length];
  };
  const byX = (p: Point2, q: Point2): [Point2, Point2] => (p[0] <= q[0] ? [p, q] : [q, p]);
  const [eyeL, eyeR] = byX(centre(EYE_A), centre(EYE_B));
  const [mouthL, mouthR] = byX(pt(MOUTH_A), pt(MOUTH_B));
  return [eyeL, eyeR, pt(NOSE_TIP), mouthL, mouthR];
}

export function l2normalize(v: ArrayLike<number>): number[] {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i]! * v[i]!;
  n = Math.sqrt(n) || 1;
  return Array.from(v, (x) => x / n);
}
