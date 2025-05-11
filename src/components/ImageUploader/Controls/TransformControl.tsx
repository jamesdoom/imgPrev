// src/components/ImageUploader/Controls/TransformControl.tsx

import { useState } from "react";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface Props {
  file: File | null;
  previewUrl: string | null;
  croppingImageUrl: string | null;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  setRotation: (rotation: number) => void;
  setFlipX: (flipX: boolean) => void;
  setFlipY: (flipY: boolean) => void;
  setPreviewUrl: (url: string) => void;
  setCroppingImageUrl: (url: string | null) => void;
  setHasCropped: (value: boolean) => void;
}

export default function TransformButtons({
  file,
  previewUrl,
  croppingImageUrl,
  rotation,
  flipX,
  flipY,
  setRotation,
  setFlipX,
  setFlipY,
  setPreviewUrl,
  setCroppingImageUrl,
  setHasCropped,
}: Props) {
  const [isTransforming, setIsTransforming] = useState(false);

  if (!previewUrl || croppingImageUrl || !file) return null;

  const applyTransform = async (
    newRotation: number,
    newFlipX: boolean,
    newFlipY: boolean
  ) => {
    setIsTransforming(true);

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("rotation", newRotation.toString());
      formData.append("flipX", newFlipX.toString());
      formData.append("flipY", newFlipY.toString());

      if (previewUrl) {
        const img = new Image();
        img.src = previewUrl;
        await img.decode();
        formData.append("previewWidth", img.naturalWidth.toString());
        formData.append("previewHeight", img.naturalHeight.toString());
      }

      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || !data.previewUrl) {
        throw new Error(data.error || "Server transform failed");
      }

      const url = `${API_BASE_URL}${data.previewUrl}`;

      setPreviewUrl(url);
      setCroppingImageUrl(null);
      setHasCropped(false);
    } catch (error) {
      console.error("Transform error:", error);
    } finally {
      setIsTransforming(false);
    }
  };

  return (
    <div className="mt-4 flex flex-wrap gap-3 items-center">
      <button
        onClick={() => {
          const newRotation = (rotation + 90) % 360;
          setRotation(newRotation);
          applyTransform(newRotation, flipX, flipY);
        }}
        className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
        disabled={isTransforming}
      >
        Rotate 90°
      </button>

      <button
        onClick={() => {
          const newFlipX = !flipX;
          setFlipX(newFlipX);
          applyTransform(rotation, newFlipX, flipY);
        }}
        className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
        disabled={isTransforming}
      >
        Flip Horizontally
      </button>

      <button
        onClick={() => {
          const newFlipY = !flipY;
          setFlipY(newFlipY);
          applyTransform(rotation, flipX, newFlipY);
        }}
        className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
        disabled={isTransforming}
      >
        Flip Vertically
      </button>
    </div>
  );
}
