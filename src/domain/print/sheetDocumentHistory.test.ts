import { describe, expect, test } from "vitest";
import { createSheetDocument } from "./sheetDocument";
import {
  createSheetDocumentHistory,
  sheetDocumentHistoryReducer,
} from "./sheetDocumentHistory";
import type { SheetAsset } from "./types";

const asset: SheetAsset = {
  id: "asset-1",
  sourceUrl: "/uploads/decal.png",
  fileName: "decal.png",
  fileType: "image/png",
};

describe("sheetDocumentHistoryReducer", () => {
  test("tracks undo and redo over full sheet documents", () => {
    const document = createSheetDocument({
      id: "project-1",
      sheetSizeId: "11x17",
    });
    const history = createSheetDocumentHistory(document);

    const withAsset = sheetDocumentHistoryReducer(history, {
      type: "asset/add",
      asset,
    });
    const withBackground = sheetDocumentHistoryReducer(withAsset, {
      type: "settings/set-background",
      background: {
        type: "solid",
        color: "#ffffff",
      },
    });

    expect(withBackground.present.assets).toEqual([asset]);
    expect(withBackground.present.settings.background).toEqual({
      type: "solid",
      color: "#ffffff",
    });
    expect(withBackground.past).toHaveLength(2);
    expect(withBackground.future).toHaveLength(0);

    const undone = sheetDocumentHistoryReducer(withBackground, {
      type: "history/undo",
    });

    expect(undone.present.settings.background).toEqual({
      type: "transparent",
    });
    expect(undone.present.assets).toEqual([asset]);
    expect(undone.future).toHaveLength(1);

    const redone = sheetDocumentHistoryReducer(undone, {
      type: "history/redo",
    });

    expect(redone.present.settings.background).toEqual({
      type: "solid",
      color: "#ffffff",
    });
    expect(redone.future).toHaveLength(0);
  });

  test("clears redo history after a new document command", () => {
    const history = createSheetDocumentHistory(
      createSheetDocument({
        id: "project-1",
        sheetSizeId: "11x17",
      })
    );

    const withAsset = sheetDocumentHistoryReducer(history, {
      type: "asset/add",
      asset,
    });
    const undone = sheetDocumentHistoryReducer(withAsset, {
      type: "history/undo",
    });
    const changed = sheetDocumentHistoryReducer(undone, {
      type: "sheet/set-size",
      sheetSizeId: "11x17",
    });

    expect(changed.present.assets).toEqual([]);
    expect(changed.present.sheet.sizeId).toBe("11x17");
    expect(changed.future).toEqual([]);
  });

  test("keeps only the configured number of undo entries", () => {
    let history = createSheetDocumentHistory(
      createSheetDocument({
        id: "project-1",
        sheetSizeId: "11x17",
      })
    );

    for (let i = 0; i < 5; i += 1) {
      history = sheetDocumentHistoryReducer(
        history,
        {
          type: "asset/add",
          asset: {
            ...asset,
            id: `asset-${i}`,
            fileName: `asset-${i}.png`,
          },
        },
        3
      );
    }

    expect(history.past).toHaveLength(3);
    expect(history.present.assets.map((candidate) => candidate.id)).toEqual([
      "asset-0",
      "asset-1",
      "asset-2",
      "asset-3",
      "asset-4",
    ]);

    history = sheetDocumentHistoryReducer(history, { type: "history/undo" });
    history = sheetDocumentHistoryReducer(history, { type: "history/undo" });
    history = sheetDocumentHistoryReducer(history, { type: "history/undo" });
    history = sheetDocumentHistoryReducer(history, { type: "history/undo" });

    expect(history.present.assets.map((candidate) => candidate.id)).toEqual([
      "asset-0",
      "asset-1",
    ]);
    expect(history.past).toHaveLength(0);
  });
});
