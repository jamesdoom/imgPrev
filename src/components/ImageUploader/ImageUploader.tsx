// ImageUploader.tsx

// Controls
import AspectRatioControl from "../ImageUploader/Controls/AspectRatioControl";
import CropControl from "../ImageUploader/Controls/CropControl";
import TransformControl from "../ImageUploader/Controls/TransformControl";

// ui
import CropperPreview from "../ImageUploader/ui/CropperPreview";
import { useCallback, useState } from "react";
import type { Area } from "react-easy-crop";
import Dropzone from "../ImageUploader/ui/Dropzone";
import ImagePreview from "../ImageUploader/ui/ImagePreview";
import Spinner from "../ImageUploader/ui/Spinner";
import UploadInfo from "../ImageUploader/ui/UploadInfo";

// utils
import { getDpi } from "../ImageUploader/utils/getDpi";

const MAX_FILE_SIZE = 21 * 1024 * 1024;

export default function ImageUploader() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasCropped, setHasCropped] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number>(1);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [croppingImageUrl, setCroppingImageUrl] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [dpi, setDpi] = useState<number | null>(null);

  const onCropComplete = useCallback((_: Area, croppedArea: Area) => {
    setCroppedAreaPixels(croppedArea);
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    setError(null);
    setPreviewUrl(null);
    setFile(null);
    setCroppingImageUrl(null);
    setHasCropped(false);
    setShowComparison(false);

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

      const response = await fetch("http://localhost:4000/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || !data.previewUrl) {
        throw new Error(data.error || "Upload failed");
      }

      const origin = window.location.origin.replace("5173", "4000");
      const url = `${origin}${data.previewUrl}`;

      const dpiValue = await getDpi(file);
      console.log("Detected DPI:", dpiValue);
      setPreviewUrl(url);
      setOriginalUrl(url);
      setFile(file);
      setDpi(dpiValue ?? null);
    } catch (err) {
      console.error("Error processing image:", err);
      setError("Something went wrong while processing the image.");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="max-w-md mx-auto p-4">
      <Dropzone onDrop={onDrop} disabled={loading} />
      {loading && <Spinner />}
      <UploadInfo />

      {error && (
        <div className="mt-3 text-red-600 font-medium bg-red-100 p-2 rounded">
          {error}
        </div>
      )}

      <TransformControl
        file={file}
        previewUrl={previewUrl}
        croppingImageUrl={croppingImageUrl}
        rotation={rotation}
        flipX={flipX}
        flipY={flipY}
        setRotation={setRotation}
        setFlipX={setFlipX}
        setFlipY={setFlipY}
        setPreviewUrl={setPreviewUrl}
        setCroppingImageUrl={setCroppingImageUrl}
        setHasCropped={setHasCropped}
      />

      {croppingImageUrl && (
        <AspectRatioControl
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
        />
      )}

      {previewUrl && croppingImageUrl && (
        <CropperPreview
          image={croppingImageUrl}
          crop={crop}
          zoom={zoom}
          aspectRatio={aspectRatio}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      )}

      <ImagePreview
        previewUrl={previewUrl}
        hasCropped={hasCropped}
        croppingImageUrl={croppingImageUrl}
        file={file}
        dpi={dpi}
      />

      <CropControl
        previewUrl={previewUrl}
        croppingImageUrl={croppingImageUrl}
        hasCropped={hasCropped}
        originalUrl={originalUrl}
        setCroppingImageUrl={setCroppingImageUrl}
        setHasCropped={setHasCropped}
        setPreviewUrl={setPreviewUrl}
        setShowComparison={setShowComparison}
        file={file}
        croppedAreaPixels={croppedAreaPixels}
      />

      {showComparison && originalUrl && (
        <div className="mt-4">
          <h3 className="text-sm font-medium mb-1 text-gray-600">
            Original Image
          </h3>
          <img
            src={originalUrl}
            alt="Original"
            className="rounded shadow w-full"
            loading="lazy"
          />
        </div>
      )}

      {file && (
        <div className="mt-4">
          <button
            onClick={() => {
              setPreviewUrl(null);
              setError(null);
              setFile(null);
              setOriginalUrl(null);
              setCroppingImageUrl(null);
              setHasCropped(false);
              setShowComparison(false);
            }}
            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
          >
            Remove Image
          </button>
        </div>
      )}
    </div>
  );
}
