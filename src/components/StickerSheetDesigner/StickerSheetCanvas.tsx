import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import {
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import type Konva from "konva";
import { useImage } from "../../hooks/useImage";
import {
  STICKER_SHEET_MVP_PROFILE,
  getItemBounds,
  sheetSizeToPixels,
} from "../../domain/print";
import type {
  SheetAsset,
  SheetDocument,
  SheetItem,
  SheetViewState,
} from "../../domain/print";

const PREVIEW_PIXELS_PER_INCH = 96;
const CHECKER_SIZE = 24;
const MIN_ITEM_SIZE_PX = 24;
const CUTLINE_PADDING_PX = 6;
const SNAP_GRID_IN = 0.25;
const SNAP_THRESHOLD_IN = 0.05;
const SPACING_GUIDE_LIMIT = 14;
const DIMENSION_TICK_PX = 10;

interface StickerSheetCanvasProps {
  document: SheetDocument;
  viewState: SheetViewState;
  onSelectItem: (itemId: string, append?: boolean) => void;
  onClearSelection: () => void;
  onUpdateItem: (itemId: string, patch: Partial<Omit<SheetItem, "id">>) => void;
}

export interface StickerSheetCanvasHandle {
  exportPreviewPng: () => string | null;
}

interface SnapGuideLine {
  orientation: "horizontal" | "vertical";
  positionIn: number;
}

interface SpacingGuide {
  orientation: "horizontal" | "vertical";
  fromIn: number;
  toIn: number;
  crossIn: number;
  distanceIn: number;
  isTight: boolean;
}

export const StickerSheetCanvas = forwardRef<
  StickerSheetCanvasHandle,
  StickerSheetCanvasProps
>(function StickerSheetCanvas(
  {
  document,
  viewState,
  onSelectItem,
  onClearSelection,
  onUpdateItem,
},
  ref
) {
  const stageRef = useRef<Konva.Stage>(null);
  const [activeSnapGuides, setActiveSnapGuides] = useState<SnapGuideLine[]>([]);
  const [isDraggingItem, setIsDraggingItem] = useState(false);
  const assetsById = useMemo(
    () => new Map(document.assets.map((asset) => [asset.id, asset])),
    [document.assets]
  );
  const spacingGuides = useMemo(
    () =>
      viewState.showSpacingGuides && !isDraggingItem
        ? getSpacingGuides(document, viewState.selectedItemIds)
        : [],
    [
      document,
      isDraggingItem,
      viewState.selectedItemIds,
      viewState.showSpacingGuides,
    ]
  );
  const width = document.sheet.widthIn * PREVIEW_PIXELS_PER_INCH;
  const height = document.sheet.heightIn * PREVIEW_PIXELS_PER_INCH;
  const stageWidth = width * viewState.zoom;
  const stageHeight = height * viewState.zoom;

  useImperativeHandle(
    ref,
    () => ({
      exportPreviewPng: () => {
        const stage = stageRef.current;

        if (!stage) {
          return null;
        }

        const previousWidth = stage.width();
        const previousHeight = stage.height();
        const previousScale = stage.scale();
        const transformers = stage.find("Transformer") as Konva.Transformer[];
        const previousTransformerVisibility = transformers.map((transformer) =>
          transformer.visible()
        );

        transformers.forEach((transformer) => transformer.visible(false));
        stage.width(width);
        stage.height(height);
        stage.scale({ x: 1, y: 1 });
        stage.draw();

        const dataUrl = stage.toDataURL({
          mimeType: "image/png",
          pixelRatio: 2,
        });

        stage.width(previousWidth);
        stage.height(previousHeight);
        stage.scale(previousScale);
        transformers.forEach((transformer, index) =>
          transformer.visible(previousTransformerVisibility[index])
        );
        stage.draw();

        return dataUrl;
      },
    }),
    [height, width]
  );

  return (
    <div className="h-full overflow-auto bg-neutral-200 p-3 sm:p-6">
      <div className="relative mx-auto w-fit rounded-sm border border-neutral-300 bg-white shadow-sm">
        <GuideStatusChip viewState={viewState} />
        <Stage
          ref={stageRef}
          width={stageWidth}
          height={stageHeight}
          scaleX={viewState.zoom}
          scaleY={viewState.zoom}
          onMouseDown={(event) => {
            if (event.target === event.target.getStage()) {
              onClearSelection();
            }
          }}
          onTouchStart={(event) => {
            if (event.target === event.target.getStage()) {
              onClearSelection();
            }
          }}
        >
          <Layer>
            <SheetBackground document={document} width={width} height={height} />
            {viewState.showGrid && <SheetGrid width={width} height={height} />}
            {viewState.showBleed && <BleedOverlay document={document} />}
            {viewState.showSafeArea && <SafeAreaOverlay document={document} />}
          </Layer>
          <Layer>
            {document.items.map((item) => {
              const asset = assetsById.get(item.assetId);

              if (!asset) {
                return null;
              }

              return (
                <StickerItemNode
                  key={item.id}
                  asset={asset}
                  document={document}
                  item={item}
                  items={document.items}
                  isSelected={viewState.selectedItemIds.includes(item.id)}
                  showCutline={viewState.showCutlines}
                  snapToGrid={viewState.snapToGrid}
                  snapToItems={viewState.snapToItems}
                  onSelect={(append) => onSelectItem(item.id, append)}
                  onDragStateChange={setIsDraggingItem}
                  onSnapGuidesChange={setActiveSnapGuides}
                  onUpdate={(patch) => onUpdateItem(item.id, patch)}
                />
              );
            })}
          </Layer>
          {(spacingGuides.length > 0 || activeSnapGuides.length > 0) && (
            <Layer listening={false}>
              <SpacingGuideOverlay guides={spacingGuides} />
              <SnapGuideOverlay
                guides={activeSnapGuides}
                width={document.sheet.widthIn}
                height={document.sheet.heightIn}
              />
            </Layer>
          )}
        </Stage>
      </div>
    </div>
  );
});

function StickerItemNode({
  asset,
  document,
  item,
  items,
  isSelected,
  showCutline,
  snapToGrid,
  snapToItems,
  onSelect,
  onDragStateChange,
  onSnapGuidesChange,
  onUpdate,
}: {
  asset: SheetAsset;
  document: SheetDocument;
  item: SheetItem;
  items: SheetItem[];
  isSelected: boolean;
  showCutline: boolean;
  snapToGrid: boolean;
  snapToItems: boolean;
  onSelect: (append?: boolean) => void;
  onDragStateChange: (isDragging: boolean) => void;
  onSnapGuidesChange: (guides: SnapGuideLine[]) => void;
  onUpdate: (patch: Partial<Omit<SheetItem, "id">>) => void;
}) {
  const imageRef = useRef<Konva.Image>(null);
  const placeholderRef = useRef<Konva.Rect>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [image] = useImage(getRenderableAssetUrl(asset));
  const x = item.xIn * PREVIEW_PIXELS_PER_INCH;
  const y = item.yIn * PREVIEW_PIXELS_PER_INCH;
  const width = item.widthIn * PREVIEW_PIXELS_PER_INCH;
  const height = item.heightIn * PREVIEW_PIXELS_PER_INCH;
  const absScaleX = Math.max(Math.abs(item.scaleX), 0.0001);
  const absScaleY = Math.max(Math.abs(item.scaleY), 0.0001);
  const renderedWidth = width * absScaleX;
  const renderedHeight = height * absScaleY;
  const centerX = x + renderedWidth / 2;
  const centerY = y + renderedHeight / 2;
  const cutlineWidth = width + (CUTLINE_PADDING_PX * 2) / absScaleX;
  const cutlineHeight = height + (CUTLINE_PADDING_PX * 2) / absScaleY;

  useEffect(() => {
    const node = image ? imageRef.current : placeholderRef.current;

    if (isSelected && node && transformerRef.current) {
      transformerRef.current.nodes([node]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [image, isSelected]);

  const handleTransformEnd = () => {
    const node = image ? imageRef.current : placeholderRef.current;

    if (!node) {
      return;
    }

    const nextScaleX = node.scaleX() < 0 ? -1 : 1;
    const nextScaleY = node.scaleY() < 0 ? -1 : 1;
    const nextWidth = Math.max(
      MIN_ITEM_SIZE_PX,
      node.width() * Math.abs(node.scaleX())
    );
    const nextHeight = Math.max(
      MIN_ITEM_SIZE_PX,
      node.height() * Math.abs(node.scaleY())
    );

    onUpdate({
      xIn: (node.x() - nextWidth / 2) / PREVIEW_PIXELS_PER_INCH,
      yIn: (node.y() - nextHeight / 2) / PREVIEW_PIXELS_PER_INCH,
      widthIn: nextWidth / PREVIEW_PIXELS_PER_INCH,
      heightIn: nextHeight / PREVIEW_PIXELS_PER_INCH,
      rotationDeg: normalizeRotation(node.rotation()),
      scaleX: nextScaleX,
      scaleY: nextScaleY,
    });
  };

  const commonProps = {
    x: centerX,
    y: centerY,
    width,
    height,
    offsetX: width / 2,
    offsetY: height / 2,
    rotation: item.rotationDeg,
    scaleX: item.scaleX,
    scaleY: item.scaleY,
    draggable: !item.locked,
    onClick: (event: Konva.KonvaEventObject<MouseEvent>) => {
      onSelect(event.evt.shiftKey || event.evt.metaKey || event.evt.ctrlKey);
    },
    onTap: () => onSelect(),
    onDragStart: () => {
      onDragStateChange(true);
    },
    onDragMove: (event: Konva.KonvaEventObject<DragEvent>) => {
      const snapped = getSnappedDragCenterPx({
        centerX: event.target.x(),
        centerY: event.target.y(),
        document,
        item,
        items,
        snapToGrid,
        snapToItems,
      });

      if (
        snapped.centerX !== event.target.x() ||
        snapped.centerY !== event.target.y()
      ) {
        event.target.position({ x: snapped.centerX, y: snapped.centerY });
      }

      onSnapGuidesChange(snapped.guides);
    },
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
      onDragStateChange(false);
      onSnapGuidesChange([]);
      onUpdate({
        xIn: (event.target.x() - renderedWidth / 2) / PREVIEW_PIXELS_PER_INCH,
        yIn: (event.target.y() - renderedHeight / 2) / PREVIEW_PIXELS_PER_INCH,
      });
    },
    onTransformEnd: handleTransformEnd,
  };

  return (
    <Group>
      {showCutline && (
        <Rect
          x={centerX}
          y={centerY}
          width={cutlineWidth}
          height={cutlineHeight}
          offsetX={cutlineWidth / 2}
          offsetY={cutlineHeight / 2}
          rotation={item.rotationDeg}
          scaleX={item.scaleX}
          scaleY={item.scaleY}
          stroke="#0f766e"
          strokeWidth={1.5}
          dash={[8, 5]}
          listening={false}
        />
      )}

      {image ? (
        <KonvaImage ref={imageRef} image={image} {...commonProps} />
      ) : (
        <>
          <Rect
            ref={placeholderRef}
            {...commonProps}
            fill="#f4f4f5"
            stroke="#a1a1aa"
            dash={[6, 4]}
          />
          <Text
            x={x + 10}
            y={y + 12}
            width={Math.max(40, width - 20)}
            text={asset.fileName}
            fontSize={12}
            fill="#52525b"
            listening={false}
          />
        </>
      )}

      {isSelected && (
        <Transformer
          ref={transformerRef}
          keepRatio
          rotateEnabled
          anchorSize={8}
          borderStroke="#0f766e"
          anchorStroke="#0f766e"
          anchorFill="#ffffff"
          boundBoxFunc={(oldBox, newBox) => {
            if (
              newBox.width < MIN_ITEM_SIZE_PX ||
              newBox.height < MIN_ITEM_SIZE_PX
            ) {
              return oldBox;
            }

            return newBox;
          }}
        />
      )}
    </Group>
  );
}

function getRenderableAssetUrl(asset: SheetAsset): string {
  if (asset.fileType.startsWith("image/") && !asset.sourceUrl.startsWith("blob:")) {
    return asset.sourceUrl;
  }

  return asset.previewUrl ?? asset.sourceUrl;
}

function normalizeRotation(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function getSnappedDragCenterPx({
  centerX,
  centerY,
  document,
  item,
  items,
  snapToGrid,
  snapToItems,
}: {
  centerX: number;
  centerY: number;
  document: SheetDocument;
  item: SheetItem;
  items: SheetItem[];
  snapToGrid: boolean;
  snapToItems: boolean;
}): { centerX: number; centerY: number; guides: SnapGuideLine[] } {
  const renderedWidthIn = item.widthIn * Math.abs(item.scaleX);
  const renderedHeightIn = item.heightIn * Math.abs(item.scaleY);
  const draftItem: SheetItem = {
    ...item,
    xIn: centerX / PREVIEW_PIXELS_PER_INCH - renderedWidthIn / 2,
    yIn: centerY / PREVIEW_PIXELS_PER_INCH - renderedHeightIn / 2,
  };
  const bounds = getItemBounds(draftItem);
  const sourceX = [
    bounds.minX,
    (bounds.minX + bounds.maxX) / 2,
    bounds.maxX,
  ];
  const sourceY = [
    bounds.minY,
    (bounds.minY + bounds.maxY) / 2,
    bounds.maxY,
  ];
  const targetX: number[] = [];
  const targetY: number[] = [];

  if (snapToGrid) {
    targetX.push(...sourceX.map((position) => snapToGridLine(position)));
    targetY.push(...sourceY.map((position) => snapToGridLine(position)));
  }

  if (snapToItems) {
    const sheetMarginIn = STICKER_SHEET_MVP_PROFILE.printRules.sheetEdgeMarginIn;

    targetX.push(
      0,
      sheetMarginIn,
      document.sheet.widthIn / 2,
      document.sheet.widthIn - sheetMarginIn,
      document.sheet.widthIn,
    );
    targetY.push(
      0,
      sheetMarginIn,
      document.sheet.heightIn / 2,
      document.sheet.heightIn - sheetMarginIn,
      document.sheet.heightIn,
    );

    items
      .filter((candidate) => candidate.id !== item.id)
      .forEach((candidate) => {
        const candidateBounds = getItemBounds(candidate);

        targetX.push(
          candidateBounds.minX,
          (candidateBounds.minX + candidateBounds.maxX) / 2,
          candidateBounds.maxX,
        );
        targetY.push(
          candidateBounds.minY,
          (candidateBounds.minY + candidateBounds.maxY) / 2,
          candidateBounds.maxY,
        );
      });
  }

  const xSnap = getBestSnap(sourceX, targetX);
  const ySnap = getBestSnap(sourceY, targetY);
  const guides: SnapGuideLine[] = [];

  if (xSnap) {
    guides.push({ orientation: "vertical", positionIn: xSnap.target });
  }

  if (ySnap) {
    guides.push({ orientation: "horizontal", positionIn: ySnap.target });
  }

  return {
    centerX: centerX + (xSnap?.delta ?? 0) * PREVIEW_PIXELS_PER_INCH,
    centerY: centerY + (ySnap?.delta ?? 0) * PREVIEW_PIXELS_PER_INCH,
    guides,
  };
}

function snapToGridLine(positionIn: number): number {
  return Math.round(positionIn / SNAP_GRID_IN) * SNAP_GRID_IN;
}

function getBestSnap(
  sourcePositions: number[],
  targetPositions: number[],
): { delta: number; target: number } | null {
  let bestSnap: { delta: number; target: number } | null = null;

  sourcePositions.forEach((source) => {
    targetPositions.forEach((target) => {
      const delta = target - source;

      if (Math.abs(delta) > SNAP_THRESHOLD_IN) {
        return;
      }

      if (!bestSnap || Math.abs(delta) < Math.abs(bestSnap.delta)) {
        bestSnap = { delta, target };
      }
    });
  });

  return bestSnap;
}

function GuideStatusChip({ viewState }: { viewState: SheetViewState }) {
  const snapTargets = [
    viewState.snapToGrid ? "grid" : null,
    viewState.snapToItems ? "decals" : null,
  ].filter(Boolean);

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 rounded border border-neutral-200 bg-white/90 px-2.5 py-1.5 text-[11px] font-medium text-neutral-600 shadow-sm">
      <span className="text-neutral-900">
        Snap {snapTargets.length > 0 ? snapTargets.join(" + ") : "off"}
      </span>
      <span className="mx-1.5 text-neutral-300">|</span>
      <span>Spacing {viewState.showSpacingGuides ? "on" : "off"}</span>
    </div>
  );
}

function SheetBackground({
  document,
  width,
  height,
}: {
  document: SheetDocument;
  width: number;
  height: number;
}) {
  if (document.settings.background.type === "solid") {
    return (
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={document.settings.background.color}
      />
    );
  }

  const squares: ReactElement[] = [];

  for (let y = 0; y < height; y += CHECKER_SIZE) {
    for (let x = 0; x < width; x += CHECKER_SIZE) {
      const isDark = (x / CHECKER_SIZE + y / CHECKER_SIZE) % 2 === 0;

      squares.push(
        <Rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={CHECKER_SIZE}
          height={CHECKER_SIZE}
          fill={isDark ? "#fafafa" : "#ffffff"}
          listening={false}
        />
      );
    }
  }

  return <>{squares}</>;
}

function SheetGrid({ width, height }: { width: number; height: number }) {
  const lines: ReactElement[] = [];
  const gridSize = PREVIEW_PIXELS_PER_INCH / 2;

  for (let x = 0; x <= width; x += gridSize) {
    const isMajor = Math.round(x) % PREVIEW_PIXELS_PER_INCH === 0;

    lines.push(
      <Line
        key={`v-${x}`}
        points={[x, 0, x, height]}
        stroke={isMajor ? "#d4d4d8" : "#e5e7eb"}
        strokeWidth={isMajor ? 0.75 : 0.4}
        opacity={isMajor ? 0.7 : 0.5}
        listening={false}
      />
    );
  }

  for (let y = 0; y <= height; y += gridSize) {
    const isMajor = Math.round(y) % PREVIEW_PIXELS_PER_INCH === 0;

    lines.push(
      <Line
        key={`h-${y}`}
        points={[0, y, width, y]}
        stroke={isMajor ? "#d4d4d8" : "#e5e7eb"}
        strokeWidth={isMajor ? 0.75 : 0.4}
        opacity={isMajor ? 0.7 : 0.5}
        listening={false}
      />
    );
  }

  return <>{lines}</>;
}

function BleedOverlay({ document }: { document: SheetDocument }) {
  const bleedIn = STICKER_SHEET_MVP_PROFILE.printRules.bleedIn;
  const inset = bleedIn * PREVIEW_PIXELS_PER_INCH;

  return (
    <Rect
      x={inset}
      y={inset}
      width={document.sheet.widthIn * PREVIEW_PIXELS_PER_INCH - inset * 2}
      height={document.sheet.heightIn * PREVIEW_PIXELS_PER_INCH - inset * 2}
      stroke="#f97316"
      strokeWidth={1.5}
      dash={[10, 6]}
      listening={false}
    />
  );
}

function SafeAreaOverlay({ document }: { document: SheetDocument }) {
  const marginIn = STICKER_SHEET_MVP_PROFILE.printRules.sheetEdgeMarginIn;
  const inset = marginIn * PREVIEW_PIXELS_PER_INCH;
  const printPixels = sheetSizeToPixels({
    widthIn: document.sheet.widthIn,
    heightIn: document.sheet.heightIn,
  });

  return (
    <>
      <Rect
        x={inset}
        y={inset}
        width={document.sheet.widthIn * PREVIEW_PIXELS_PER_INCH - inset * 2}
        height={document.sheet.heightIn * PREVIEW_PIXELS_PER_INCH - inset * 2}
        stroke="#2563eb"
        strokeWidth={1.5}
        listening={false}
      />
      <Text
        x={inset + 8}
        y={inset + 8}
        text={`${document.sheet.widthIn}" x ${document.sheet.heightIn}" | ${printPixels.widthPx} x ${printPixels.heightPx}px`}
        fontSize={12}
        fill="#1d4ed8"
        listening={false}
      />
    </>
  );
}

function SpacingGuideOverlay({ guides }: { guides: SpacingGuide[] }) {
  return (
    <>
      {guides.map((guide, index) => {
        const color = guide.isTight ? "#dc2626" : "#2563eb";
        const points =
          guide.orientation === "horizontal"
            ? [
                guide.fromIn * PREVIEW_PIXELS_PER_INCH,
                guide.crossIn * PREVIEW_PIXELS_PER_INCH,
                guide.toIn * PREVIEW_PIXELS_PER_INCH,
                guide.crossIn * PREVIEW_PIXELS_PER_INCH,
              ]
            : [
                guide.crossIn * PREVIEW_PIXELS_PER_INCH,
                guide.fromIn * PREVIEW_PIXELS_PER_INCH,
                guide.crossIn * PREVIEW_PIXELS_PER_INCH,
                guide.toIn * PREVIEW_PIXELS_PER_INCH,
              ];
        const startTick =
          guide.orientation === "horizontal"
            ? [
                guide.fromIn * PREVIEW_PIXELS_PER_INCH,
                guide.crossIn * PREVIEW_PIXELS_PER_INCH - DIMENSION_TICK_PX / 2,
                guide.fromIn * PREVIEW_PIXELS_PER_INCH,
                guide.crossIn * PREVIEW_PIXELS_PER_INCH + DIMENSION_TICK_PX / 2,
              ]
            : [
                guide.crossIn * PREVIEW_PIXELS_PER_INCH - DIMENSION_TICK_PX / 2,
                guide.fromIn * PREVIEW_PIXELS_PER_INCH,
                guide.crossIn * PREVIEW_PIXELS_PER_INCH + DIMENSION_TICK_PX / 2,
                guide.fromIn * PREVIEW_PIXELS_PER_INCH,
              ];
        const endTick =
          guide.orientation === "horizontal"
            ? [
                guide.toIn * PREVIEW_PIXELS_PER_INCH,
                guide.crossIn * PREVIEW_PIXELS_PER_INCH - DIMENSION_TICK_PX / 2,
                guide.toIn * PREVIEW_PIXELS_PER_INCH,
                guide.crossIn * PREVIEW_PIXELS_PER_INCH + DIMENSION_TICK_PX / 2,
              ]
            : [
                guide.crossIn * PREVIEW_PIXELS_PER_INCH - DIMENSION_TICK_PX / 2,
                guide.toIn * PREVIEW_PIXELS_PER_INCH,
                guide.crossIn * PREVIEW_PIXELS_PER_INCH + DIMENSION_TICK_PX / 2,
                guide.toIn * PREVIEW_PIXELS_PER_INCH,
              ];
        const labelText = `${roundToHundredth(guide.distanceIn)}"`;
        const labelWidth = Math.max(38, labelText.length * 7 + 10);
        const labelHeight = 18;
        const labelX =
          guide.orientation === "horizontal"
            ? ((guide.fromIn + guide.toIn) / 2) * PREVIEW_PIXELS_PER_INCH -
              labelWidth / 2
            : guide.crossIn * PREVIEW_PIXELS_PER_INCH + 8;
        const labelY =
          guide.orientation === "horizontal"
            ? guide.crossIn * PREVIEW_PIXELS_PER_INCH - labelHeight - 6
            : ((guide.fromIn + guide.toIn) / 2) * PREVIEW_PIXELS_PER_INCH -
              labelHeight / 2;

        return (
          <Group key={`${guide.orientation}-${index}`}>
            <Line
              points={points}
              stroke={color}
              strokeWidth={1.25}
              opacity={0.9}
            />
            <Line points={startTick} stroke={color} strokeWidth={1.25} />
            <Line points={endTick} stroke={color} strokeWidth={1.25} />
            <Rect
              x={labelX}
              y={labelY}
              width={labelWidth}
              height={labelHeight}
              fill="white"
              opacity={0.88}
              cornerRadius={3}
            />
            <Text
              x={labelX + 5}
              y={labelY + 3}
              text={labelText}
              fontSize={11}
              fontStyle="bold"
              fill={color}
            />
          </Group>
        );
      })}
    </>
  );
}

function SnapGuideOverlay({
  guides,
  height,
  width,
}: {
  guides: SnapGuideLine[];
  height: number;
  width: number;
}) {
  return (
    <>
      {guides.map((guide, index) => {
        const position = guide.positionIn * PREVIEW_PIXELS_PER_INCH;
        const points =
          guide.orientation === "vertical"
            ? [position, 0, position, height * PREVIEW_PIXELS_PER_INCH]
            : [0, position, width * PREVIEW_PIXELS_PER_INCH, position];

        return (
          <Line
            key={`${guide.orientation}-${guide.positionIn}-${index}`}
            points={points}
            stroke="#7c3aed"
            strokeWidth={1.25}
            dash={[10, 6]}
            opacity={0.8}
          />
        );
      })}
    </>
  );
}

function getSpacingGuides(
  document: SheetDocument,
  selectedItemIds: string[],
): SpacingGuide[] {
  if (selectedItemIds.length === 0) {
    return [];
  }

  const selectedIds = new Set(selectedItemIds);
  const itemBounds = document.items.map((item) => ({
    item,
    bounds: getItemBounds(item),
  }));
  const requiredSpacingIn = STICKER_SHEET_MVP_PROFILE.printRules.stickerSpacingIn;
  const visibleSpacingIn = Math.max(requiredSpacingIn * 3, 0.75);
  const guides: SpacingGuide[] = [];

  for (let firstIndex = 0; firstIndex < itemBounds.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < itemBounds.length;
      secondIndex += 1
    ) {
      const first = itemBounds[firstIndex];
      const second = itemBounds[secondIndex];

      if (!selectedIds.has(first.item.id) && !selectedIds.has(second.item.id)) {
        continue;
      }

      const guide = getPairSpacingGuide(
        first.bounds,
        second.bounds,
        requiredSpacingIn,
      );

      if (!guide) {
        continue;
      }

      if (guide.isTight || guide.distanceIn <= visibleSpacingIn) {
        guides.push(guide);
      }
    }
  }

  return guides
    .sort(
      (a, b) =>
        Number(b.isTight) - Number(a.isTight) ||
        a.distanceIn - b.distanceIn,
    )
    .slice(0, SPACING_GUIDE_LIMIT);
}

function getPairSpacingGuide(
  firstBounds: ReturnType<typeof getItemBounds>,
  secondBounds: ReturnType<typeof getItemBounds>,
  requiredSpacingIn: number,
): SpacingGuide | null {
  const horizontalOverlap =
    Math.min(firstBounds.maxY, secondBounds.maxY) -
    Math.max(firstBounds.minY, secondBounds.minY);
  const verticalOverlap =
    Math.min(firstBounds.maxX, secondBounds.maxX) -
    Math.max(firstBounds.minX, secondBounds.minX);

  if (horizontalOverlap > 0) {
    const [leftBounds, rightBounds] =
      firstBounds.maxX <= secondBounds.minX
        ? [firstBounds, secondBounds]
        : [secondBounds, firstBounds];
    const distanceIn = rightBounds.minX - leftBounds.maxX;

    if (distanceIn >= 0) {
      return {
        orientation: "horizontal",
        fromIn: leftBounds.maxX,
        toIn: rightBounds.minX,
        crossIn:
          (Math.max(leftBounds.minY, rightBounds.minY) +
            Math.min(leftBounds.maxY, rightBounds.maxY)) /
          2,
        distanceIn,
        isTight: distanceIn < requiredSpacingIn,
      };
    }
  }

  if (verticalOverlap > 0) {
    const [topBounds, bottomBounds] =
      firstBounds.maxY <= secondBounds.minY
        ? [firstBounds, secondBounds]
        : [secondBounds, firstBounds];
    const distanceIn = bottomBounds.minY - topBounds.maxY;

    if (distanceIn >= 0) {
      return {
        orientation: "vertical",
        fromIn: topBounds.maxY,
        toIn: bottomBounds.minY,
        crossIn:
          (Math.max(topBounds.minX, bottomBounds.minX) +
            Math.min(topBounds.maxX, bottomBounds.maxX)) /
          2,
        distanceIn,
        isTight: distanceIn < requiredSpacingIn,
      };
    }
  }

  return null;
}

function roundToHundredth(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}
