// src/components/ImageUploader/utils/uploadToCloudinary.test.ts

import { uploadToCloudinary } from "./uploadToCloudinary";
import { afterEach, beforeEach, expect, test, vi, type Mock } from "vitest";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      secure_url: "https://res.cloudinary.com/demo/image/upload/v123/test.png",
    }),
  }) as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

test("posts to Cloudinary and returns secure_url", async () => {
  const blob = new Blob(["hello"], { type: "image/png" });
  const url = await uploadToCloudinary(blob, "frontend_unsigned", "demo");

  expect(url).toBe(
    "https://res.cloudinary.com/demo/image/upload/v123/test.png"
  );

  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  const [calledUrl, opts] = (globalThis.fetch as unknown as Mock).mock.calls[0];

  expect(calledUrl).toMatch(
    "https://api.cloudinary.com/v1_1/demo/image/upload"
  );
  expect(opts.method).toBe("POST");
  expect(opts.body).toBeInstanceOf(FormData);
});

test("throws on !ok", async () => {
  (globalThis.fetch as unknown as Mock).mockResolvedValueOnce({
    ok: false,
  });

  await expect(uploadToCloudinary(new Blob(), "x", "demo")).rejects.toThrow(
    "Cloudinary upload failed"
  );
});
