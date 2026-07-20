import { sheetSizeToPixels } from "./measurements";
import { STICKER_SHEET_MVP_PROFILE } from "./productionProfiles";
import type {
  PreflightIssue,
  ProductionProfile,
  SheetAsset,
  SheetDocument,
} from "./types";

export interface ExportBundleManifest {
  version: 1;
  exportedAt: string;
  productionProfile: {
    id: string;
    name: string;
    requiredDpi: number;
  };
  files: {
    projectJson: "project.json";
    proofPng: "preview.png";
    printPdf: "print.pdf";
    assetsDirectory: "assets/";
  };
  printCanvas: {
    widthPx: number;
    heightPx: number;
    dpi: number;
    sheetCount: number;
  };
  customer: {
    company: string;
    email: string;
    name: string;
    note: string;
  };
  document: SheetDocument;
  assets: ExportBundleAsset[];
  preflight: {
    errorCount: number;
    warningCount: number;
    issues: PreflightIssue[];
  };
}

export interface ExportBundleAsset {
  id: string;
  fileName: string;
  fileType: string;
  widthPx?: number;
  heightPx?: number;
  dpi?: number;
  hasTransparency?: boolean;
}

export interface ExportBundleCustomer {
  company?: string;
  email?: string;
  name?: string;
  note?: string;
}

export function buildExportBundleManifest({
  customer,
  document,
  exportedAt,
  customerNote = "",
  preflightIssues,
  profile = STICKER_SHEET_MVP_PROFILE,
}: {
  customer?: ExportBundleCustomer;
  document: SheetDocument;
  exportedAt: string;
  customerNote?: string;
  preflightIssues: PreflightIssue[];
  profile?: ProductionProfile;
}): ExportBundleManifest {
  const printCanvas = sheetSizeToPixels(document.sheet, document.sheet.dpi);
  const errorCount = preflightIssues.filter(
    (issue) => issue.severity === "error"
  ).length;

  return {
    version: 1,
    exportedAt,
    productionProfile: {
      id: profile.id,
      name: profile.name,
      requiredDpi: profile.requiredDpi,
    },
    files: {
      projectJson: "project.json",
      proofPng: "preview.png",
      printPdf: "print.pdf",
      assetsDirectory: "assets/",
    },
    printCanvas: {
      widthPx: printCanvas.widthPx,
      heightPx: printCanvas.heightPx,
      dpi: document.sheet.dpi,
      sheetCount: document.sheets?.length ?? 1,
    },
    customer: {
      company: customer?.company?.trim() ?? "",
      email: customer?.email?.trim() ?? "",
      name: customer?.name?.trim() ?? "",
      note: customer?.note?.trim() ?? customerNote.trim(),
    },
    document,
    assets: document.assets.map(toExportBundleAsset),
    preflight: {
      errorCount,
      warningCount: preflightIssues.length - errorCount,
      issues: preflightIssues,
    },
  };
}

export function canExportProductionBundle(
  preflightIssues: PreflightIssue[]
): boolean {
  return preflightIssues.every((issue) => issue.severity !== "error");
}

function toExportBundleAsset(asset: SheetAsset): ExportBundleAsset {
  return {
    id: asset.id,
    fileName: asset.fileName,
    fileType: asset.fileType,
    widthPx: asset.widthPx,
    heightPx: asset.heightPx,
    dpi: asset.dpi,
    hasTransparency: asset.hasTransparency,
  };
}
