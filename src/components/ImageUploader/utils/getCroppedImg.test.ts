import { beforeEach, expect, test, vi } from "vitest";
import { getCroppedImg } from "./getCroppedImg";

class MockImage {
  width = 800;
  height = 600;
  crossOrigin: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
    setTimeout(() => this.onload?.(), 0);
  }
}

beforeEach(() => {
  globalThis.Image =
    MockImage as unknown as typeof globalThis.Image;

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(() => "blob:mock-url"),
  });

  const ctx: Partial<CanvasRenderingContext2D> = {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
    clearRect: vi.fn(),
  };

  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: vi.fn(() => ctx as CanvasRenderingContext2D),
  });

  Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
    configurable: true,
    value(callback: BlobCallback) {
      callback(new Blob(["fake"], { type: "image/png" }));
    },
  });
});

test("returns a blob URL string", async () => {
  const result = await getCroppedImg(
    "data:image/png;base64,AAAA",
    { x: 100, y: 50, width: 200, height: 150 },
    { rotation: 45, scaleX: 1, scaleY: 1 }
  );
  expect(result).toBe("blob:mock-url");
});

test("works without transform", async () => {
  const result = await getCroppedImg(
    "data:image/png;base64,AAAA",
    { x: 0, y: 0, width: 100, height: 100 }
  );
  expect(result).toBe("blob:mock-url");
});
