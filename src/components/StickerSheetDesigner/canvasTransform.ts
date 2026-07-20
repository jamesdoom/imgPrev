export interface CanvasTransformState {
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  width: number;
  x: number;
  y: number;
}

export interface CommittedCanvasTransform {
  node: CanvasTransformState & {
    offsetX: number;
    offsetY: number;
  };
  patch: {
    heightIn: number;
    rotationDeg: number;
    scaleX: number;
    scaleY: number;
    widthIn: number;
    xIn: number;
    yIn: number;
  };
}

export function commitCanvasTransform({
  minimumSizePx,
  pixelsPerInch,
  transform,
}: {
  minimumSizePx: number;
  pixelsPerInch: number;
  transform: CanvasTransformState;
}): CommittedCanvasTransform {
  const scaleX = transform.scaleX < 0 ? -1 : 1;
  const scaleY = transform.scaleY < 0 ? -1 : 1;
  const width = Math.max(
    minimumSizePx,
    transform.width * Math.abs(transform.scaleX),
  );
  const height = Math.max(
    minimumSizePx,
    transform.height * Math.abs(transform.scaleY),
  );

  return {
    node: {
      ...transform,
      width,
      height,
      offsetX: width / 2,
      offsetY: height / 2,
      scaleX,
      scaleY,
    },
    patch: {
      xIn: (transform.x - width / 2) / pixelsPerInch,
      yIn: (transform.y - height / 2) / pixelsPerInch,
      widthIn: width / pixelsPerInch,
      heightIn: height / pixelsPerInch,
      rotationDeg: normalizeRotation(transform.rotation),
      scaleX,
      scaleY,
    },
  };
}

function normalizeRotation(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}
