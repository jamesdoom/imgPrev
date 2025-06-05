// src/components/ImageUploader/Controls/CropToolbar.tsx

import { useState } from "react";
import toast from "react-hot-toast";
import Konva from "konva";
import { getCroppedImg } from "../utils/getCroppedImg";

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

interface Props {
  cropRect: { x: number; y: number; width: number; height: number } | null;
  selectedId: string | null;
  uploadedImages: UploadedImage[];

  updateImages: (updater: (prev: UploadedImage[]) => UploadedImage[]) => void;
  setHasCropped: (val: boolean) => void;
  setShowCropper: (val: boolean) => void;
  setCropRect: (
    val: { x: number; y: number; width: number; height: number } | null
  ) => void;
  hasCropped: boolean;

  setSelectedId: (id: string | null) => void;
  imageNode: Konva.Image | null;
}

export default function CropToolbar({
  cropRect,
  selectedId,
  uploadedImages,
  updateImages,
  setHasCropped,
  setShowCropper,
  setCropRect,
  hasCropped,
  setSelectedId,
  imageNode,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleCrop = async () => {
    if (!cropRect || !selectedId || !imageNode) return;

    const imgObj = uploadedImages.find((img) => img.id === selectedId);
    if (!imgObj) return;

    // Convert both cropRect corners into image-local space
    const angleRad = -(imgObj.rotation ?? 0) * (Math.PI / 180);
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    const cx = imgObj.x;
    const cy = imgObj.y;

    const scaleX = imgObj.scaleX;
    const scaleY = imgObj.scaleY;

    // Top-left corner
    const dx1 = cropRect.x - cx;
    const dy1 = cropRect.y - cy;
    const x1 = (dx1 * cos - dy1 * sin) / scaleX + imgObj.width / 2;
    const y1 = (dx1 * sin + dy1 * cos) / scaleY + imgObj.height / 2;

    // Bottom-right corner
    const dx2 = cropRect.x + cropRect.width - cx;
    const dy2 = cropRect.y + cropRect.height - cy;
    const x2 = (dx2 * cos - dy2 * sin) / scaleX + imgObj.width / 2;
    const y2 = (dx2 * sin + dy2 * cos) / scaleY + imgObj.height / 2;

    // Final crop rectangle in image coordinates
    const finalCrop = {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };

    console.log("📐 Final crop rect in image space:", finalCrop);
    console.log("🌀 Applied transforms:", {
      rotation: imgObj.rotation,
      scaleX: imgObj.scaleX,
      scaleY: imgObj.scaleY,
    });

    setLoading(true);

    try {
      const newUrl = await getCroppedImg(imgObj.url, finalCrop, {
        rotation: imgObj.rotation ?? 0,
        scaleX: imgObj.scaleX,
        scaleY: imgObj.scaleY,
      });

      const newImg = new Image();
      newImg.src = newUrl;
      await newImg.decode();

      updateImages((prev) =>
        prev.map((img) =>
          img.id === selectedId
            ? {
                ...img,
                url: newUrl,
                width: newImg.width,
                height: newImg.height,
                scaleX: 1,
                scaleY: 1,
                rotation: 0,
                x: imgObj.x,
                y: imgObj.y,
              }
            : img
        )
      );

      toast.success("Image cropped successfully!");
    } catch (err) {
      console.error("🛑 Cropping failed:", err);
      toast.error("Cropping failed.");
    } finally {
      setLoading(false);
      setHasCropped(true);
      setShowCropper(false);
      setCropRect(null);
      setSelectedId(null);
    }
  };

  const handleDownload = async () => {
    const imgObj = uploadedImages.find((img) => img.id === selectedId);
    if (!imgObj) return;

    try {
      const response = await fetch(imgObj.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = "cropped-image.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Failed to download image", err);
    }
  };

  console.log("🧪 CropToolbar State:");
  console.log("  cropRect:", cropRect);
  console.log("  selectedId:", selectedId);
  console.log("  loading:", loading);

  return (
    <div className="flex flex-wrap gap-3 mt-4">
      {!hasCropped && (
        <button
          onClick={handleCrop}
          disabled={loading || !cropRect || !selectedId}
          className={`px-3 py-1 text-white text-sm rounded transition-colors ${
            loading || !cropRect || !selectedId
              ? "bg-blue-300 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "Cropping..." : "Apply Crop"}
        </button>
      )}

      {hasCropped && (
        <>
          <button
            onClick={() => {
              setHasCropped(false);
              setShowCropper(false);
              setCropRect(null);
            }}
            className="px-3 py-1 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600"
          >
            Undo Crop
          </button>

          <button
            onClick={handleDownload}
            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
          >
            Download Cropped Image
          </button>
        </>
      )}
    </div>
  );
}
