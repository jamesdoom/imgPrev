import { describe, expect, test } from "vitest";
import { createSheetDocument } from "./sheetDocument";
import { createSheetItemFromAsset } from "./placement";
import type { SheetAsset } from "./types";

describe("createSheetItemFromAsset", () => {
  test("uses asset pixels at 300 DPI for the initial print size", () => {
    const document = createSheetDocument({
      id: "project-1",
      sheetSizeId: "4x6",
    });
    const asset: SheetAsset = {
      id: "asset-1",
      sourceUrl: "/uploads/decal.png",
      fileName: "decal.png",
      fileType: "image/png",
      widthPx: 900,
      heightPx: 600,
    };

    expect(
      createSheetItemFromAsset({
        id: "item-1",
        asset,
        document,
      })
    ).toMatchObject({
      id: "item-1",
      assetId: "asset-1",
      xIn: 0.25,
      yIn: 0.25,
      widthIn: 3,
      heightIn: 2,
    });
  });

  test("fits oversized assets inside the printable sheet area", () => {
    const document = createSheetDocument({
      id: "project-1",
      sheetSizeId: "4x6",
    });
    const asset: SheetAsset = {
      id: "asset-1",
      sourceUrl: "/uploads/poster.png",
      fileName: "poster.png",
      fileType: "image/png",
      widthPx: 3000,
      heightPx: 3000,
      dpi: 300,
    };

    const item = createSheetItemFromAsset({
      id: "item-1",
      asset,
      document,
    });

    expect(item.widthIn).toBe(3.5);
    expect(item.heightIn).toBe(3.5);
  });

  test("uses a practical fallback size for assets without dimensions", () => {
    const document = createSheetDocument({
      id: "project-1",
      sheetSizeId: "8.5x11",
    });
    const asset: SheetAsset = {
      id: "asset-1",
      sourceUrl: "/uploads/vector.pdf",
      fileName: "vector.pdf",
      fileType: "application/pdf",
    };

    expect(
      createSheetItemFromAsset({
        id: "item-1",
        asset,
        document,
      })
    ).toMatchObject({
      widthIn: 1.5,
      heightIn: 1.5,
    });
  });
});
