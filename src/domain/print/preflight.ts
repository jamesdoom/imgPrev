import { STICKER_SHEET_MVP_PROFILE } from "./productionProfiles";
import type {
  PreflightIssue,
  ProductionProfile,
  SheetAsset,
  SheetDocument,
  SheetItem,
} from "./types";

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const MEASUREMENT_EPSILON_IN = 0.000001;
const DPI_ROUNDING_TOLERANCE = 0.5;

export function runPreflight(
  document: SheetDocument,
  profile: ProductionProfile = STICKER_SHEET_MVP_PROFILE
): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const assetsById = new Map(
    document.assets.map((asset): [string, SheetAsset] => [asset.id, asset])
  );

  for (const asset of document.assets) {
    issues.push(...preflightAsset(asset));
  }

  const itemBounds = document.items.map((item) => ({
    item,
    bounds: getItemBounds(item),
  }));

  for (const { item, bounds } of itemBounds) {
    const asset = assetsById.get(item.assetId);

    issues.push(...preflightItem(item, bounds, document, profile, asset));
  }

  for (let i = 0; i < itemBounds.length; i += 1) {
    for (let j = i + 1; j < itemBounds.length; j += 1) {
      const issue = preflightItemSpacing(
        itemBounds[i].item,
        itemBounds[i].bounds,
        itemBounds[j].item,
        itemBounds[j].bounds,
        profile
      );

      if (issue) {
        issues.push(issue);
      }
    }
  }

  return issues;
}

export function getItemBounds(item: SheetItem): Bounds {
  const width = item.widthIn * Math.abs(item.scaleX);
  const height = item.heightIn * Math.abs(item.scaleY);
  const centerX = item.xIn + width / 2;
  const centerY = item.yIn + height / 2;
  const radians = (item.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const corners = [
    { x: -width / 2, y: -height / 2 },
    { x: width / 2, y: -height / 2 },
    { x: width / 2, y: height / 2 },
    { x: -width / 2, y: height / 2 },
  ].map((corner) => ({
    x: centerX + corner.x * cos - corner.y * sin,
    y: centerY + corner.x * sin + corner.y * cos,
  }));

  return {
    minX: Math.min(...corners.map((corner) => corner.x)),
    minY: Math.min(...corners.map((corner) => corner.y)),
    maxX: Math.max(...corners.map((corner) => corner.x)),
    maxY: Math.max(...corners.map((corner) => corner.y)),
  };
}

function preflightAsset(
  asset: SheetAsset
): PreflightIssue[] {
  if (asset.fileType === "application/pdf") {
    return [
      {
        id: `${asset.id}:unsupported-production-asset`,
        severity: "error",
        code: "unsupported-production-asset",
        assetId: asset.id,
        message: `${asset.fileName} must be converted to PNG, JPG, WebP, or SVG before production export.`,
      },
    ];
  }

  return [];
}

function isSvgAsset(asset: SheetAsset): boolean {
  return (
    asset.fileType.toLowerCase() === "image/svg+xml" ||
    asset.fileName.trim().toLowerCase().endsWith(".svg")
  );
}

function preflightItem(
  item: SheetItem,
  bounds: Bounds,
  document: SheetDocument,
  profile: ProductionProfile,
  asset?: SheetAsset
): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const minSizeIn = profile.printRules.minStickerSizeIn;
  const width = item.widthIn * Math.abs(item.scaleX);
  const height = item.heightIn * Math.abs(item.scaleY);
  const dpiIssue = asset
    ? getEffectiveDpiIssue(asset, item, width, height, profile)
    : null;

  if (dpiIssue) {
    issues.push(dpiIssue);
  }

  if (width < minSizeIn || height < minSizeIn) {
    issues.push({
      id: `${item.id}:item-too-small`,
      severity: "error",
      code: "item-too-small",
      itemId: item.id,
      assetId: item.assetId,
      message: `${asset?.fileName ?? item.name ?? "Sticker"} is smaller than ${minSizeIn}" on one side.`,
    });
  }

  const marginIn = profile.printRules.sheetEdgeMarginIn;

  if (
    bounds.minX + MEASUREMENT_EPSILON_IN < marginIn ||
    bounds.minY + MEASUREMENT_EPSILON_IN < marginIn ||
    bounds.maxX - MEASUREMENT_EPSILON_IN > document.sheet.widthIn - marginIn ||
    bounds.maxY - MEASUREMENT_EPSILON_IN > document.sheet.heightIn - marginIn
  ) {
    issues.push({
      id: `${item.id}:item-outside-safe-area`,
      severity: "error",
      code: "item-outside-safe-area",
      itemId: item.id,
      assetId: item.assetId,
      message: `${asset?.fileName ?? item.name ?? "Sticker"} is outside the ${marginIn}" sheet edge margin.`,
    });
  }

  return issues;
}

function getEffectiveDpiIssue(
  asset: SheetAsset,
  item: SheetItem,
  widthIn: number,
  heightIn: number,
  profile: ProductionProfile
): PreflightIssue | null {
  if (
    isSvgAsset(asset) ||
    !asset.widthPx ||
    !asset.heightPx ||
    widthIn <= 0 ||
    heightIn <= 0
  ) {
    return null;
  }

  const effectiveDpi = Math.min(
    asset.widthPx / widthIn,
    asset.heightPx / heightIn
  );
  const roundedDpi = Math.round(effectiveDpi);

  if (
    profile.rejectBelowDpi &&
    effectiveDpi + DPI_ROUNDING_TOLERANCE < profile.rejectBelowDpi
  ) {
    return {
      id: `${item.id}:dpi-below-rejection`,
      severity: "error",
      code: "dpi-below-rejection",
      itemId: item.id,
      assetId: asset.id,
      message: `${asset.fileName} is approximately ${roundedDpi} effective DPI at its placed size, below the ${profile.rejectBelowDpi} DPI minimum. Make the decal smaller or use a larger image.`,
    };
  }

  if (effectiveDpi + DPI_ROUNDING_TOLERANCE < profile.warnBelowDpi) {
    return {
      id: `${item.id}:dpi-below-warning`,
      severity: "warning",
      code: "dpi-below-warning",
      itemId: item.id,
      assetId: asset.id,
      message: `${asset.fileName} is approximately ${roundedDpi} effective DPI at its placed size; ${profile.warnBelowDpi} DPI is preferred. Making the decal smaller will improve resolution.`,
    };
  }

  return null;
}

function preflightItemSpacing(
  firstItem: SheetItem,
  firstBounds: Bounds,
  secondItem: SheetItem,
  secondBounds: Bounds,
  profile: ProductionProfile
): PreflightIssue | null {
  const requiredSpacingIn = profile.printRules.stickerSpacingIn;
  const xGap = Math.max(
    0,
    Math.max(firstBounds.minX, secondBounds.minX) -
      Math.min(firstBounds.maxX, secondBounds.maxX)
  );
  const yGap = Math.max(
    0,
    Math.max(firstBounds.minY, secondBounds.minY) -
      Math.min(firstBounds.maxY, secondBounds.maxY)
  );
  const distance = Math.sqrt(xGap * xGap + yGap * yGap);

  if (distance + MEASUREMENT_EPSILON_IN >= requiredSpacingIn) {
    return null;
  }

  return {
    id: `${firstItem.id}:${secondItem.id}:item-spacing-too-tight`,
    severity: "error",
    code: "item-spacing-too-tight",
    itemId: firstItem.id,
    message: `Two stickers are closer than the required ${requiredSpacingIn}" spacing.`,
  };
}
