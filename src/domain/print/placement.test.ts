import { describe, expect, test } from "vitest";
import { createSheetDocument } from "./sheetDocument";
import { autoArrangeSheetItems, createSheetItemFromAsset } from "./placement";
import type { SheetAsset } from "./types";

describe("createSheetItemFromAsset", () => {
  test("uses asset pixels at 300 DPI for the initial print size", () => {
    const document = createSheetDocument({
      id: "project-1",
      sheetSizeId: "11x17",
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
      sheetSizeId: "11x17",
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

    expect(item.widthIn).toBe(10);
    expect(item.heightIn).toBe(10);
  });

  test("uses a practical fallback size for assets without dimensions", () => {
    const document = createSheetDocument({
      id: "project-1",
      sheetSizeId: "11x17",
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

describe("autoArrangeSheetItems", () => {
  test("packs uploaded assets from left to right across rows", () => {
    const document = {
      ...createSheetDocument({
        id: "project-1",
        sheetSizeId: "11x17",
      }),
      assets: [
        {
          id: "asset-1",
          sourceUrl: "/uploads/one.png",
          fileName: "one.png",
          fileType: "image/png",
          widthPx: 300,
          heightPx: 300,
        },
        {
          id: "asset-2",
          sourceUrl: "/uploads/two.png",
          fileName: "two.png",
          fileType: "image/png",
          widthPx: 300,
          heightPx: 300,
        },
        {
          id: "asset-3",
          sourceUrl: "/uploads/three.png",
          fileName: "three.png",
          fileType: "image/png",
          widthPx: 300,
          heightPx: 300,
        },
      ],
    };

    const result = autoArrangeSheetItems({
      document,
      idFactory: (_asset, index) => `item-${index + 1}`,
    });

    expect(result.unplacedAssetIds).toEqual([]);
    expect(result.items).toMatchObject([
      { id: "item-1", assetId: "asset-1", xIn: 0.25, yIn: 0.25 },
      { id: "item-2", assetId: "asset-2", xIn: 2.25, yIn: 0.25 },
      { id: "item-3", assetId: "asset-3", xIn: 4.25, yIn: 0.25 },
    ]);
  });

  test("reports assets that do not fit on the sheet", () => {
    const document = {
      ...createSheetDocument({
        id: "project-1",
        sheetSizeId: "11x17",
      }),
      assets: Array.from({ length: 12 }, (_, index): SheetAsset => ({
        id: `asset-${index + 1}`,
        sourceUrl: `/uploads/${index + 1}.png`,
        fileName: `${index + 1}.png`,
        fileType: "image/png",
        widthPx: 900,
        heightPx: 600,
      })),
    };

    const result = autoArrangeSheetItems({
      document,
      idFactory: (_asset, index) => `item-${index + 1}`,
    });

    expect(result.items.length).toBeLessThan(document.assets.length);
    expect(result.unplacedAssetIds.length).toBeGreaterThan(0);
  });
});
