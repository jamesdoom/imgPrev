export interface TransformableImage {
  id: string;
  url: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  width: number;
  height: number;
  rotation?: number;
}

export function flipHorizontal(
  image: TransformableImage
): Partial<TransformableImage> {
  return { scaleX: -image.scaleX };
}

export function flipVertical(
  image: TransformableImage
): Partial<TransformableImage> {
  return { scaleY: -image.scaleY };
}

export function rotate90(
  image: TransformableImage
): Partial<TransformableImage> {
  const newRotation = (image.rotation ?? 0) + 90;
  return { rotation: newRotation % 360 };
}

export function resetTransform(): Partial<TransformableImage> {
  return {
    x: 400,
    y: 400,
    scaleX: 0.5,
    scaleY: 0.5,
    rotation: 0,
  };
}
