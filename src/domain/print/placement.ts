import { STICKER_SHEET_MVP_PROFILE } from "./productionProfiles";
import type {
  ProductionProfile,
  SheetAsset,
  SheetDocument,
  SheetItem,
} from "./types";

export interface CreateSheetItemFromAssetInput {
  id: string;
  asset: SheetAsset;
  document: SheetDocument;
  profile?: ProductionProfile;
}

export interface AutoArrangeSheetItemsInput {
  document: SheetDocument;
  idFactory: (asset: SheetAsset, index: number) => string;
  profile?: ProductionProfile;
}

export interface AutoArrangeSheetItemsResult {
  items: SheetItem[];
  unplacedAssetIds: string[];
}

export function createSheetItemFromAsset({
  id,
  asset,
  document,
  profile = STICKER_SHEET_MVP_PROFILE,
}: CreateSheetItemFromAssetInput): SheetItem {
  const { sheetEdgeMarginIn, minStickerSizeIn } = profile.printRules;
  const maxWidthIn = Math.max(
    minStickerSizeIn,
    document.sheet.widthIn - sheetEdgeMarginIn * 2
  );
  const maxHeightIn = Math.max(
    minStickerSizeIn,
    document.sheet.heightIn - sheetEdgeMarginIn * 2
  );
  const naturalSize = getNaturalAssetSizeIn(asset, profile.requiredDpi);
  const fitScale = Math.min(
    1,
    maxWidthIn / naturalSize.widthIn,
    maxHeightIn / naturalSize.heightIn
  );

  return {
    id,
    assetId: asset.id,
    name: asset.fileName,
    xIn: sheetEdgeMarginIn,
    yIn: sheetEdgeMarginIn,
    widthIn: roundToThousandth(
      Math.max(minStickerSizeIn, naturalSize.widthIn * fitScale)
    ),
    heightIn: roundToThousandth(
      Math.max(minStickerSizeIn, naturalSize.heightIn * fitScale)
    ),
    rotationDeg: 0,
    scaleX: 1,
    scaleY: 1,
  };
}

export function autoArrangeSheetItems({
  document,
  idFactory,
  profile = STICKER_SHEET_MVP_PROFILE,
}: AutoArrangeSheetItemsInput): AutoArrangeSheetItemsResult {
  const { sheetEdgeMarginIn, stickerSpacingIn } = profile.printRules;
  const maxX = document.sheet.widthIn - sheetEdgeMarginIn;
  const maxY = document.sheet.heightIn - sheetEdgeMarginIn;
  const candidates = getAutoArrangeCandidates({
    document,
    idFactory,
    profile,
  });
  const items: SheetItem[] = [];
  const unplacedAssetIds: string[] = [];
  let xIn = sheetEdgeMarginIn;
  let yIn = sheetEdgeMarginIn;
  let rowHeightIn = 0;

  candidates.forEach((item) => {
    if (xIn + item.widthIn > maxX && xIn > sheetEdgeMarginIn) {
      xIn = sheetEdgeMarginIn;
      yIn += rowHeightIn + stickerSpacingIn;
      rowHeightIn = 0;
    }

    if (yIn + item.heightIn > maxY) {
      unplacedAssetIds.push(item.assetId);
      return;
    }

    items.push({
      ...item,
      xIn: roundToThousandth(xIn),
      yIn: roundToThousandth(yIn),
    });

    xIn += item.widthIn + stickerSpacingIn;
    rowHeightIn = Math.max(rowHeightIn, item.heightIn);
  });

  return {
    items,
    unplacedAssetIds,
  };
}

function getAutoArrangeCandidates({
  document,
  idFactory,
  profile,
}: Required<AutoArrangeSheetItemsInput>): SheetItem[] {
  if (document.items.length === 0) {
    return document.assets.map((asset, index) =>
      createSheetItemFromAsset({
        id: idFactory(asset, index),
        asset,
        document,
        profile,
      })
    );
  }

  const placedAssetIds = new Set(document.items.map((item) => item.assetId));
  const unplacedAssetItems = document.assets
    .filter((asset) => !placedAssetIds.has(asset.id))
    .map((asset, index) =>
      createSheetItemFromAsset({
        id: idFactory(asset, document.items.length + index),
        asset,
        document,
        profile,
      })
    );

  return [...document.items, ...unplacedAssetItems];
}

function getNaturalAssetSizeIn(
  asset: SheetAsset,
  fallbackDpi: number
): { widthIn: number; heightIn: number } {
  if (asset.widthPx && asset.heightPx) {
    const dpi = asset.dpi ?? fallbackDpi;

    return {
      widthIn: asset.widthPx / dpi,
      heightIn: asset.heightPx / dpi,
    };
  }

  return {
    widthIn: 1.5,
    heightIn: 1.5,
  };
}

function roundToThousandth(value: number): number {
  return Math.round(value * 1000) / 1000;
}
