// src/components/ImageUploader/ImageUploader.tsx

// Controls
import TransformToolbar from "../ImageUploader/Controls/TransformToolbar";
import CropToolbar from "../ImageUploader/Controls/CropToolbar";

// ui
import { useCallback, useRef, useState } from "react";
import type { ReactElement } from "react";
import {
  ArrowDownTrayIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  CloudArrowUpIcon,
  QuestionMarkCircleIcon,
  ScissorsIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import Dropzone from "../ImageUploader/ui/Dropzone";
import Spinner from "../ImageUploader/ui/Spinner";
import UploadInfo from "../ImageUploader/ui/UploadInfo";
import GangSheetCanvas from "./Controls/GangSheetCanvas";
import { showToast } from "../ImageUploader/utils/showToast";
import { useCanvasExport } from "./hooks/useCanvasExport";
import { useImageHistory } from "./hooks/useImageHistory";
import { useImageHotkeys } from "./hooks/useImageHotkeys";
import { useImageTransforms } from "./hooks/useImageTransforms";
import { useImageUpload } from "./hooks/useImageUpload";

// Konva
import type Konva from "konva";

import ShortcutHelpModal from "../ImageUploader/ui/ShortcutHelpModal";

import type { CropRect } from "../../types";

const actionButtonClass =
  "inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm transition hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40";

const dangerButtonClass =
  "inline-flex h-10 w-10 items-center justify-center rounded-md border border-red-200 bg-white text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40";

const primaryButtonClass =
  "inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-800 bg-gray-900 text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40";

export default function ImageUploader(): ReactElement {
  const [hasCropped, setHasCropped] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [imageNodeRef, setImageNodeRef] = useState<Konva.Image | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const stageRef = useRef<Konva.Stage | null>(null);

  const {
    canRedo,
    canUndo,
    images: uploadedImages,
    redo: handleRedo,
    undo: handleUndo,
    updateImage: handleUpdateImage,
    updateImages,
  } = useImageHistory();

  const { download: handleDownload, uploadToCloud: handleCloudUpload } =
    useCanvasExport({
      stageRef,
      setShowGrid,
    });

  const { error, loading, onDrop, previewUrl } = useImageUpload({
    updateImages,
    onUploadStart: () => {
      setHasCropped(false);
      setShowCropper(false);
    },
  });

  const handleDelete = useCallback(() => {
    if (!selectedId) return;
    updateImages((prev) => prev.filter((img) => img.id !== selectedId));
    setSelectedId(null);
    showToast("Image deleted", { id: "delete-toast" });
  }, [selectedId, updateImages]);

  const {
    flipSelectedHorizontal: handleFlipHorizontal,
    flipSelectedVertical: handleFlipVertical,
    resetSelectedTransforms: handleResetTransforms,
    rotateSelected: handleRotate,
  } = useImageTransforms({
    images: uploadedImages,
    selectedId,
    updateImage: handleUpdateImage,
  });

  useImageHotkeys({
    onDelete: handleDelete,
    onDeselect: () => setSelectedId(null),
    onFlipHorizontal: handleFlipHorizontal,
    onFlipVertical: handleFlipVertical,
    onHelp: () => setShowHelp(true),
    onRedo: handleRedo,
    onResetTransforms: handleResetTransforms,
    onRotate: handleRotate,
    onUndo: handleUndo,
  });

  return (
    <div className="mx-auto w-full max-w-6xl p-4">
      <div className="flex flex-col items-center gap-4">
        <section className="w-full space-y-3" aria-label="Upload image">
          <Dropzone onDrop={onDrop} disabled={loading} />
          {loading && <Spinner />}
          <UploadInfo />
        </section>

        {error && (
          <div className="w-full rounded border border-red-200 bg-red-50 px-3 py-2 text-center text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <section className="w-full overflow-x-auto" aria-label="Canvas">
          <GangSheetCanvas
            images={uploadedImages}
            onUpdateImage={handleUpdateImage}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            cropRect={cropRect}
            setCropRect={setCropRect}
            showCropper={showCropper}
            setImageNodeRef={setImageNodeRef}
            stageRef={stageRef}
            showGrid={showGrid}
            setShowGrid={setShowGrid}
          />
        </section>

        <TransformToolbar
          isImageSelected={!!selectedId}
          onFlipHorizontal={handleFlipHorizontal}
          onFlipVertical={handleFlipVertical}
          onRotate={handleRotate}
          onReset={handleResetTransforms}
        />

        {previewUrl && !hasCropped && !showCropper && (
          <button
            type="button"
            onClick={() => {
              setShowCropper(true);
              setCropRect(null);
              setSelectedId(
                (prev) =>
                  prev ?? uploadedImages[uploadedImages.length - 1]?.id ?? null
              );
            }}
            title="Crop Image"
            aria-label="Crop Image"
            className={primaryButtonClass}
          >
            <ScissorsIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        )}

        {showCropper && (
          <CropToolbar
            cropRect={cropRect}
            selectedId={selectedId}
            uploadedImages={uploadedImages}
            updateImages={updateImages}
            setHasCropped={setHasCropped}
            setShowCropper={setShowCropper}
            setCropRect={setCropRect}
            setSelectedId={setSelectedId}
            hasCropped={hasCropped}
            imageNode={imageNodeRef}
          />
        )}

        <div
          className="flex w-full flex-wrap items-center justify-center gap-2 border-t border-gray-200 px-3 pt-3"
          role="toolbar"
          aria-label="Editor actions"
        >
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            className={actionButtonClass}
          >
            <ArrowUturnLeftIcon className="h-5 w-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
            className={actionButtonClass}
          >
            <ArrowUturnRightIcon className="h-5 w-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={!selectedId}
            title="Remove Image (Delete)"
            aria-label="Remove Image"
            className={dangerButtonClass}
          >
            <TrashIcon className="h-5 w-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setShowHelp(true)}
            title="Show Keyboard Shortcuts (?)"
            aria-label="Show Keyboard Shortcuts"
            className={actionButtonClass}
          >
            <QuestionMarkCircleIcon className="h-5 w-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={handleDownload}
            title="Download Final Image"
            aria-label="Download PNG"
            className={actionButtonClass}
          >
            <ArrowDownTrayIcon className="h-5 w-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={handleCloudUpload}
            title="Save to Cloud"
            aria-label="Save to Cloud"
            className={actionButtonClass}
          >
            <CloudArrowUpIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <ShortcutHelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
