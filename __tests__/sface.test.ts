import { describe, expect, it } from 'vitest';
import {
  alignFace,
  invertAffine,
  l2normalize,
  landmarksFromMesh,
  similarityTransform,
  SFACE_SIZE,
  type Affine,
  type Point2,
} from '@/lib/face/sface';

const apply = (m: Affine, [x, y]: Point2): Point2 => [m[0] * x + m[1] * y + m[2], m[3] * x + m[4] * y + m[5]];

describe('similarityTransform', () => {
  it('recovers a known rotation, scale and shift', () => {
    const angle = 0.3, scale = 1.7, t: Point2 = [12, -5];
    const m: Affine = [scale * Math.cos(angle), -scale * Math.sin(angle), t[0], scale * Math.sin(angle), scale * Math.cos(angle), t[1]];
    const src: Point2[] = [[10, 20], [40, 22], [25, 35], [14, 50], [37, 51]];
    const fit = similarityTransform(src, src.map((p) => apply(m, p)));
    fit.forEach((v, i) => expect(v).toBeCloseTo(m[i]!, 6));
  });

  it('inverts', () => {
    const m: Affine = [1.2, -0.4, 7, 0.4, 1.2, -3];
    const p = apply(invertAffine(m), apply(m, [5, 9]));
    expect(p[0]).toBeCloseTo(5);
    expect(p[1]).toBeCloseTo(9);
  });
});

describe('alignFace', () => {
  it('returns RGB planes and samples the source pixels', () => {
    // Solid colour image: every in-bounds output pixel takes that colour.
    const width = 200, height = 200;
    const data = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) data.set([200, 100, 50, 255], i * 4);
    const lm: Point2[] = [[80, 90], [120, 90], [100, 110], [84, 130], [116, 130]];
    const out = alignFace({ data, width, height }, lm);
    const plane = SFACE_SIZE * SFACE_SIZE;
    expect(out.length).toBe(3 * plane);
    const centre = 56 * SFACE_SIZE + 56;
    expect(out[centre]).toBeCloseTo(200);
    expect(out[plane + centre]).toBeCloseTo(100);
    expect(out[2 * plane + centre]).toBeCloseTo(50);
  });
});

describe('landmarksFromMesh', () => {
  it('orders the points left to right in the image regardless of mesh side', () => {
    const mesh = Array.from({ length: 468 }, () => [0.5, 0.5, 0]);
    for (const i of [33, 133, 159, 145]) mesh[i] = [0.7, 0.4, 0]; // this eye is on the image right
    for (const i of [263, 362, 386, 374]) mesh[i] = [0.3, 0.4, 0];
    mesh[1] = [0.5, 0.55, 0];
    mesh[61] = [0.65, 0.7, 0];
    mesh[291] = [0.35, 0.7, 0];
    const [eyeL, eyeR, nose, mouthL, mouthR] = landmarksFromMesh(mesh, 100, 200);
    const near = (p: Point2, q: Point2) => p.forEach((v, i) => expect(v).toBeCloseTo(q[i]!));
    near(eyeL, [30, 80]);
    near(eyeR, [70, 80]);
    near(nose, [50, 110]);
    near(mouthL, [35, 140]);
    near(mouthR, [65, 140]);
  });
});

it('l2normalize gives a unit vector', () => {
  expect(l2normalize([3, 4])).toEqual([0.6, 0.8]);
});
