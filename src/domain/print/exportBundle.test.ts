import { describe, expect, test } from "vitest";
import {
  buildExportBundleManifest,
  canExportProductionBundle,
} from "./exportBundle";
import { createSheetDocument } from "./sheetDocument";
import type { PreflightIssue } from "./types";

const warning: PreflightIssue = {
  id: "asset-1:dpi-below-warning",
  severity: "warning",
  code: "dpi-below-warning",
  assetId: "asset-1",
  message: "Asset is below recommended DPI.",
};

const error: PreflightIssue = {
  id: "item-1:item-too-small",
  severity: "error",
  code: "item-too-small",
  itemId: "item-1",
  message: "Sticker is too small.",
};

describe("buildExportBundleManifest", () => {
  test("creates the MVP export bundle contract", () => {
    const document = {
      ...createSheetDocument({
        id: "project-1",
        sheetSizeId: "8.5x11",
      }),
      assets: [
        {
          id: "asset-1",
          sourceUrl: "blob:local",
          fileName: "decal.png",
          fileType: "image/png",
          widthPx: 900,
          heightPx: 600,
          dpi: 300,
          hasTransparency: true,
        },
      ],
    };

    expect(
      buildExportBundleManifest({
        document,
        exportedAt: "2026-06-23T12:00:00.000Z",
        customerNote: " Keep decals grouped by design. ",
        preflightIssues: [warning],
      })
    ).toMatchObject({
      version: 1,
      exportedAt: "2026-06-23T12:00:00.000Z",
      productionProfile: {
        id: "sticker-sheet-mvp",
        requiredDpi: 300,
      },
      files: {
        projectJson: "project.json",
        proofPng: "preview.png",
        printPdf: "print.pdf",
        assetsDirectory: "assets/",
      },
      printCanvas: {
        widthPx: 2550,
        heightPx: 3300,
        dpi: 300,
      },
      customer: {
        note: "Keep decals grouped by design.",
      },
      assets: [
        {
          id: "asset-1",
          fileName: "decal.png",
          fileType: "image/png",
          widthPx: 900,
          heightPx: 600,
          dpi: 300,
          hasTransparency: true,
        },
      ],
      preflight: {
        errorCount: 0,
        warningCount: 1,
      },
    });
  });
});

describe("canExportProductionBundle", () => {
  test("allows export when there are no preflight errors", () => {
    expect(canExportProductionBundle([])).toBe(true);
    expect(canExportProductionBundle([warning])).toBe(true);
  });

  test("blocks production export when preflight has errors", () => {
    expect(canExportProductionBundle([warning, error])).toBe(false);
  });
});
