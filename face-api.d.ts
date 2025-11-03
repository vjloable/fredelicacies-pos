declare module 'face-api.js' {
  export class TinyFaceDetectorOptions {
    constructor(options?: { inputSize?: number; scoreThreshold?: number });
  }

  export interface FaceDetection {
    box: { x: number; y: number; width: number; height: number };
    score: number;
  }

  export interface FaceLandmarks {
    positions: Array<{ x: number; y: number }>;
  }

  export interface WithFaceDetection<T> {
    detection: FaceDetection;
  }

  export interface WithFaceLandmarks<T> {
    landmarks: FaceLandmarks;
  }

  export interface WithFaceDescriptor<T> {
    descriptor: Float32Array;
  }

  export interface FullFaceDescription
    extends WithFaceDetection<{}>,
      WithFaceLandmarks<{}>,
      WithFaceDescriptor<{}> {}

  export const nets: {
    tinyFaceDetector: {
      loadFromUri(uri: string): Promise<void>;
    };
    faceLandmark68Net: {
      loadFromUri(uri: string): Promise<void>;
    };
    faceRecognitionNet: {
      loadFromUri(uri: string): Promise<void>;
    };
  };

  export function detectSingleFace(
    input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    options?: TinyFaceDetectorOptions
  ): DetectSingleFaceTask;

  export interface DetectSingleFaceTask {
    withFaceLandmarks(): DetectSingleFaceTask;
    withFaceDescriptor(): Promise<FullFaceDescription | undefined>;
  }

  export function euclideanDistance(arr1: Float32Array, arr2: Float32Array): number;
}
