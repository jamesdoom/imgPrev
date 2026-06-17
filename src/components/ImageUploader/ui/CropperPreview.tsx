// src/components/ImageUploader/CropperPreview.tsx

import type { ReactElement } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

type Point = { x: number; y: number };
// If you prefer a distinct name locally, just alias it:
// type AreaPixels = Area;

interface CropperPreviewProps {
  image: string;
  crop: Point;
  zoom: number;
  aspectRatio: number;
  onCropChange: (crop: Point) => void;
  onZoomChange: (zoom: number) => void;
  onCropComplete: (croppedArea: Area, croppedAreaPixels: Area) => void;
}

export default function CropperPreview({
  image,
  crop,
  zoom,
  aspectRatio,
  onCropChange,
  onZoomChange,
  onCropComplete,
}: CropperPreviewProps): ReactElement {
  return (
    <>
      <div className="mt-4 relative w-full aspect-video bg-black rounded-md overflow-hidden">
        <Cropper
          image={image}
          crop={crop}
          zoom={zoom}
          aspect={aspectRatio}
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={onCropComplete}
        />
      </div>

      {/* Zoom Slider */}
      <div className="mt-4 flex items-center gap-4">
        <label htmlFor="zoom" className="text-sm text-gray-700 font-medium">
          Zoom
        </label>
        <input
          id="zoom"
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>
    </>
  );
}
