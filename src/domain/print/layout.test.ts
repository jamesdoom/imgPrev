import { describe, expect, test } from "vitest";
import { alignSheetItems, distributeSheetItems } from "./layout";
import type { SheetItem } from "./types";

const baseItem: SheetItem = {
  id: "item-1",
  assetId: "asset-1",
  xIn: 0.5,
  yIn: 0.75,
  widthIn: 1,
  heightIn: 1,
  rotationDeg: 0,
  scaleX: 1,
  scaleY: 1,
};

describe("alignSheetItems", () => {
  test("aligns selected decal bounds without moving unselected decals", () => {
    const items: SheetItem[] = [
      baseItem,
      { ...baseItem, id: "item-2", xIn: 2, yIn: 2, widthIn: 2 },
      { ...baseItem, id: "item-3", xIn: 5, yIn: 5 },
    ];

    const aligned = alignSheetItems(items, ["item-1", "item-2"], "left");

    expect(aligned).toMatchObject([
      { id: "item-1", xIn: 0.5, yIn: 0.75 },
      { id: "item-2", xIn: 0.5, yIn: 2 },
      { id: "item-3", xIn: 5, yIn: 5 },
    ]);
  });

  test("uses rendered bounds for scaled decals", () => {
    const items: SheetItem[] = [
      { ...baseItem, id: "item-1", xIn: 0.5, widthIn: 1, scaleX: 2 },
      { ...baseItem, id: "item-2", xIn: 3, widthIn: 1, scaleX: 1 },
    ];

    const aligned = alignSheetItems(items, ["item-1", "item-2"], "right");

    expect(aligned).toMatchObject([
      { id: "item-1", xIn: 2 },
      { id: "item-2", xIn: 3 },
    ]);
  });
});

describe("distributeSheetItems", () => {
  test("spaces selected decals evenly by rendered horizontal gaps", () => {
    const items: SheetItem[] = [
      { ...baseItem, id: "item-1", xIn: 0, widthIn: 1 },
      { ...baseItem, id: "item-2", xIn: 1.5, widthIn: 1 },
      { ...baseItem, id: "item-3", xIn: 5, widthIn: 1 },
    ];

    const distributed = distributeSheetItems(
      items,
      ["item-1", "item-2", "item-3"],
      "horizontal",
    );

    expect(distributed).toMatchObject([
      { id: "item-1", xIn: 0 },
      { id: "item-2", xIn: 2.5 },
      { id: "item-3", xIn: 5 },
    ]);
  });

  test("requires at least three selected decals", () => {
    const items = [
      { ...baseItem, id: "item-1" },
      { ...baseItem, id: "item-2" },
    ];

    expect(distributeSheetItems(items, ["item-1", "item-2"], "vertical")).toBe(
      items,
    );
  });
});
