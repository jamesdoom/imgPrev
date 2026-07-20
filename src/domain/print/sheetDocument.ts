import { findSheetSize } from "./measurements";
import { STICKER_SHEET_MVP_PROFILE } from "./productionProfiles";
import type {
  ProductionProfile,
  SheetBackground,
  SheetDocument,
  SheetSizeId,
} from "./types";

export interface CreateSheetDocumentInput {
  id: string;
  sheetSizeId: SheetSizeId;
  profile?: ProductionProfile;
  background?: SheetBackground;
  now?: string;
}

export function createSheetDocument({
  id,
  sheetSizeId,
  profile = STICKER_SHEET_MVP_PROFILE,
  background = profile.defaultBackground,
  now,
}: CreateSheetDocumentInput): SheetDocument {
  const sheetSize = findSheetSize(sheetSizeId, profile);

  return {
    id,
    version: 1,
    productionProfileId: profile.id,
    sheet: {
      sizeId: sheetSize.id,
      widthIn: sheetSize.widthIn,
      heightIn: sheetSize.heightIn,
      dpi: profile.requiredDpi,
    },
    sheets: [{ id: "sheet-1", label: "Sheet 1" }],
    assets: [],
    items: [],
    settings: {
      background,
    },
    createdAt: now,
    updatedAt: now,
  };
}
