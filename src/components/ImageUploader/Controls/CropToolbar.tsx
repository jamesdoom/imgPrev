// src/components/ImageUploader/Controls/CropToolbar.tsx

import { useState } from "react";
import toast from "react-hot-toast";
import type Konva from "konva";
import {
  ArrowDownTrayIcon,
  ArrowUturnLeftIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { getCroppedImg } from "../utils/getCroppedImg";
import type { UploadedImage, CropRect } from "../../../types";

interface CropToolbarProps {
  cropRect: CropRect | null;
  selectedId: string | null;
  uploadedImages: UploadedImage[];

  updateImages: (updater: (prev: UploadedImage[]) => UploadedImage[]) => void;
  setHasCropped: (val: boolean) => void;
  setShowCropper: (val: boolean) => void;
  setCropRect: (val: CropRect | null) => void;
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
}: CropToolbarProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const buttonClass =
    "inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm transition hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40";

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
    const finalCrop: CropRect = {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };

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
      console.error("Cropping failed:", err);
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

  return (
    <div
      className="flex w-full flex-wrap items-center justify-center gap-2 border-y border-emerald-100 bg-emerald-50/60 px-3 py-3"
      role="toolbar"
      aria-label="Crop controls"
    >
      {!hasCropped && (
        <button
          type="button"
          onClick={handleCrop}
          disabled={loading || !cropRect || !selectedId}
          title={loading ? "Cropping" : "Apply Crop"}
          aria-label={loading ? "Cropping" : "Apply Crop"}
          className={buttonClass}
        >
          <CheckIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      )}

      {hasCropped && (
        <>
          <button
            type="button"
            onClick={() => {
              setHasCropped(false);
              setShowCropper(false);
              setCropRect(null);
            }}
            title="Undo Crop"
            aria-label="Undo Crop"
            className={buttonClass}
          >
            <ArrowUturnLeftIcon className="h-5 w-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={handleDownload}
            title="Download Cropped Image"
            aria-label="Download Cropped Image"
            className={buttonClass}
          >
            <ArrowDownTrayIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}
