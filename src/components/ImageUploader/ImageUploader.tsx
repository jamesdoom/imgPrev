// src/components/ImageUploader/ImageUploader.tsx

// Controls
import TransformToolbar from "../ImageUploader/Controls/TransformToolbar";
import CropToolbar from "../ImageUploader/Controls/CropToolbar";

// ui
import { useCallback, useState } from "react";
import Dropzone from "../ImageUploader/ui/Dropzone";
import Spinner from "../ImageUploader/ui/Spinner";
import UploadInfo from "../ImageUploader/ui/UploadInfo";
import GangSheetCanvas from "./Controls/GangSheetCanvas";
import toast from "react-hot-toast";
import { useHotkeys } from "react-hotkeys-hook";

// utils
import { getDpi } from "../ImageUploader/utils/getDpi";

// Konva
import Konva from "konva";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const MAX_FILE_SIZE = 21 * 1024 * 1024;

export default function ImageUploader() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasCropped, setHasCropped] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [dpi, setDpi] = useState<number | null>(null);
  const [cropRect, setCropRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [uploadedImages, setUploadedImages] = useState<
    {
      id: string;
      url: string;
      x: number;
      y: number;
      scaleX: number;
      scaleY: number;
      width: number;
      height: number;
      rotation?: number;
    }[]
  >([]);
  const [history, setHistory] = useState<(typeof uploadedImages)[]>([]);
  const [redoStack, setRedoStack] = useState<(typeof uploadedImages)[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [imageNodeRef, setImageNodeRef] = useState<Konva.Image | null>(null);

  const updateImages = useCallback(
    (updater: (prev: typeof uploadedImages) => typeof uploadedImages) => {
      setUploadedImages((prev) => {
        const next = updater(prev);
        setHistory((h) => [...h.slice(-19), prev]);
        setRedoStack([]);
        return next;
      });
    },
    []
  );

  const handleUpdateImage = useCallback(
    (
      id: string,
      updates: Partial<{
        id: string;
        url: string;
        x: number;
        y: number;
        scaleX: number;
        scaleY: number;
        rotation?: number;
      }>
    ) => {
      updateImages((prev) =>
        prev.map((img) => (img.id === id ? { ...img, ...updates } : img))
      );
    },
    [updateImages]
  );

  const handleUndo = useCallback(() => {
    setUploadedImages((current) => {
      if (history.length === 0) return current;
      const previous = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      setRedoStack((r) => [current, ...r]);
      toast("Undo performed", { icon: "↩️", id: "undo-toast" });
      return previous;
    });
  }, [history]);

  const handleRedo = useCallback(() => {
    setUploadedImages((current) => {
      if (redoStack.length === 0) return current;
      const next = redoStack[0];
      setRedoStack((r) => r.slice(1));
      setHistory((h) => [...h, current]);
      toast("Redo applied", { icon: "↪️", id: "redo-toast" });
      return next;
    });
  }, [redoStack]);

  const handleDelete = useCallback(() => {
    if (!selectedId) return;
    updateImages((prev) => prev.filter((img) => img.id !== selectedId));
    setSelectedId(null);
    toast("Image deleted", { icon: "🗑️", id: "delete-toast" });
  }, [selectedId, updateImages]);

  useHotkeys("ctrl+z, cmd+z", handleUndo, [handleUndo]);
  useHotkeys("ctrl+y, cmd+shift+y", handleRedo, [handleRedo]);
  useHotkeys("delete, backspace", handleDelete, [handleDelete]);
  useHotkeys("esc", () => setSelectedId(null), [setSelectedId]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      setError(null);
      setPreviewUrl(null);
      setFile(null);
      setHasCropped(false);
      setShowCropper(false);

      if (!file) return;

      if (!file.type.startsWith("image/")) {
        setError("Only image files are allowed.");
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setError("Image must be 21MB or smaller.");
        return;
      }

      try {
        setLoading(true);
        const formData = new FormData();
        formData.append("image", file);

        const response = await fetch(`${API_BASE_URL}/upload`, {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        if (!response.ok || !data.previewUrl) {
          throw new Error(data.error || "Upload failed");
        }

        const url = `${API_BASE_URL}${data.previewUrl}`;

        const img = new Image();
        img.src = url;
        await img.decode();

        const width = img.naturalWidth;
        const height = img.naturalHeight;

        const dpiValue = await getDpi(file);
        console.log("Detected DPI:", dpiValue);
        setPreviewUrl(url);
        setFile(file);
        setDpi(dpiValue ?? null);
        updateImages((prev) => [
          ...prev,
          {
            id: url,
            url,
            x: 400,
            y: 400,
            scaleX: 0.5,
            scaleY: 0.5,
            width,
            height,
          },
        ]);
      } catch (err) {
        console.error("Error processing image:", err);
        setError("Something went wrong while processing the image.");
      } finally {
        setLoading(false);
      }
    },
    [updateImages]
  );

  return (
    <div className="w-full max-w-5xl mx-auto p-4">
      <div className="flex flex-col items-center gap-4">
        <Dropzone onDrop={onDrop} disabled={loading} />
        {loading && <Spinner />}
        <UploadInfo />

        {error && (
          <div className="mt-3 text-red-600 font-medium bg-red-100 p-2 rounded">
            {error}
          </div>
        )}

        <GangSheetCanvas
          images={uploadedImages}
          onUpdateImage={handleUpdateImage}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          cropRect={cropRect}
          setCropRect={setCropRect}
          showCropper={showCropper}
          setImageNodeRef={setImageNodeRef}
        />

        <TransformToolbar
          selectedId={selectedId}
          uploadedImages={uploadedImages}
          onUpdateImage={handleUpdateImage}
        />

        {previewUrl && !hasCropped && !showCropper && (
          <button
            onClick={() => {
              setShowCropper(true);
              setCropRect(null);
              setSelectedId(
                (prev) => prev ?? uploadedImages.at(-1)?.id ?? null
              );
            }}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Crop Image
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

        <div className="flex justify-center gap-4 mt-4">
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            title="Undo (Ctrl+Z)"
            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Undo
          </button>

          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title="Redo (Ctrl+Y)"
            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Redo
          </button>

          <button
            onClick={handleDelete}
            disabled={!selectedId}
            title="Remove Image (Delete or Backspace)"
            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            Remove Image
          </button>
        </div>
      </div>
    </div>
  );
}
