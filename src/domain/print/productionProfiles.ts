import type { ProductionProfile, SheetSize } from "./types";

export const DEFAULT_PRINT_DPI = 300;

export const BASELINE_SHEET_SIZES: readonly SheetSize[] = [
  {
    id: "4x6",
    label: '4" x 6"',
    widthIn: 4,
    heightIn: 6,
  },
  {
    id: "6x4",
    label: '6" x 4"',
    widthIn: 6,
    heightIn: 4,
  },
  {
    id: "8.5x11",
    label: '8.5" x 11"',
    widthIn: 8.5,
    heightIn: 11,
  },
  {
    id: "11x8.5",
    label: '11" x 8.5"',
    widthIn: 11,
    heightIn: 8.5,
  },
];

export const STICKER_SHEET_MVP_PROFILE: ProductionProfile = {
  id: "sticker-sheet-mvp",
  name: "Sticker Sheet MVP",
  unit: "in",
  requiredDpi: DEFAULT_PRINT_DPI,
  warnBelowDpi: DEFAULT_PRINT_DPI,
  rejectBelowDpi: 150,
  sheetSizes: BASELINE_SHEET_SIZES,
  printRules: {
    sheetEdgeMarginIn: 0.25,
    stickerSpacingIn: 0.25,
    minStickerSizeIn: 0.75,
    bleedIn: 0.125,
    safeMarginIn: 0.125,
  },
  uploadRules: {
    acceptedExtensions: ["png", "jpg", "jpeg", "webp", "svg", "pdf"],
    acceptedMimeTypes: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/svg+xml",
      "application/pdf",
    ],
    maxUploadSizeMb: 25,
  },
  exportBundle: {
    primary: "pdf",
    proof: "png",
    project: "json",
    retainOriginalAssets: true,
  },
  cutlines: {
    required: true,
    defaultMode: "auto-contour",
    storeVectorPaths: true,
  },
  defaultBackground: {
    type: "transparent",
  },
};
