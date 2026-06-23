import type { ProductionProfile, SheetSize, SheetSizeId } from "./types";
import { STICKER_SHEET_MVP_PROFILE } from "./productionProfiles";

export interface PixelSize {
  widthPx: number;
  heightPx: number;
}

export function inchesToPixels(inches: number, dpi: number): number {
  return inches * dpi;
}

export function pixelsToInches(pixels: number, dpi: number): number {
  return pixels / dpi;
}

export function megabytesToBytes(megabytes: number): number {
  return megabytes * 1024 * 1024;
}

export function sheetSizeToPixels(
  sheetSize: Pick<SheetSize, "widthIn" | "heightIn">,
  dpi = STICKER_SHEET_MVP_PROFILE.requiredDpi
): PixelSize {
  return {
    widthPx: Math.round(inchesToPixels(sheetSize.widthIn, dpi)),
    heightPx: Math.round(inchesToPixels(sheetSize.heightIn, dpi)),
  };
}

export function findSheetSize(
  sheetSizeId: SheetSizeId,
  profile: ProductionProfile = STICKER_SHEET_MVP_PROFILE
): SheetSize {
  const sheetSize = profile.sheetSizes.find((size) => size.id === sheetSizeId);

  if (!sheetSize) {
    throw new Error(`Unknown sheet size: ${sheetSizeId}`);
  }

  return sheetSize;
}

export function getProfileUploadLimitBytes(
  profile: ProductionProfile = STICKER_SHEET_MVP_PROFILE
): number {
  return megabytesToBytes(profile.uploadRules.maxUploadSizeMb);
}
