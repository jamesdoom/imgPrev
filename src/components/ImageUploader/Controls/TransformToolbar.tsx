// src/components/ImageUploader/Controls/TransformToolbar.tsx

import { toast } from "react-hot-toast";

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
  selectedId: string | null;
  uploadedImages: UploadedImage[];
  onUpdateImage: (id: string, updates: Partial<UploadedImage>) => void;
}

export default function TransformToolbar({
  selectedId,
  uploadedImages,
  onUpdateImage,
}: Props) {
  const isImageSelected =
    selectedId !== null && uploadedImages.some((img) => img.id === selectedId);

  const getSelectedImage = () =>
    uploadedImages.find((img) => img.id === selectedId);

  const handleFlipHorizontal = () => {
    const image = getSelectedImage();
    if (!image) return toast.error("Selected image not found.");
    const newScaleX = image.scaleX * -1;
    onUpdateImage(image.id, { scaleX: newScaleX });
    toast("Flipped image horizontally", { icon: "↔️", id: "flip-toast" });
  };

  const handleFlipVertical = () => {
    const image = getSelectedImage();
    if (!image) return toast.error("Selected image not found.");
    const newScaleY = image.scaleY * -1;
    onUpdateImage(image.id, { scaleY: newScaleY });
    toast("Flipped image vertically", {
      icon: "↕️",
      id: "flip-vertical-toast",
    });
  };

  const handleRotate90 = () => {
    const image = getSelectedImage();
    if (!image) return toast.error("Selected image not found.");
    const currentRotation = image.rotation ?? 0;
    const newRotation = (currentRotation + 90) % 360;
    onUpdateImage(image.id, { rotation: newRotation });
    toast("Rotated image 90°", { icon: "↻", id: "rotate-toast" });
  };

  const handleResetTransform = () => {
    const image = getSelectedImage();
    if (!image) {
      toast.error("Selected image not found.");
      return;
    }

    onUpdateImage(image.id, {
      scaleX: 0.5,
      scaleY: 0.5,
      rotation: 0,
      x: 400,
      y: 400,
    });

    toast("Transform reset", { icon: "🔄", id: "reset-toast" });
  };

  return (
    <div className="flex justify-center gap-4 mt-4">
      <button
        onClick={handleFlipHorizontal}
        disabled={!isImageSelected}
        className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors disabled:opacity-50"
      >
        Flip Horizontally
      </button>

      <button
        onClick={handleFlipVertical}
        disabled={!isImageSelected}
        className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors disabled:opacity-50"
      >
        Flip Vertically
      </button>

      <button
        onClick={handleRotate90}
        disabled={!isImageSelected}
        className="px-3 py-1 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 transition-colors disabled:opacity-50"
      >
        Rotate 90°
      </button>

      <button
        onClick={handleResetTransform}
        disabled={!isImageSelected}
        className="px-3 py-1 bg-gray-700 text-white text-sm rounded hover:bg-gray-800 transition-colors disabled:opacity-50"
      >
        Reset Transform
      </button>
    </div>
  );
}
