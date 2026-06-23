import { describe, expect, test } from "vitest";
import { createSheetDocument } from "./sheetDocument";

describe("createSheetDocument", () => {
  test("creates an editable project document from the production profile", () => {
    expect(
      createSheetDocument({
        id: "project-1",
        sheetSizeId: "8.5x11",
        now: "2026-06-23T12:00:00.000Z",
      })
    ).toEqual({
      id: "project-1",
      version: 1,
      productionProfileId: "sticker-sheet-mvp",
      sheet: {
        sizeId: "8.5x11",
        widthIn: 8.5,
        heightIn: 11,
        dpi: 300,
      },
      assets: [],
      items: [],
      settings: {
        background: {
          type: "transparent",
        },
      },
      createdAt: "2026-06-23T12:00:00.000Z",
      updatedAt: "2026-06-23T12:00:00.000Z",
    });
  });

  test("allows a solid sheet background when the project needs one", () => {
    const document = createSheetDocument({
      id: "project-2",
      sheetSizeId: "4x6",
      background: {
        type: "solid",
        color: "#ffffff",
      },
    });

    expect(document.settings.background).toEqual({
      type: "solid",
      color: "#ffffff",
    });
  });
});
