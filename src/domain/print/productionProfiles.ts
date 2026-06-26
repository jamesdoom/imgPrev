import type { ProductionProfile, SheetSize } from "./types";

export const DEFAULT_PRINT_DPI = 300;

export const BASELINE_SHEET_SIZES: readonly SheetSize[] = [
  {
    id: "11x17",
    label: '11" x 17"',
    widthIn: 11,
    heightIn: 17,
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
    stickerSpacingIn: 1,
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
  pricing: {
    pricePerSheetCents: 750,
    minimumOrderCents: 1000,
    freeShippingThresholdCents: 2500,
  },
  defaultBackground: {
    type: "transparent",
  },
};
