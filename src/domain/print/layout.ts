import { getItemBounds } from "./preflight";
import type { SheetItem } from "./types";

export type SheetItemAlignment =
  | "left"
  | "center-x"
  | "right"
  | "top"
  | "center-y"
  | "bottom";

export type SheetItemDistribution = "horizontal" | "vertical";

interface LayoutBounds {
  id: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export function alignSheetItems(
  items: SheetItem[],
  selectedItemIds: string[],
  alignment: SheetItemAlignment,
): SheetItem[] {
  const selectedBounds = getSelectedLayoutBounds(items, selectedItemIds);

  if (selectedBounds.length < 2) {
    return items;
  }

  const groupBounds = getGroupBounds(selectedBounds);
  const deltas = new Map<string, { x: number; y: number }>();

  selectedBounds.forEach((bounds) => {
    deltas.set(bounds.id, getAlignmentDelta(bounds, groupBounds, alignment));
  });

  return applyLayoutDeltas(items, deltas);
}

export function distributeSheetItems(
  items: SheetItem[],
  selectedItemIds: string[],
  distribution: SheetItemDistribution,
): SheetItem[] {
  const selectedBounds = getSelectedLayoutBounds(items, selectedItemIds);

  if (selectedBounds.length < 3) {
    return items;
  }

  const groupBounds = getGroupBounds(selectedBounds);
  const sortedBounds =
    distribution === "horizontal"
      ? [...selectedBounds].sort((a, b) => a.centerX - b.centerX)
      : [...selectedBounds].sort((a, b) => a.centerY - b.centerY);
  const totalSize = sortedBounds.reduce(
    (sum, bounds) =>
      sum + (distribution === "horizontal" ? bounds.width : bounds.height),
    0,
  );
  const groupSize =
    distribution === "horizontal"
      ? groupBounds.maxX - groupBounds.minX
      : groupBounds.maxY - groupBounds.minY;
  const gap = (groupSize - totalSize) / (sortedBounds.length - 1);
  const deltas = new Map<string, { x: number; y: number }>();
  let cursor = distribution === "horizontal" ? groupBounds.minX : groupBounds.minY;

  sortedBounds.forEach((bounds) => {
    if (distribution === "horizontal") {
      deltas.set(bounds.id, { x: cursor - bounds.minX, y: 0 });
      cursor += bounds.width + gap;
      return;
    }

    deltas.set(bounds.id, { x: 0, y: cursor - bounds.minY });
    cursor += bounds.height + gap;
  });

  return applyLayoutDeltas(items, deltas);
}

function getSelectedLayoutBounds(
  items: SheetItem[],
  selectedItemIds: string[],
): LayoutBounds[] {
  const selectedIds = new Set(selectedItemIds);

  return items
    .filter((item) => selectedIds.has(item.id))
    .map((item) => {
      const bounds = getItemBounds(item);

      return {
        id: item.id,
        ...bounds,
        width: bounds.maxX - bounds.minX,
        height: bounds.maxY - bounds.minY,
        centerX: (bounds.minX + bounds.maxX) / 2,
        centerY: (bounds.minY + bounds.maxY) / 2,
      };
    });
}

function getGroupBounds(bounds: LayoutBounds[]): LayoutBounds {
  const minX = Math.min(...bounds.map((itemBounds) => itemBounds.minX));
  const minY = Math.min(...bounds.map((itemBounds) => itemBounds.minY));
  const maxX = Math.max(...bounds.map((itemBounds) => itemBounds.maxX));
  const maxY = Math.max(...bounds.map((itemBounds) => itemBounds.maxY));

  return {
    id: "selection",
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

function getAlignmentDelta(
  bounds: LayoutBounds,
  groupBounds: LayoutBounds,
  alignment: SheetItemAlignment,
): { x: number; y: number } {
  switch (alignment) {
    case "left":
      return { x: groupBounds.minX - bounds.minX, y: 0 };
    case "center-x":
      return { x: groupBounds.centerX - bounds.centerX, y: 0 };
    case "right":
      return { x: groupBounds.maxX - bounds.maxX, y: 0 };
    case "top":
      return { x: 0, y: groupBounds.minY - bounds.minY };
    case "center-y":
      return { x: 0, y: groupBounds.centerY - bounds.centerY };
    case "bottom":
      return { x: 0, y: groupBounds.maxY - bounds.maxY };
  }
}

function applyLayoutDeltas(
  items: SheetItem[],
  deltas: Map<string, { x: number; y: number }>,
): SheetItem[] {
  return items.map((item) => {
    const delta = deltas.get(item.id);

    if (!delta) {
      return item;
    }

    return {
      ...item,
      xIn: roundToThousandth(item.xIn + delta.x),
      yIn: roundToThousandth(item.yIn + delta.y),
    };
  });
}

function roundToThousandth(value: number): number {
  return Math.round(value * 1000) / 1000;
}
