import { describe, expect, test } from "vitest";
import {
  findSheetSize,
  getProfileUploadLimitBytes,
  inchesToPixels,
  sheetSizeToPixels,
} from "./measurements";
import { STICKER_SHEET_MVP_PROFILE } from "./productionProfiles";

describe("sticker sheet production profile", () => {
  test("defines the baseline print configuration", () => {
    expect(STICKER_SHEET_MVP_PROFILE).toMatchObject({
      unit: "in",
      requiredDpi: 300,
      warnBelowDpi: 300,
      rejectBelowDpi: 150,
      printRules: {
        sheetEdgeMarginIn: 0.25,
        stickerSpacingIn: 0.25,
        minStickerSizeIn: 0.75,
        bleedIn: 0.125,
        safeMarginIn: 0.125,
      },
      defaultBackground: {
        type: "transparent",
      },
      cutlines: {
        required: true,
        defaultMode: "auto-contour",
        storeVectorPaths: true,
      },
    });
  });

  test.each([
    ["4x6", 1200, 1800],
    ["6x4", 1800, 1200],
    ["8.5x11", 2550, 3300],
    ["11x8.5", 3300, 2550],
  ] as const)(
    "converts %s inches to the expected 300 DPI canvas",
    (sheetSizeId, widthPx, heightPx) => {
      const sheetSize = findSheetSize(sheetSizeId);

      expect(sheetSizeToPixels(sheetSize)).toEqual({ widthPx, heightPx });
    }
  );

  test("converts print rule distances to pixels at 300 DPI", () => {
    const { printRules, requiredDpi } = STICKER_SHEET_MVP_PROFILE;

    expect(inchesToPixels(printRules.sheetEdgeMarginIn, requiredDpi)).toBe(75);
    expect(inchesToPixels(printRules.stickerSpacingIn, requiredDpi)).toBe(75);
    expect(inchesToPixels(printRules.minStickerSizeIn, requiredDpi)).toBe(225);
    expect(inchesToPixels(printRules.bleedIn, requiredDpi)).toBe(37.5);
    expect(inchesToPixels(printRules.safeMarginIn, requiredDpi)).toBe(37.5);
  });

  test("uses the MVP upload and export rules", () => {
    expect(STICKER_SHEET_MVP_PROFILE.uploadRules.acceptedExtensions).toEqual([
      "png",
      "jpg",
      "jpeg",
      "webp",
      "svg",
      "pdf",
    ]);
    expect(getProfileUploadLimitBytes()).toBe(25 * 1024 * 1024);
    expect(STICKER_SHEET_MVP_PROFILE.exportBundle).toEqual({
      primary: "pdf",
      proof: "png",
      project: "json",
      retainOriginalAssets: true,
    });
  });
});
