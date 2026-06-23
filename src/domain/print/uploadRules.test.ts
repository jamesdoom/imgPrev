import { describe, expect, test } from "vitest";
import {
  getFileExtension,
  isAcceptedUploadType,
  validateUploadCandidate,
} from "./uploadRules";

describe("upload rules", () => {
  test.each([
    ["decal.PNG", "image/png"],
    ["decal.jpg", "image/jpeg"],
    ["decal.jpeg", "image/jpeg"],
    ["decal.webp", "image/webp"],
    ["decal.svg", "image/svg+xml"],
    ["decal.pdf", "application/pdf"],
  ])("accepts %s uploads", (name, type) => {
    expect(isAcceptedUploadType({ name, type })).toBe(true);
  });

  test("falls back to the file extension when browser MIME type is missing", () => {
    expect(isAcceptedUploadType({ name: "vector.SVG", type: "" })).toBe(true);
    expect(getFileExtension("vector.SVG")).toBe("svg");
  });

  test("rejects unsupported uploads", () => {
    expect(
      validateUploadCandidate({
        name: "design.ai",
        type: "application/postscript",
        size: 1024,
      })
    ).toEqual([
      {
        id: "design.ai:unsupported-upload",
        severity: "error",
        code: "unsupported-upload",
        message: "design.ai is not a supported upload type.",
      },
    ]);
  });

  test("rejects files above the MVP upload limit", () => {
    expect(
      validateUploadCandidate({
        name: "large.png",
        type: "image/png",
        size: 26 * 1024 * 1024,
      })
    ).toEqual([
      {
        id: "large.png:upload-too-large",
        severity: "error",
        code: "upload-too-large",
        message: "large.png exceeds the 25 MB upload limit.",
      },
    ]);
  });
});
