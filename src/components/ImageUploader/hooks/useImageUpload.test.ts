import { act, renderHook } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import type { ImageUpdater, UploadedImage } from "../../../types";
import { useImageUpload } from "./useImageUpload";

const getDpi = vi.fn();

vi.mock("../utils/getDpi", () => ({
  getDpi: (file: File) => getDpi(file),
}));

const originalFetch = globalThis.fetch;
const originalImage = globalThis.Image;

class MockImage {
  naturalWidth = 640;
  naturalHeight = 480;
  src = "";

  decode = vi.fn().mockResolvedValue(undefined);
}

function file(name: string, size: number, type: string): File {
  return new File([new Uint8Array(size)], name, { type });
}

function renderUpload() {
  const imageStates: UploadedImage[][] = [];
  const onUploadStart = vi.fn();
  const updateImages: ImageUpdater = (updater) => {
    const previous = imageStates.at(-1) ?? [];
    imageStates.push(updater(previous));
  };

  const hook = renderHook(() =>
    useImageUpload({
      updateImages,
      onUploadStart,
    })
  );

  return {
    hook,
    imageStates,
    onUploadStart,
  };
}

beforeEach(() => {
  getDpi.mockResolvedValue(300);
  globalThis.fetch = originalFetch;
  globalThis.Image = MockImage as unknown as typeof globalThis.Image;
});

describe("useImageUpload", () => {
  test("rejects non-image files", async () => {
    const { hook, imageStates, onUploadStart } = renderUpload();

    await act(async () => {
      await hook.result.current.onDrop([
        file("notes.txt", 128, "text/plain"),
      ]);
    });

    expect(hook.result.current.error).toBe("Only image files are allowed.");
    expect(hook.result.current.loading).toBe(false);
    expect(imageStates).toEqual([]);
    expect(onUploadStart).toHaveBeenCalledOnce();
  });

  test("rejects files over 21MB", async () => {
    const { hook, imageStates } = renderUpload();

    await act(async () => {
      await hook.result.current.onDrop([
        file("large.png", 21 * 1024 * 1024 + 1, "image/png"),
      ]);
    });

    expect(hook.result.current.error).toBe("Image must be 21MB or smaller.");
    expect(hook.result.current.loading).toBe(false);
    expect(imageStates).toEqual([]);
  });

  test("handles backend upload errors", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Backend rejected the image" }),
    }) as unknown as typeof globalThis.fetch;
    const { hook, imageStates } = renderUpload();

    await act(async () => {
      await hook.result.current.onDrop([file("photo.png", 512, "image/png")]);
    });

    expect(hook.result.current.error).toBe(
      "Something went wrong while processing the image."
    );
    expect(hook.result.current.loading).toBe(false);
    expect(hook.result.current.previewUrl).toBeNull();
    expect(imageStates).toEqual([]);
  });

  test("adds an uploaded image with dimensions, defaults, and DPI", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ previewUrl: "/processed/preview.webp" }),
    }) as unknown as typeof globalThis.fetch;
    const { hook, imageStates, onUploadStart } = renderUpload();
    const uploadFile = file("photo.png", 512, "image/png");

    await act(async () => {
      await hook.result.current.onDrop([uploadFile]);
    });

    expect(hook.result.current.error).toBeNull();
    expect(hook.result.current.loading).toBe(false);
    expect(hook.result.current.previewUrl).toBe(
      "http://localhost:4000/processed/preview.webp"
    );
    expect(onUploadStart).toHaveBeenCalledOnce();
    expect(getDpi).toHaveBeenCalledWith(uploadFile);
    expect(imageStates.at(-1)).toEqual([
      {
        id: "http://localhost:4000/processed/preview.webp",
        url: "http://localhost:4000/processed/preview.webp",
        x: 400,
        y: 400,
        scaleX: 0.5,
        scaleY: 0.5,
        width: 640,
        height: 480,
        dpi: 300,
      },
    ]);
  });

  test("omits DPI when it cannot be detected", async () => {
    getDpi.mockResolvedValue(null);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ previewUrl: "/processed/preview.webp" }),
    }) as unknown as typeof globalThis.fetch;
    const { hook, imageStates } = renderUpload();

    await act(async () => {
      await hook.result.current.onDrop([file("photo.png", 512, "image/png")]);
    });

    expect(hook.result.current.error).toBeNull();
    expect(imageStates.at(-1)?.[0]).not.toHaveProperty("dpi");
  });
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  globalThis.Image = originalImage;
});
