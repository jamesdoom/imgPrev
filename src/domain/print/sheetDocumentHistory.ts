import {
  sheetDocumentReducer,
  type SheetDocumentCommand,
} from "./sheetDocumentReducer";
import type { SheetDocument } from "./types";

export interface SheetDocumentHistoryState {
  present: SheetDocument;
  past: SheetDocument[];
  future: SheetDocument[];
}

export type SheetDocumentHistoryAction =
  | { type: "history/undo" }
  | { type: "history/redo" }
  | { type: "history/reset"; document: SheetDocument }
  | SheetDocumentCommand;

export const DEFAULT_DOCUMENT_HISTORY_LIMIT = 50;

export function createSheetDocumentHistory(
  document: SheetDocument
): SheetDocumentHistoryState {
  return {
    present: document,
    past: [],
    future: [],
  };
}

export function sheetDocumentHistoryReducer(
  state: SheetDocumentHistoryState,
  action: SheetDocumentHistoryAction,
  historyLimit = DEFAULT_DOCUMENT_HISTORY_LIMIT
): SheetDocumentHistoryState {
  switch (action.type) {
    case "history/undo": {
      if (state.past.length === 0) {
        return state;
      }

      const previous = state.past[state.past.length - 1];
      const remainingPast = state.past.slice(0, -1);

      return {
        present: previous,
        past: remainingPast,
        future: [state.present, ...state.future],
      };
    }

    case "history/redo": {
      const [next, ...remainingFuture] = state.future;

      if (!next) {
        return state;
      }

      return {
        present: next,
        past: [...state.past, state.present],
        future: remainingFuture,
      };
    }

    case "history/reset":
      return createSheetDocumentHistory(action.document);

    default: {
      const nextPresent = sheetDocumentReducer(state.present, action);

      if (nextPresent === state.present) {
        return state;
      }

      return {
        present: nextPresent,
        past: [...state.past, state.present].slice(-historyLimit),
        future: [],
      };
    }
  }
}
