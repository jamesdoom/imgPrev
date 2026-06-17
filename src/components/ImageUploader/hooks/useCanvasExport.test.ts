import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { RefObject } from "react";
import type Konva from "konva";
import { useCanvasExport } from "./useCanvasExport";

const originalFetch = globalThis.fetch;
const requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
  callback(0);
  return 1;
});

function stageRef(toDataURL: () => string): RefObject<Konva.Stage | null> {
  return {
    current: {
      toDataURL,
    } as Konva.Stage,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    writable: true,
    value: requestAnimationFrameMock,
  });
  requestAnimationFrameMock.mockClear();
});

describe("useCanvasExport", () => {
  test("exports a clean canvas blob and restores the grid", async () => {
    const setShowGrid = vi.fn();
    const blob = new Blob(["image"], { type: "image/png" });
    globalThis.fetch = vi.fn().mockResolvedValue({
      blob: async () => blob,
    }) as unknown as typeof globalThis.fetch;

    const { result } = renderHook(() =>
      useCanvasExport({
        stageRef: stageRef(() => "data:image/png;base64,AAAA"),
        setShowGrid,
      })
    );

    let exportedBlob: Blob | null = null;
    await act(async () => {
      exportedBlob = await result.current.getCleanCanvasBlob();
    });

    expect(exportedBlob).toBe(blob);
    expect(setShowGrid).toHaveBeenNthCalledWith(1, false);
    expect(setShowGrid).toHaveBeenLastCalledWith(true);
  });

  test("restores the grid when canvas export fails", async () => {
    const setShowGrid = vi.fn();
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error("export failed")) as unknown as typeof globalThis.fetch;

    const { result } = renderHook(() =>
      useCanvasExport({
        stageRef: stageRef(() => "data:image/png;base64,AAAA"),
        setShowGrid,
      })
    );

    await expect(result.current.getCleanCanvasBlob()).rejects.toThrow(
      "export failed"
    );
    expect(setShowGrid).toHaveBeenNthCalledWith(1, false);
    expect(setShowGrid).toHaveBeenLastCalledWith(true);
  });

  test("returns null when no stage is available", async () => {
    const setShowGrid = vi.fn();
    const { result } = renderHook(() =>
      useCanvasExport({
        stageRef: { current: null },
        setShowGrid,
      })
    );

    let exportedBlob: Blob | null = null;
    await act(async () => {
      exportedBlob = await result.current.getCleanCanvasBlob();
    });

    expect(exportedBlob).toBeNull();
    expect(setShowGrid).not.toHaveBeenCalled();
  });
});
