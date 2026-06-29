import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
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
import { STICKER_SHEET_MVP_PROFILE, sheetSizeToPixels } from "../../domain/print";
import type {
  SheetAsset,
  SheetDocument,
  SheetItem,
  SheetViewState,
} from "../../domain/print";

const PREVIEW_PIXELS_PER_INCH = 96;
const CHECKER_SIZE = 16;
const MIN_ITEM_SIZE_PX = 24;
const CUTLINE_PADDING_PX = 6;

interface StickerSheetCanvasProps {
  document: SheetDocument;
  viewState: SheetViewState;
  onSelectItem: (itemId: string) => void;
  onClearSelection: () => void;
  onUpdateItem: (itemId: string, patch: Partial<Omit<SheetItem, "id">>) => void;
}

export interface StickerSheetCanvasHandle {
  exportPreviewPng: () => string | null;
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
  const assetsById = useMemo(
    () => new Map(document.assets.map((asset) => [asset.id, asset])),
    [document.assets]
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
      <div className="mx-auto w-fit rounded-sm border border-neutral-300 bg-white shadow-sm">
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
                  item={item}
                  isSelected={viewState.selectedItemIds.includes(item.id)}
                  showCutline={viewState.showCutlines}
                  onSelect={() => onSelectItem(item.id)}
                  onUpdate={(patch) => onUpdateItem(item.id, patch)}
                />
              );
            })}
          </Layer>
        </Stage>
      </div>
    </div>
  );
});

function StickerItemNode({
  asset,
  item,
  isSelected,
  showCutline,
  onSelect,
  onUpdate,
}: {
  asset: SheetAsset;
  item: SheetItem;
  isSelected: boolean;
  showCutline: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<Omit<SheetItem, "id">>) => void;
}) {
  const imageRef = useRef<Konva.Image>(null);
  const placeholderRef = useRef<Konva.Rect>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [image] = useImage(asset.previewUrl ?? asset.sourceUrl);
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
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
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

function normalizeRotation(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
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
          fill={isDark ? "#f4f4f5" : "#ffffff"}
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
    lines.push(
      <Line
        key={`v-${x}`}
        points={[x, 0, x, height]}
        stroke="#d4d4d8"
        strokeWidth={0.75}
        listening={false}
      />
    );
  }

  for (let y = 0; y <= height; y += gridSize) {
    lines.push(
      <Line
        key={`h-${y}`}
        points={[0, y, width, y]}
        stroke="#d4d4d8"
        strokeWidth={0.75}
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
