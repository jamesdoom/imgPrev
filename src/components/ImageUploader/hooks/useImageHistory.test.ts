import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { UploadedImage } from "../../../types";
import { useImageHistory } from "./useImageHistory";

const showToast = vi.fn();

vi.mock("../utils/showToast", () => ({
  showToast: (message: string, options: unknown) => showToast(message, options),
}));

function image(id: string): UploadedImage {
  return {
    id,
    url: `${id}.png`,
    x: 100,
    y: 100,
    scaleX: 1,
    scaleY: 1,
    width: 200,
    height: 200,
  };
}

beforeEach(() => {
  showToast.mockClear();
});

describe("useImageHistory", () => {
  test("updates images and exposes undo availability", () => {
    const { result } = renderHook(() => useImageHistory());

    act(() => {
      result.current.updateImages(() => [image("one")]);
    });

    expect(result.current.images).toEqual([image("one")]);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  test("updates one image by id", () => {
    const { result } = renderHook(() => useImageHistory());

    act(() => {
      result.current.updateImages(() => [image("one"), image("two")]);
      result.current.updateImage("two", { rotation: 90, scaleX: 0.5 });
    });

    expect(result.current.images).toEqual([
      image("one"),
      { ...image("two"), rotation: 90, scaleX: 0.5 },
    ]);
  });

  test("undo and redo restore previous image states", () => {
    const { result } = renderHook(() => useImageHistory());

    act(() => {
      result.current.updateImages(() => [image("one")]);
    });

    act(() => {
      result.current.updateImages((prev) => [...prev, image("two")]);
    });

    expect(result.current.images.map((img) => img.id)).toEqual(["one", "two"]);

    act(() => {
      result.current.undo();
    });

    expect(result.current.images.map((img) => img.id)).toEqual(["one"]);
    expect(result.current.canRedo).toBe(true);
    expect(showToast).toHaveBeenCalledWith("Undo performed", {
      id: "undo-toast",
    });

    act(() => {
      result.current.redo();
    });

    expect(result.current.images.map((img) => img.id)).toEqual(["one", "two"]);
    expect(result.current.canRedo).toBe(false);
    expect(showToast).toHaveBeenCalledWith("Redo applied", {
      id: "redo-toast",
    });
  });

  test("keeps only the latest 20 undo entries", () => {
    const { result } = renderHook(() => useImageHistory());

    for (let i = 0; i < 25; i += 1) {
      act(() => {
        result.current.updateImages(() => [image(String(i))]);
      });
    }

    for (let i = 0; i < 25; i += 1) {
      act(() => {
        result.current.undo();
      });
    }

    expect(result.current.images).toEqual([image("4")]);
    expect(result.current.canUndo).toBe(false);
  });
});
