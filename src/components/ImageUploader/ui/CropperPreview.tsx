// /src/components/ImageUploader/CropperPreview.tsx

import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

interface Props {
  image: string;
  crop: { x: number; y: number };
  zoom: number;
  aspectRatio: number;
  onCropChange: (crop: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
  onCropComplete: (_: Area, croppedArea: Area) => void;
}

export default function CropperPreview({
  image,
  crop,
  zoom,
  aspectRatio,
  onCropChange,
  onZoomChange,
  onCropComplete,
}: Props) {
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
