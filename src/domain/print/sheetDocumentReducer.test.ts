import { describe, expect, test } from "vitest";
import { createSheetDocument } from "./sheetDocument";
import { sheetDocumentReducer } from "./sheetDocumentReducer";
import type { SheetAsset, SheetItem } from "./types";

const asset: SheetAsset = {
  id: "asset-1",
  sourceUrl: "/uploads/decal.png",
  fileName: "decal.png",
  fileType: "image/png",
  widthPx: 900,
  heightPx: 600,
  dpi: 300,
  hasTransparency: true,
};

const item: SheetItem = {
  id: "item-1",
  assetId: "asset-1",
  name: "Main decal",
  xIn: 0.5,
  yIn: 0.5,
  widthIn: 2,
  heightIn: 1.5,
  rotationDeg: 0,
  scaleX: 1,
  scaleY: 1,
};

function documentWithAsset() {
  return sheetDocumentReducer(
    createSheetDocument({ id: "project-1", sheetSizeId: "11x17" }),
    { type: "asset/add", asset }
  );
}

describe("sheetDocumentReducer", () => {
  test("adds, updates, and removes assets", () => {
    const initialDocument = createSheetDocument({
      id: "project-1",
      sheetSizeId: "11x17",
    });

    const withAsset = sheetDocumentReducer(initialDocument, {
      type: "asset/add",
      asset,
      now: "2026-06-23T12:01:00.000Z",
    });

    expect(withAsset.assets).toEqual([asset]);
    expect(withAsset.updatedAt).toBe("2026-06-23T12:01:00.000Z");

    const updated = sheetDocumentReducer(withAsset, {
      type: "asset/update",
      assetId: "asset-1",
      patch: {
        dpi: 240,
      },
    });

    expect(updated.assets[0]).toMatchObject({ dpi: 240 });

    const removed = sheetDocumentReducer(updated, {
      type: "asset/remove",
      assetId: "asset-1",
    });

    expect(removed.assets).toEqual([]);
  });

  test("places, updates, duplicates, and removes sticker items", () => {
    const withAsset = documentWithAsset();

    const withItem = sheetDocumentReducer(withAsset, {
      type: "item/place",
      item,
    });

    expect(withItem.items).toEqual([item]);

    const transformed = sheetDocumentReducer(withItem, {
      type: "item/update",
      itemId: "item-1",
      patch: {
        xIn: 1,
        yIn: 1.25,
        rotationDeg: 45,
      },
    });

    expect(transformed.items[0]).toMatchObject({
      xIn: 1,
      yIn: 1.25,
      rotationDeg: 45,
    });
    expect(withItem.items[0]).toEqual(item);

    const duplicated = sheetDocumentReducer(transformed, {
      type: "item/duplicate",
      itemId: "item-1",
      newItemId: "item-2",
      offsetIn: {
        x: 0.5,
        y: 0.25,
      },
    });

    expect(duplicated.items).toHaveLength(2);
    expect(duplicated.items[1]).toMatchObject({
      id: "item-2",
      assetId: "asset-1",
      xIn: 1.5,
      yIn: 1.5,
    });

    const removed = sheetDocumentReducer(duplicated, {
      type: "item/remove",
      itemId: "item-1",
    });

    expect(removed.items.map((placedItem) => placedItem.id)).toEqual(["item-2"]);
  });

  test("replaces all sticker items in one document update", () => {
    const withItem = sheetDocumentReducer(documentWithAsset(), {
      type: "item/place",
      item,
    });
    const arrangedItem: SheetItem = {
      ...item,
      id: "item-arranged",
      xIn: 1,
      yIn: 1,
    };

    const arranged = sheetDocumentReducer(withItem, {
      type: "items/replace",
      items: [arrangedItem],
      now: "2026-06-25T12:00:00.000Z",
    });

    expect(arranged.items).toEqual([arrangedItem]);
    expect(arranged.updatedAt).toBe("2026-06-25T12:00:00.000Z");
  });

  test("places multiple sticker items in one document update", () => {
    const secondItem: SheetItem = {
      ...item,
      id: "item-2",
      xIn: 0.75,
      yIn: 0.75,
    };

    const withItems = sheetDocumentReducer(documentWithAsset(), {
      type: "items/place",
      items: [item, secondItem],
      now: "2026-06-25T12:30:00.000Z",
    });

    expect(withItems.items).toEqual([item, secondItem]);
    expect(withItems.updatedAt).toBe("2026-06-25T12:30:00.000Z");
  });

  test("rejects replacement items for missing assets", () => {
    expect(() =>
      sheetDocumentReducer(documentWithAsset(), {
        type: "items/replace",
        items: [
          {
            ...item,
            assetId: "missing-asset",
          },
        ],
      })
    ).toThrow("Cannot replace items with missing asset: missing-asset");
  });

  test("rejects batch placed items for missing assets", () => {
    expect(() =>
      sheetDocumentReducer(documentWithAsset(), {
        type: "items/place",
        items: [
          {
            ...item,
            assetId: "missing-asset",
          },
        ],
      })
    ).toThrow("Cannot place items with missing asset: missing-asset");
  });

  test("removing an asset removes its placed sticker items", () => {
    const withItem = sheetDocumentReducer(documentWithAsset(), {
      type: "item/place",
      item,
    });

    const withoutAsset = sheetDocumentReducer(withItem, {
      type: "asset/remove",
      assetId: "asset-1",
    });

    expect(withoutAsset.assets).toEqual([]);
    expect(withoutAsset.items).toEqual([]);
  });

  test("rejects placing an item for a missing asset", () => {
    const document = createSheetDocument({
      id: "project-1",
      sheetSizeId: "11x17",
    });

    expect(() =>
      sheetDocumentReducer(document, {
        type: "item/place",
        item,
      })
    ).toThrow("Cannot place item for missing asset: asset-1");
  });

  test("updates sheet size and background settings", () => {
    const document = createSheetDocument({
      id: "project-1",
      sheetSizeId: "11x17",
    });

    const resized = sheetDocumentReducer(document, {
      type: "sheet/set-size",
      sheetSizeId: "11x17",
    });

    expect(resized.sheet).toEqual({
      sizeId: "11x17",
      widthIn: 11,
      heightIn: 17,
      dpi: 300,
    });

    const withBackground = sheetDocumentReducer(resized, {
      type: "settings/set-background",
      background: {
        type: "solid",
        color: "#ffffff",
      },
    });

    expect(withBackground.settings.background).toEqual({
      type: "solid",
      color: "#ffffff",
    });
  });
});
