import { describe, expect, test } from "vitest";
import { runPreflight, getItemBounds } from "./preflight";
import { createSheetDocument } from "./sheetDocument";
import { sheetDocumentReducer } from "./sheetDocumentReducer";
import type { SheetAsset, SheetDocument, SheetItem } from "./types";

const asset: SheetAsset = {
  id: "asset-1",
  sourceUrl: "/uploads/decal.png",
  fileName: "decal.png",
  fileType: "image/png",
  widthPx: 900,
  heightPx: 900,
  dpi: 300,
};

const item: SheetItem = {
  id: "item-1",
  assetId: "asset-1",
  xIn: 0.5,
  yIn: 0.5,
  widthIn: 1,
  heightIn: 1,
  rotationDeg: 0,
  scaleX: 1,
  scaleY: 1,
};

function addAsset(document: SheetDocument, nextAsset = asset): SheetDocument {
  return sheetDocumentReducer(document, {
    type: "asset/add",
    asset: nextAsset,
  });
}

function addItem(document: SheetDocument, nextItem = item): SheetDocument {
  return sheetDocumentReducer(document, {
    type: "item/place",
    item: nextItem,
  });
}

describe("runPreflight", () => {
  test("returns no issues for a valid placed sticker", () => {
    const document = addItem(
      addAsset(createSheetDocument({ id: "project-1", sheetSizeId: "11x17" }))
    );

    expect(runPreflight(document)).toEqual([]);
  });

  test("warns when placed artwork is below recommended effective DPI", () => {
    const document = addItem(
      addAsset(
        createSheetDocument({ id: "project-1", sheetSizeId: "11x17" }),
        {
          ...asset,
          widthPx: 240,
          heightPx: 240,
          dpi: 72,
        }
      )
    );

    expect(runPreflight(document)).toEqual([
      expect.objectContaining({
        severity: "warning",
        code: "dpi-below-warning",
        assetId: "asset-1",
      }),
    ]);
  });

  test("errors when placed artwork is below rejection effective DPI", () => {
    const document = addItem(
      addAsset(
        createSheetDocument({ id: "project-1", sheetSizeId: "11x17" }),
        {
          ...asset,
          widthPx: 120,
          heightPx: 120,
          dpi: 300,
        }
      )
    );

    expect(runPreflight(document)).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "dpi-below-rejection",
        assetId: "asset-1",
      }),
    ]);
  });

  test("does not apply raster DPI limits to SVG artwork", () => {
    const document = addItem(
      addAsset(
        createSheetDocument({ id: "project-1", sheetSizeId: "11x17" }),
        {
          ...asset,
          fileName: "vector-artwork.svg",
          fileType: "application/octet-stream",
          widthPx: 72,
          heightPx: 72,
          dpi: 72,
        }
      )
    );

    expect(runPreflight(document)).toEqual([]);
  });

  test("uses placed size instead of embedded DPI for 905 by 720 artwork", () => {
    const arizonaAsset: SheetAsset = {
      ...asset,
      fileName: "arizona_diamondbacks.png",
      widthPx: 905,
      heightPx: 720,
      dpi: 72,
    };
    const fiveInchItem: SheetItem = {
      ...item,
      widthIn: 5,
      heightIn: (720 / 905) * 5,
    };
    const sixPointOneInchItem: SheetItem = {
      ...item,
      widthIn: 6.1,
      heightIn: (720 / 905) * 6.1,
    };
    const baseDocument = addAsset(
      createSheetDocument({ id: "project-1", sheetSizeId: "11x17" }),
      arizonaAsset
    );

    expect(runPreflight(addItem(baseDocument, fiveInchItem))).toEqual([
      expect.objectContaining({
        severity: "warning",
        code: "dpi-below-warning",
        message: expect.stringContaining("181 effective DPI"),
      }),
    ]);
    expect(runPreflight(addItem(baseDocument, sixPointOneInchItem))).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "dpi-below-rejection",
        message: expect.stringContaining("148 effective DPI"),
      }),
    ]);
  });

  test("errors when a PDF asset is used for production export", () => {
    const document = addAsset(
      createSheetDocument({ id: "project-1", sheetSizeId: "11x17" }),
      {
        ...asset,
        fileName: "vector.pdf",
        fileType: "application/pdf",
        dpi: undefined,
      }
    );

    expect(runPreflight(document)).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "unsupported-production-asset",
        assetId: "asset-1",
      }),
    ]);
  });

  test("errors when a sticker is smaller than the minimum print size", () => {
    const document = addItem(
      addAsset(createSheetDocument({ id: "project-1", sheetSizeId: "11x17" })),
      {
        ...item,
        widthIn: 0.7,
      }
    );

    expect(runPreflight(document)).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "item-too-small",
        itemId: "item-1",
      }),
    ]);
  });

  test("errors when a sticker crosses the sheet edge margin", () => {
    const document = addItem(
      addAsset(createSheetDocument({ id: "project-1", sheetSizeId: "11x17" })),
      {
        ...item,
        xIn: 0.1,
      }
    );

    expect(runPreflight(document)).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "item-outside-safe-area",
        itemId: "item-1",
      }),
    ]);
  });

  test("errors when two stickers are too close together", () => {
    const documentWithFirstItem = addItem(
      addAsset(createSheetDocument({ id: "project-1", sheetSizeId: "11x17" }))
    );
    const document = sheetDocumentReducer(documentWithFirstItem, {
      type: "item/place",
      item: {
        ...item,
        id: "item-2",
        xIn: 1.1,
      },
    });

    expect(runPreflight(document)).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "item-spacing-too-tight",
        itemId: "item-1",
      }),
    ]);
  });

  test("uses rotated bounds for edge-margin checks", () => {
    const bounds = getItemBounds({
      ...item,
      xIn: 0.5,
      yIn: 0.5,
      widthIn: 1,
      heightIn: 1,
      rotationDeg: 45,
    });

    expect(bounds.minX).toBeCloseTo(0.293, 3);
    expect(bounds.maxX).toBeCloseTo(1.707, 3);
  });

  test("keeps rotated bounds centered on the sticker", () => {
    const bounds = getItemBounds({
      ...item,
      xIn: 2,
      yIn: 3,
      widthIn: 2,
      heightIn: 1,
      rotationDeg: 90,
    });

    expect((bounds.minX + bounds.maxX) / 2).toBeCloseTo(3);
    expect((bounds.minY + bounds.maxY) / 2).toBeCloseTo(3.5);
  });
});
