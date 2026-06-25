export type PrintUnit = "in";

export type SheetSizeId = "4x6" | "6x4" | "8.5x11" | "11x8.5";

export type SheetBackground =
  | { type: "transparent" }
  | { type: "solid"; color: string };

export type CutlineGenerationMode = "auto-contour" | "manual";

export interface SheetSize {
  id: SheetSizeId;
  label: string;
  widthIn: number;
  heightIn: number;
}

export interface PrintRuleSet {
  sheetEdgeMarginIn: number;
  stickerSpacingIn: number;
  minStickerSizeIn: number;
  bleedIn: number;
  safeMarginIn: number;
}

export interface UploadRuleSet {
  acceptedExtensions: readonly string[];
  acceptedMimeTypes: readonly string[];
  maxUploadSizeMb: number;
}

export interface ExportBundleRuleSet {
  primary: "pdf";
  proof: "png";
  project: "json";
  retainOriginalAssets: boolean;
}

export interface CutlineRuleSet {
  required: boolean;
  defaultMode: CutlineGenerationMode;
  storeVectorPaths: boolean;
}

export interface ProductionProfile {
  id: string;
  name: string;
  unit: PrintUnit;
  requiredDpi: number;
  warnBelowDpi: number;
  rejectBelowDpi?: number;
  sheetSizes: readonly SheetSize[];
  printRules: PrintRuleSet;
  uploadRules: UploadRuleSet;
  exportBundle: ExportBundleRuleSet;
  cutlines: CutlineRuleSet;
  defaultBackground: SheetBackground;
}

export interface SheetDocument {
  id: string;
  version: 1;
  productionProfileId: string;
  sheet: SheetDocumentSheet;
  assets: SheetAsset[];
  items: SheetItem[];
  settings: SheetDocumentSettings;
  createdAt?: string;
  updatedAt?: string;
}

export interface SheetDocumentSheet {
  sizeId: SheetSizeId;
  widthIn: number;
  heightIn: number;
  dpi: number;
}

export interface SheetDocumentSettings {
  background: SheetBackground;
}

export interface SheetAsset {
  id: string;
  sourceUrl: string;
  previewUrl?: string;
  fileName: string;
  fileType: string;
  widthPx?: number;
  heightPx?: number;
  dpi?: number;
  hasTransparency?: boolean;
  uploadedAt?: string;
}

export interface SheetItem {
  id: string;
  assetId: string;
  name?: string;
  xIn: number;
  yIn: number;
  widthIn: number;
  heightIn: number;
  rotationDeg: number;
  scaleX: number;
  scaleY: number;
  locked?: boolean;
  cutline?: VectorCutline;
}

export interface SheetViewState {
  selectedItemIds: string[];
  selectedAssetId?: string;
  zoom: number;
  pan: {
    x: number;
    y: number;
  };
  showGrid: boolean;
  showBleed: boolean;
  showSafeArea: boolean;
  showCutlines: boolean;
}

export interface VectorCutline {
  mode: CutlineGenerationMode;
  pathData: string;
  bleedIn?: number;
  safeMarginIn?: number;
}

export type PreflightSeverity = "warning" | "error";

export interface PreflightIssue {
  id: string;
  severity: PreflightSeverity;
  code:
    | "dpi-below-warning"
    | "dpi-below-rejection"
    | "item-too-small"
    | "item-outside-safe-area"
    | "item-spacing-too-tight"
    | "unsupported-production-asset"
    | "unsupported-upload"
    | "upload-too-large";
  message: string;
  itemId?: string;
  assetId?: string;
}
