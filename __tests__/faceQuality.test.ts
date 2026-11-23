import { describe, expect, it } from 'vitest';
import { assessFaces, averageEmbedding, type DetectedFace } from '@/lib/face/quality';

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
