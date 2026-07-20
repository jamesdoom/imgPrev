import { findSheetSize } from "./measurements";
import { STICKER_SHEET_MVP_PROFILE } from "./productionProfiles";
import type {
  ProductionProfile,
  SheetAsset,
  SheetBackground,
  SheetDocument,
  SheetDocumentSettings,
  SheetItem,
  SheetPage,
  SheetSizeId,
} from "./types";

export type AddAssetCommand = {
  type: "asset/add";
  asset: SheetAsset;
  now?: string;
};

export type UpdateAssetCommand = {
  type: "asset/update";
  assetId: string;
  patch: Partial<Omit<SheetAsset, "id">>;
  now?: string;
};

export type RemoveAssetCommand = {
  type: "asset/remove";
  assetId: string;
  now?: string;
};

export type PlaceItemCommand = {
  type: "item/place";
  item: SheetItem;
  now?: string;
};

export type PlaceItemsCommand = {
  type: "items/place";
  items: SheetItem[];
  now?: string;
};

export type UpdateItemCommand = {
  type: "item/update";
  itemId: string;
  patch: Partial<Omit<SheetItem, "id">>;
  now?: string;
};

export type RemoveItemCommand = {
  type: "item/remove";
  itemId: string;
  now?: string;
};

export type ReplaceItemsCommand = {
  type: "items/replace";
  items: SheetItem[];
  now?: string;
};

export type ReplaceLayoutCommand = {
  type: "layout/replace";
  items: SheetItem[];
  sheets: SheetPage[];
  now?: string;
};

export type DuplicateItemCommand = {
  type: "item/duplicate";
  itemId: string;
  newItemId: string;
  offsetIn?: {
    x: number;
    y: number;
  };
  now?: string;
};

export type SetSheetSizeCommand = {
  type: "sheet/set-size";
  sheetSizeId: SheetSizeId;
  profile?: ProductionProfile;
  now?: string;
};

export type UpdateSettingsCommand = {
  type: "settings/update";
  patch: Partial<SheetDocumentSettings>;
  now?: string;
};

export type SetBackgroundCommand = {
  type: "settings/set-background";
  background: SheetBackground;
  now?: string;
};

export type SheetDocumentCommand =
  | AddAssetCommand
  | UpdateAssetCommand
  | RemoveAssetCommand
  | PlaceItemCommand
  | PlaceItemsCommand
  | UpdateItemCommand
  | RemoveItemCommand
  | ReplaceItemsCommand
  | ReplaceLayoutCommand
  | DuplicateItemCommand
  | SetSheetSizeCommand
  | UpdateSettingsCommand
  | SetBackgroundCommand;

export function sheetDocumentReducer(
  document: SheetDocument,
  command: SheetDocumentCommand
): SheetDocument {
  switch (command.type) {
    case "asset/add":
      return touch(
        {
          ...document,
          assets: upsertById(document.assets, command.asset),
        },
        command.now
      );

    case "asset/update":
      return touch(
        {
          ...document,
          assets: document.assets.map((asset) =>
            asset.id === command.assetId ? { ...asset, ...command.patch } : asset
          ),
        },
        command.now
      );

    case "asset/remove": {
      const items = document.items.filter(
        (item) => item.assetId !== command.assetId
      );

      return touch(
        {
          ...document,
          assets: document.assets.filter((asset) => asset.id !== command.assetId),
          items,
          sheets: pruneEmptyOverflowSheets(document.sheets, items),
        },
        command.now
      );
    }

    case "item/place":
      if (!document.assets.some((asset) => asset.id === command.item.assetId)) {
        throw new Error(`Cannot place item for missing asset: ${command.item.assetId}`);
      }

      return touch(
        {
          ...document,
          items: upsertById(document.items, command.item),
        },
        command.now
      );

    case "items/place":
      assertItemsReferenceExistingAssets(document, command.items, "place items");

      return touch(
        {
          ...document,
          items: command.items.reduce(
            (items, item) => upsertById(items, item),
            document.items
          ),
        },
        command.now
      );

    case "item/update":
      return touch(
        {
          ...document,
          items: document.items.map((item) =>
            item.id === command.itemId ? { ...item, ...command.patch } : item
          ),
        },
        command.now
      );

    case "item/remove": {
      const items = document.items.filter(
        (item) => item.id !== command.itemId
      );

      return touch(
        {
          ...document,
          items,
          sheets: pruneEmptyOverflowSheets(document.sheets, items),
        },
        command.now
      );
    }

    case "items/replace":
      assertItemsReferenceExistingAssets(
        document,
        command.items,
        "replace items"
      );

      return touch(
        {
          ...document,
          items: command.items,
        },
        command.now
      );

    case "layout/replace":
      assertItemsReferenceExistingAssets(
        document,
        command.items,
        "replace layout"
      );

      return touch(
        {
          ...document,
          items: command.items,
          sheets: command.sheets,
        },
        command.now
      );

    case "item/duplicate":
      return duplicateItem(document, command);

    case "sheet/set-size": {
      const profile = command.profile ?? STICKER_SHEET_MVP_PROFILE;
      const sheetSize = findSheetSize(command.sheetSizeId, profile);

      return touch(
        {
          ...document,
          productionProfileId: profile.id,
          sheet: {
            sizeId: sheetSize.id,
            widthIn: sheetSize.widthIn,
            heightIn: sheetSize.heightIn,
            dpi: profile.requiredDpi,
          },
        },
        command.now
      );
    }

    case "settings/update":
      return touch(
        {
          ...document,
          settings: {
            ...document.settings,
            ...command.patch,
          },
        },
        command.now
      );

    case "settings/set-background":
      return touch(
        {
          ...document,
          settings: {
            ...document.settings,
            background: command.background,
          },
        },
        command.now
      );
  }
}

function assertItemsReferenceExistingAssets(
  document: SheetDocument,
  items: SheetItem[],
  actionLabel: string
) {
  const assetIds = new Set(document.assets.map((asset) => asset.id));
  const missingItem = items.find((item) => !assetIds.has(item.assetId));

  if (missingItem) {
    throw new Error(
      `Cannot ${actionLabel} with missing asset: ${missingItem.assetId}`
    );
  }
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  const existingIndex = items.findIndex((candidate) => candidate.id === item.id);

  if (existingIndex === -1) {
    return [...items, item];
  }

  return items.map((candidate) =>
    candidate.id === item.id ? item : candidate
  );
}

function duplicateItem(
  document: SheetDocument,
  command: DuplicateItemCommand
): SheetDocument {
  const sourceItem = document.items.find((item) => item.id === command.itemId);

  if (!sourceItem) {
    return document;
  }

  const offset = command.offsetIn ?? { x: 0.25, y: 0.25 };
  const duplicate: SheetItem = {
    ...sourceItem,
    id: command.newItemId,
    xIn: sourceItem.xIn + offset.x,
    yIn: sourceItem.yIn + offset.y,
  };

  return touch(
    {
      ...document,
      items: [...document.items, duplicate],
    },
    command.now
  );
}

function touch(document: SheetDocument, now?: string): SheetDocument {
  if (!now) {
    return document;
  }

  return {
    ...document,
    updatedAt: now,
  };
}

function pruneEmptyOverflowSheets(
  sheets: SheetPage[] | undefined,
  items: SheetItem[]
): SheetPage[] {
  const documentSheets =
    sheets && sheets.length > 0
      ? sheets
      : [{ id: "sheet-1", label: "Sheet 1" }];
  const occupiedSheetIds = new Set(
    items.map((item) => item.sheetId ?? "sheet-1")
  );

  return documentSheets
    .filter(
      (sheet, index) => index === 0 || occupiedSheetIds.has(sheet.id)
    )
    .map((sheet, index) => ({
      ...sheet,
      label: `Sheet ${index + 1}`,
    }));
}
