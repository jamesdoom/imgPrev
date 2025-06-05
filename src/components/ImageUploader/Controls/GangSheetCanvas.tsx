// src/components/ImageUploader/Controls/GangSheetCanvas.tsx

import { useEffect, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Transformer,
  Line,
  Rect,
} from "react-konva";
import Konva from "konva";
import { useImage } from "../../../hooks/useImage";

interface UploadedImage {
  id: string;
  url: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  width: number;
  height: number;
  rotation?: number;
}

const GRID_SIZE = 50;

function DraggableImage({
  image,
  isSelected,
  onSelect,
  onChange,
  showCropper,
  forwardRef,
}: {
  image: UploadedImage;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: Partial<UploadedImage>) => void;
  showCropper: boolean;
  forwardRef?: (node: Konva.Image | null) => void;
}) {
  const shapeRef = useRef<Konva.Image>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [img] = useImage(image.url);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  useEffect(() => {
    if (isSelected && forwardRef) {
      forwardRef(shapeRef.current);
    }
  }, [isSelected, forwardRef]);

  useEffect(() => {
    console.log("🖼️ Rendering image:", {
      id: image.id,
      x: image.x,
      y: image.y,
      width: image.width,
      height: image.height,
      scaleX: image.scaleX,
      scaleY: image.scaleY,
      rotation: image.rotation ?? 0,
    });
  }, [image]);

  return (
    <>
      <KonvaImage
        image={img || undefined}
        x={image.x}
        y={image.y}
        offsetX={image.width / 2}
        offsetY={image.height / 2}
        scaleX={image.scaleX}
        scaleY={image.scaleY}
        rotation={image.rotation ?? 0}
        draggable
        ref={shapeRef}
        onClick={() => {
          if (!showCropper) {
            onSelect();
            shapeRef.current?.moveToTop();
            shapeRef.current?.getLayer()?.batchDraw();
          }
        }}
        onTap={() => {
          onSelect();
          shapeRef.current?.moveToTop();
          shapeRef.current?.getLayer()?.batchDraw();
        }}
        onDragEnd={(e) => {
          const newX = e.target.x();
          const newY = e.target.y();
          console.log("🎯 Image dragged:", { id: image.id, x: newX, y: newY });
          onChange({ x: newX, y: newY });
        }}
        onTransformEnd={() => {
          const node = shapeRef.current;
          if (node) {
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            console.log("🌀 Transform ended for:", {
              id: image.id,
              scaleX,
              scaleY,
            });
            onChange({ scaleX, scaleY });
            node.scaleX(1);
            node.scaleY(1);
          }
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 20 || newBox.height < 20) return oldBox;
            return newBox;
          }}
          rotateEnabled={false}
          anchorSize={8}
        />
      )}
    </>
  );
}

function Grid({ width, height }: { width: number; height: number }) {
  const lines = [];

  for (let i = 0; i < width / GRID_SIZE; i++) {
    lines.push(
      <Line
        key={`v-${i}`}
        points={[i * GRID_SIZE, 0, i * GRID_SIZE, height]}
        stroke="#eee"
        strokeWidth={1}
      />
    );
  }

  for (let j = 0; j < height / GRID_SIZE; j++) {
    lines.push(
      <Line
        key={`h-${j}`}
        points={[0, j * GRID_SIZE, width, j * GRID_SIZE]}
        stroke="#eee"
        strokeWidth={1}
      />
    );
  }

  return <>{lines}</>;
}

function getCanvasBounds(images: UploadedImage[]) {
  if (images.length === 0) return { width: 800, height: 800 };

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  images.forEach((img) => {
    const scaledWidth = img.width * Math.abs(img.scaleX);
    const scaledHeight = img.height * Math.abs(img.scaleY);

    const left = img.x - scaledWidth / 2;
    const right = img.x + scaledWidth / 2;
    const top = img.y - scaledHeight / 2;
    const bottom = img.y + scaledHeight / 2;

    minX = Math.min(minX, left);
    maxX = Math.max(maxX, right);
    minY = Math.min(minY, top);
    maxY = Math.max(maxY, bottom);
  });

  const width = Math.max(maxX - minX + 100, 800);
  const height = Math.max(maxY - minY + 100, 800);

  return { width, height };
}

export default function GangSheetCanvas({
  images,
  onUpdateImage,
  selectedId,
  setSelectedId,
  cropRect,
  setCropRect,
  showCropper,
  setImageNodeRef,
}: {
  images: UploadedImage[];
  onUpdateImage: (id: string, updates: Partial<UploadedImage>) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  cropRect: { x: number; y: number; width: number; height: number } | null;
  setCropRect: (
    rect: { x: number; y: number; width: number; height: number } | null
  ) => void;
  showCropper: boolean;
  setImageNodeRef?: (node: Konva.Image | null) => void;
}) {
  const [showGrid, setShowGrid] = useState(true);
  const [stageScale, setStageScale] = useState(1);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });
  const isDrawing = useRef(false);
  const startPoint = useRef({ x: 0, y: 0 });

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    const scaleBy = 1.05;
    const oldScale = stageScale;
    const pointer = e.target.getStage()?.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stagePosition.x) / oldScale,
      y: (pointer.y - stagePosition.y) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const rawScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const newScale = Math.max(0.3, Math.min(3, rawScale));

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    setStageScale(newScale);
    setStagePosition(newPos);
  };

  const canvasSize = getCanvasBounds(images);

  useEffect(() => {
    console.log("📐 Canvas bounds:", canvasSize);
  }, [canvasSize]);

  return (
    <div className="flex flex-col items-center gap-4">
      <Stage
        width={canvasSize.width}
        height={canvasSize.height}
        className="border border-gray-400"
        listening={!showCropper}
        draggable={!showCropper}
        onWheel={handleWheel}
        onDragEnd={(e) => setStagePosition(e.currentTarget.position())}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePosition.x}
        y={stagePosition.y}
        onMouseDown={(e) => {
          console.log("👆 onMouseDown triggered");
          if (!showCropper) {
            console.log("Cropper is not active");
            return;
          }

          const stage = e.target.getStage();
          if (!stage) {
            console.warn("No stage found.");
            return;
          }

          const pointer = stage.getPointerPosition();
          if (!pointer) {
            console.warn("Pointer is null.");
            return;
          }

          console.log("📌 Pointer (screen coords):", pointer);
          console.log("📐 Stage position:", stage.x(), stage.y());
          console.log("🔍 Stage scale:", stage.scaleX(), stage.scaleY());

          const transform = stage.getAbsoluteTransform().copy().invert();
          const pos = transform.point(pointer);

          console.log("✅ Crop start at:", pos);

          isDrawing.current = true;
          startPoint.current = pos;
          setCropRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
        }}
        onMouseMove={(e) => {
          if (!showCropper || !isDrawing.current) return;

          const stage = e.target.getStage();
          if (!stage) return;

          const pointer = stage.getPointerPosition();
          if (!pointer) return;

          const transform = stage.getAbsoluteTransform().copy().invert();
          const pos = transform.point(pointer);

          const sx = startPoint.current.x;
          const sy = startPoint.current.y;
          const ex = pos.x;
          const ey = pos.y;

          const x = Math.min(sx, ex);
          const y = Math.min(sy, ey);
          const width = Math.abs(ex - sx);
          const height = Math.abs(ey - sy);

          console.log("📏 Crop dragging to:", { x, y, width, height });

          setCropRect({ x, y, width, height });
        }}
        onMouseUp={() => {
          console.log("🖱️ Mouse up – crop complete");
          isDrawing.current = false;
        }}
      >
        {showGrid && (
          <Layer>
            <Grid width={canvasSize.width} height={canvasSize.height} />
          </Layer>
        )}
        <Layer>
          {images.map((img) => (
            <DraggableImage
              key={img.id}
              image={img}
              isSelected={img.id === selectedId}
              onSelect={() => setSelectedId(img.id)}
              onChange={(attrs) => onUpdateImage(img.id, attrs)}
              showCropper={showCropper}
              forwardRef={img.id === selectedId ? setImageNodeRef : undefined}
            />
          ))}

          {cropRect && cropRect.width > 0 && cropRect.height > 0 && (
            <Rect
              x={cropRect.x}
              y={cropRect.y}
              width={cropRect.width}
              height={cropRect.height}
              stroke="red"
              dash={[6, 4]}
            />
          )}
        </Layer>
      </Stage>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showGrid}
          onChange={() => setShowGrid((prev) => !prev)}
        />
        Show Grid
      </label>
    </div>
  );
}
