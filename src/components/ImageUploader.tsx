// ImageUploader.tsx

import { useCallback, useState } from "react";
import type { Area } from "react-easy-crop";
import { resizeImage } from "./utils/resizeImage";
import { cropImage } from "./utils/cropImage";
import Dropzone from "./ImageUploader/Dropzone";
import Spinner from "./ImageUploader/Spinner";
import UploadInfo from "./ImageUploader/UploadInfo";
import FileInfo from "./ImageUploader/FileInfo";
import TransformButtons from "./ImageUploader/Controls/TransformButtons";
import AspectRatioButtons from "./ImageUploader/Controls/AspectRatioButtons";
import CropperPreview from "./ImageUploader/CropperPreview";
import CropButtons from "./ImageUploader/Controls/CropButtons";
import ImagePreview from "./ImageUploader/ImagePreview";
import { getDpi } from "./utils/getDpi";

const MAX_FILE_SIZE = 21 * 1024 * 1024;

export default function ImageUploader() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
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
  const [useServer, setUseServer] = useState(true); // Toggle state

  const onCropComplete = useCallback((_: Area, croppedArea: Area) => {
    setCroppedAreaPixels(croppedArea);
  }, []);

  const handleCrop = async () => {
    if (!previewUrl || !croppedAreaPixels || !file) return;

    try {
      setLoading(true);

      if (useServer) {
        setCroppingImageUrl(null);
        const formData = new FormData();

        formData.append("image", file);
        formData.append("cropX", Math.round(croppedAreaPixels.x).toString());
        formData.append("cropY", Math.round(croppedAreaPixels.y).toString());
        formData.append(
          "cropWidth",
          Math.round(croppedAreaPixels.width).toString()
        );
        formData.append(
          "cropHeight",
          Math.round(croppedAreaPixels.height).toString()
        );

        const img = new Image();
        img.src = previewUrl;
        await img.decode(); // Wait for image to load

        formData.append("previewWidth", img.naturalWidth.toString());
        formData.append("previewHeight", img.naturalHeight.toString());

        const response = await fetch("http://localhost:4000/upload", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        if (!response.ok || !data.previewUrl) {
          throw new Error(data.error || "Crop failed on server.");
        }

        const origin = window.location.origin.replace("5173", "4000");
        setPreviewUrl(`${origin}${data.previewUrl}`);
        console.log("Final previewUrl:", `${origin}${data.previewUrl}`);
        setCroppingImageUrl(null);
        setHasCropped(true);
      } else {
        const { url, blob } = await cropImage(previewUrl, croppedAreaPixels);
        setPreviewUrl(url);
        setCroppedBlob(blob);
        setCroppingImageUrl(null);
        setHasCropped(true);
      }
    } catch (err) {
      console.error("Crop error:", err);
      setError("Failed to crop image");
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
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
        let url: string;

        if (useServer) {
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
          url = `${origin}${data.previewUrl}`;
        } else {
          url = await resizeImage(file, 512, 0, false, false);
        }

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
    },
    [useServer]
  );

  return (
    <div className="max-w-md mx-auto p-4">
      {/* Mode Toggle */}
      <div className="mb-4">
        <label className="text-sm font-medium text-gray-700 mr-2">
          Processing Mode:
        </label>
        <select
          className="border px-2 py-1 text-sm rounded"
          value={useServer ? "server" : "client"}
          onChange={(e) => setUseServer(e.target.value === "server")}
        >
          <option value="server">Server-side</option>
          <option value="client">Client-side</option>
        </select>
      </div>

      <Dropzone onDrop={onDrop} disabled={loading} />
      {loading && <Spinner />}
      <UploadInfo />

      {error && (
        <div className="mt-3 text-red-600 font-medium bg-red-100 p-2 rounded">
          {error}
        </div>
      )}

      <TransformButtons
        file={file}
        previewUrl={previewUrl}
        croppingImageUrl={croppingImageUrl}
        rotation={rotation}
        flipX={flipX}
        flipY={flipY}
        useServer={useServer}
        setRotation={setRotation}
        setFlipX={setFlipX}
        setFlipY={setFlipY}
        setPreviewUrl={setPreviewUrl}
        setCroppingImageUrl={setCroppingImageUrl}
        setHasCropped={setHasCropped}
      />

      {croppingImageUrl && (
        <AspectRatioButtons
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

      <CropButtons
        previewUrl={previewUrl}
        croppingImageUrl={croppingImageUrl}
        croppedBlob={croppedBlob}
        hasCropped={hasCropped}
        originalUrl={originalUrl}
        setCroppingImageUrl={setCroppingImageUrl}
        setHasCropped={setHasCropped}
        setPreviewUrl={setPreviewUrl}
        setCroppedBlob={setCroppedBlob}
        setShowComparison={setShowComparison}
        onCrop={handleCrop}
        useServer={useServer}
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
        <FileInfo
          file={file}
          onRemove={() => {
            setPreviewUrl(null);
            setError(null);
            setFile(null);
            setOriginalUrl(null);
            setCroppingImageUrl(null);
            setHasCropped(false);
            setShowComparison(false);
          }}
        />
      )}
    </div>
  );
}
