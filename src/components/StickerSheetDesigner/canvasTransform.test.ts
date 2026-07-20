import { describe, expect, test } from "vitest";
import { commitCanvasTransform } from "./canvasTransform";

describe("commitCanvasTransform", () => {
  test("normalizes scale so a following inward drag reduces size", () => {
    const outward = commitCanvasTransform({
      minimumSizePx: 24,
      pixelsPerInch: 96,
      transform: {
        x: 144,
        y: 144,
        width: 96,
        height: 96,
        scaleX: 1.02,
        scaleY: 1.02,
        rotation: 0,
      },
    });
    const inward = commitCanvasTransform({
      minimumSizePx: 24,
      pixelsPerInch: 96,
      transform: {
        ...outward.node,
        scaleX: 0.99,
        scaleY: 0.99,
      },
    });

    expect(outward.node.scaleX).toBe(1);
    expect(outward.node.scaleY).toBe(1);
    expect(inward.patch.widthIn).toBeLessThan(outward.patch.widthIn);
    expect(inward.patch.heightIn).toBeLessThan(outward.patch.heightIn);
  });

  test("keeps the transformed center anchored and honors minimum size", () => {
    const result = commitCanvasTransform({
      minimumSizePx: 24,
      pixelsPerInch: 96,
      transform: {
        x: 100,
        y: 120,
        width: 96,
        height: 48,
        scaleX: 0.01,
        scaleY: 0.01,
        rotation: -90,
      },
    });

    expect(result.node).toMatchObject({
      height: 24,
      offsetX: 12,
      offsetY: 12,
      scaleX: 1,
      scaleY: 1,
      width: 24,
      x: 100,
      y: 120,
    });
    expect(result.patch).toMatchObject({
      heightIn: 0.25,
      rotationDeg: 270,
      widthIn: 0.25,
    });
  });
});
