import {
  flipHorizontal,
  flipVertical,
  rotate90,
  resetTransform,
} from "./transformUtils";
import type { TransformableImage } from "./transformUtils";
import { describe, expect, test } from "vitest";

const baseImage: TransformableImage = {
  id: "img1",
  url: "test.png",
  x: 100,
  y: 100,
  scaleX: 1,
  scaleY: 1,
  width: 200,
  height: 200,
  rotation: 90,
};

describe("transformUtils", () => {
  test("flipHorizontal negates scaleX", () => {
    const result = flipHorizontal(baseImage);
    expect(result.scaleX).toBe(-1);
  });

  test("flipVertical negates scaleY", () => {
    const result = flipVertical(baseImage);
    expect(result.scaleY).toBe(-1);
  });

  test("rotate90 adds 90 degrees to rotation and wraps at 360", () => {
    const result = rotate90(baseImage);
    expect(result.rotation).toBe(180);
  });

  test("rotate90 wraps to 60 after exceeding 360", () => {
    const result = rotate90({ ...baseImage, rotation: 330 });
    expect(result.rotation).toBe(60);
  });

  test("resetTransform returns default values", () => {
    const result = resetTransform();
    expect(result).toEqual({
      x: 400,
      y: 400,
      scaleX: 0.5,
      scaleY: 0.5,
      rotation: 0,
    });
  });
});
