import { useCallback, useState } from "react";
import { API_BASE_URL } from "../../../config/appEnv";
import type { ImageUpdater } from "../../../types";
import { getDpi } from "../utils/getDpi";

const MAX_FILE_SIZE = 21 * 1024 * 1024;
const DEFAULT_IMAGE_SCALE = 0.5;
const DEFAULT_IMAGE_POSITION = 400;

interface UseImageUploadOptions {
  updateImages: ImageUpdater;
  onUploadStart?: () => void;
}

interface UploadResponse {
  previewUrl?: string;
  error?: string;
}

export function useImageUpload({
  updateImages,
  onUploadStart,
}: UseImageUploadOptions) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      setError(null);
      setPreviewUrl(null);
      onUploadStart?.();

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

        const data = (await response.json()) as UploadResponse;
        if (!response.ok || !data.previewUrl) {
          throw new Error(data.error || "Upload failed");
        }

        const url = `${API_BASE_URL}${data.previewUrl}`;
        const img = new Image();
        img.src = url;
        await img.decode();

        const dpiValue = await getDpi(file);
        setPreviewUrl(url);
        updateImages((prev) => [
          ...prev,
          {
            id: url,
            url,
            x: DEFAULT_IMAGE_POSITION,
            y: DEFAULT_IMAGE_POSITION,
            scaleX: DEFAULT_IMAGE_SCALE,
            scaleY: DEFAULT_IMAGE_SCALE,
            width: img.naturalWidth,
            height: img.naturalHeight,
            ...(dpiValue ? { dpi: dpiValue } : {}),
          },
        ]);
      } catch (err) {
        console.error("Error processing image:", err);
        setError("Something went wrong while processing the image.");
      } finally {
        setLoading(false);
      }
    },
    [onUploadStart, updateImages]
  );

  return {
    error,
    loading,
    onDrop,
    previewUrl,
  };
}
