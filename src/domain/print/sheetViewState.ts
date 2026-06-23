import type { SheetViewState } from "./types";

export const DEFAULT_SHEET_VIEW_STATE: SheetViewState = {
  selectedItemIds: [],
  zoom: 1,
  pan: {
    x: 0,
    y: 0,
  },
  showGrid: true,
  showBleed: true,
  showSafeArea: true,
  showCutlines: true,
};

export type SheetViewStateAction =
  | { type: "selection/select-item"; itemId: string; append?: boolean }
  | { type: "selection/select-items"; itemIds: string[] }
  | { type: "selection/select-asset"; assetId?: string }
  | { type: "selection/clear" }
  | { type: "viewport/set-zoom"; zoom: number }
  | { type: "viewport/set-pan"; pan: { x: number; y: number } }
  | { type: "overlay/set-grid"; visible: boolean }
  | { type: "overlay/set-bleed"; visible: boolean }
  | { type: "overlay/set-safe-area"; visible: boolean }
  | { type: "overlay/set-cutlines"; visible: boolean };

export function sheetViewStateReducer(
  state: SheetViewState,
  action: SheetViewStateAction
): SheetViewState {
  switch (action.type) {
    case "selection/select-item":
      return {
        ...state,
        selectedItemIds: action.append
          ? appendUnique(state.selectedItemIds, action.itemId)
          : [action.itemId],
        selectedAssetId: undefined,
      };

    case "selection/select-items":
      return {
        ...state,
        selectedItemIds: [...new Set(action.itemIds)],
        selectedAssetId: undefined,
      };

    case "selection/select-asset":
      return {
        ...state,
        selectedAssetId: action.assetId,
        selectedItemIds: [],
      };

    case "selection/clear":
      return {
        ...state,
        selectedAssetId: undefined,
        selectedItemIds: [],
      };

    case "viewport/set-zoom":
      return {
        ...state,
        zoom: clamp(action.zoom, 0.1, 8),
      };

    case "viewport/set-pan":
      return {
        ...state,
        pan: action.pan,
      };

    case "overlay/set-grid":
      return {
        ...state,
        showGrid: action.visible,
      };

    case "overlay/set-bleed":
      return {
        ...state,
        showBleed: action.visible,
      };

    case "overlay/set-safe-area":
      return {
        ...state,
        showSafeArea: action.visible,
      };

    case "overlay/set-cutlines":
      return {
        ...state,
        showCutlines: action.visible,
      };
  }
}

function appendUnique(items: string[], item: string): string[] {
  return items.includes(item) ? items : [...items, item];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
