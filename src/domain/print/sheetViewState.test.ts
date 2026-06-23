import { describe, expect, test } from "vitest";
import {
  DEFAULT_SHEET_VIEW_STATE,
  sheetViewStateReducer,
} from "./sheetViewState";

describe("sheetViewStateReducer", () => {
  test("tracks item and asset selection outside the print document", () => {
    const selectedItem = sheetViewStateReducer(DEFAULT_SHEET_VIEW_STATE, {
      type: "selection/select-item",
      itemId: "item-1",
    });

    expect(selectedItem.selectedItemIds).toEqual(["item-1"]);

    const multiSelected = sheetViewStateReducer(selectedItem, {
      type: "selection/select-item",
      itemId: "item-2",
      append: true,
    });

    expect(multiSelected.selectedItemIds).toEqual(["item-1", "item-2"]);

    const selectedAsset = sheetViewStateReducer(multiSelected, {
      type: "selection/select-asset",
      assetId: "asset-1",
    });

    expect(selectedAsset.selectedAssetId).toBe("asset-1");
    expect(selectedAsset.selectedItemIds).toEqual([]);
  });

  test("updates viewport and overlay settings", () => {
    const zoomed = sheetViewStateReducer(DEFAULT_SHEET_VIEW_STATE, {
      type: "viewport/set-zoom",
      zoom: 12,
    });

    expect(zoomed.zoom).toBe(8);

    const panned = sheetViewStateReducer(zoomed, {
      type: "viewport/set-pan",
      pan: {
        x: 24,
        y: -12,
      },
    });

    expect(panned.pan).toEqual({ x: 24, y: -12 });

    const withoutCutlines = sheetViewStateReducer(panned, {
      type: "overlay/set-cutlines",
      visible: false,
    });

    expect(withoutCutlines.showCutlines).toBe(false);
  });

  test("clears selection", () => {
    const selected = sheetViewStateReducer(DEFAULT_SHEET_VIEW_STATE, {
      type: "selection/select-items",
      itemIds: ["item-1", "item-1", "item-2"],
    });

    expect(selected.selectedItemIds).toEqual(["item-1", "item-2"]);

    const cleared = sheetViewStateReducer(selected, {
      type: "selection/clear",
    });

    expect(cleared.selectedItemIds).toEqual([]);
    expect(cleared.selectedAssetId).toBeUndefined();
  });
});
