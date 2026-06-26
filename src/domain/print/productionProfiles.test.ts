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
        stickerSpacingIn: 1,
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
      pricing: {
        pricePerSheetCents: 750,
        minimumOrderCents: 1000,
        freeShippingThresholdCents: 2500,
      },
    });
  });

  test("converts the active 11x17 sheet to the expected 300 DPI canvas", () => {
    const sheetSize = findSheetSize("11x17");

    expect(sheetSizeToPixels(sheetSize)).toEqual({
      widthPx: 3300,
      heightPx: 5100,
    });
  });

  test("converts print rule distances to pixels at 300 DPI", () => {
    const { printRules, requiredDpi } = STICKER_SHEET_MVP_PROFILE;

    expect(inchesToPixels(printRules.sheetEdgeMarginIn, requiredDpi)).toBe(75);
    expect(inchesToPixels(printRules.stickerSpacingIn, requiredDpi)).toBe(300);
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
