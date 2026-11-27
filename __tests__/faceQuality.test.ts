import { describe, expect, it } from 'vitest';
import {
  assessFaces,
  averageEmbedding,
  checkChin,
  checkStraight,
  checkTurn,
  cosineSimilarity,
  yawSide,
  type DetectedFace,
} from '@/lib/face/quality';

const good: DetectedFace = {
  score: 0.95,
  boxRaw: [0.3, 0.2, 0.35, 0.45],
  angle: { yaw: 0.05, pitch: -0.1, roll: 0 },
  embedding: [0.1, 0.2],
  real: 0.9,
  live: 0.9,
};

describe('assessFaces', () => {
  it('accepts one clear, frontal, close face', () => {
    expect(assessFaces([good])).toEqual({ face: good, issue: null });
  });

  it('asks for a face when none is found', () => {
    expect(assessFaces([]).issue).toBe('no_face');
  });

  it('rejects more than one person', () => {
    expect(assessFaces([good, good]).issue).toBe('multiple_faces');
  });

  it('asks to move closer when the face is small', () => {
    expect(assessFaces([{ ...good, boxRaw: [0.4, 0.4, 0.1, 0.12] }]).issue).toBe('too_far');
  });

  it('asks to face the camera when the head is turned', () => {
    expect(assessFaces([{ ...good, angle: { yaw: 0.6, pitch: 0, roll: 0 } }]).issue).toBe('not_facing');
  });

  it('treats low confidence or a missing embedding as unclear', () => {
    expect(assessFaces([{ ...good, score: 0.4 }]).issue).toBe('unclear');
    expect(assessFaces([{ ...good, embedding: undefined }]).issue).toBe('unclear');
  });
});

describe('averageEmbedding', () => {
  it('averages element-wise', () => {
    expect(averageEmbedding([[1, 3], [3, 5]])).toEqual([2, 4]);
  });
});

describe('head pose checks', () => {
  const base = { yaw: 0.05, pitch: -0.02, roll: 0 };
  const at = (yaw: number, pitch = base.pitch) => ({ yaw, pitch, roll: 0 });

  it('straight: near the baseline (or zero) passes, a turned head does not', () => {
    expect(checkStraight(at(0.02))).toBeNull();
    expect(checkStraight(at(0.3))).toBe('look_straight');
    expect(checkStraight(at(0.1), base)).toBeNull();
    expect(checkStraight(at(0.3), base)).toBe('look_straight');
    expect(checkStraight(null)).toBe('unclear_pose');
  });

  it('straight without a baseline tolerates the per-face offset of the angle estimate', () => {
    expect(checkStraight(at(0.2, 0.25))).toBeNull();
    expect(checkStraight(at(0.2, 0.25), base)).toBe('look_straight');
    expect(checkStraight(at(0.05, 0.4))).toBe('look_straight');
  });

  it('turn: needs a real turn from the baseline, either side', () => {
    expect(checkTurn(at(0.1), base)).toBe('turn_more');
    expect(checkTurn(at(0.3), base)).toBeNull();
    expect(checkTurn(at(-0.2), base)).toBeNull();
  });

  it('turn: enforces the requested side and a maximum', () => {
    expect(checkTurn(at(-0.25), base, { side: 1 })).toBe('turn_other_way');
    expect(checkTurn(at(0.3), base, { side: 1 })).toBeNull();
    expect(checkTurn(at(0.6), base, { side: 1, max: 0.35 })).toBe('turn_less');
  });

  it('left then right lands on opposite sides', () => {
    const left = at(0.3);
    const side = yawSide(left, base);
    expect(checkTurn(at(0.3), base, { side: side === 1 ? -1 : 1 })).toBe('turn_other_way');
    expect(checkTurn(at(-0.2), base, { side: side === 1 ? -1 : 1 })).toBeNull();
  });

  it('chin: needs a tilt while still facing forward', () => {
    expect(checkChin(at(0.05, -0.05), base)).toBe('chin_more');
    expect(checkChin(at(0.05, 0.15), base)).toBeNull();
    expect(checkChin(at(0.4, 0.15), base)).toBe('look_straight');
  });

  it('a turned head can pass quality only when the limit is raised', () => {
    const turned = { ...good, angle: { yaw: 0.6, pitch: 0, roll: 0 } };
    expect(assessFaces([turned]).issue).toBe('not_facing');
    expect(assessFaces([turned], 0.9).issue).toBeNull();
  });
});

describe('cosineSimilarity', () => {
  it('is 1 for the same direction and 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 2], [2, 4])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
});
