import { act, renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { ImageUpdate, UploadedImage } from "../../../types";
import { useImageTransforms } from "./useImageTransforms";

const baseImage: UploadedImage = {
  id: "image-1",
  url: "image.png",
  x: 100,
  y: 120,
  scaleX: 1,
  scaleY: 0.75,
  width: 400,
  height: 300,
  rotation: 270,
};

function renderTransforms(
  selectedId: string | null,
  updateImage = vi.fn<(id: string, updates: ImageUpdate) => void>()
) {
  const hook = renderHook(() =>
    useImageTransforms({
      images: [baseImage],
      selectedId,
      updateImage,
    })
  );

  return { hook, updateImage };
}

describe("useImageTransforms", () => {
  test("does nothing when no image is selected", () => {
    const { hook, updateImage } = renderTransforms(null);

    act(() => {
      hook.result.current.rotateSelected();
    });

    expect(updateImage).not.toHaveBeenCalled();
  });

  test("flips the selected image horizontally", () => {
    const { hook, updateImage } = renderTransforms("image-1");

    act(() => {
      hook.result.current.flipSelectedHorizontal();
    });

    expect(updateImage).toHaveBeenCalledWith("image-1", { scaleX: -1 });
  });

  test("flips the selected image vertically", () => {
    const { hook, updateImage } = renderTransforms("image-1");

    act(() => {
      hook.result.current.flipSelectedVertical();
    });

    expect(updateImage).toHaveBeenCalledWith("image-1", { scaleY: -0.75 });
  });

  test("rotates the selected image and wraps at 360 degrees", () => {
    const { hook, updateImage } = renderTransforms("image-1");

    act(() => {
      hook.result.current.rotateSelected();
    });

    expect(updateImage).toHaveBeenCalledWith("image-1", { rotation: 0 });
  });

  test("resets the selected image transform", () => {
    const { hook, updateImage } = renderTransforms("image-1");

    act(() => {
      hook.result.current.resetSelectedTransforms();
    });

    expect(updateImage).toHaveBeenCalledWith("image-1", {
      x: 400,
      y: 400,
      scaleX: 0.5,
      scaleY: 0.5,
      rotation: 0,
    });
  });
});
