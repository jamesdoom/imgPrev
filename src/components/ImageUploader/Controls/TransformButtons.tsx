import { resizeImage } from "../../utils/resizeImage";

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
  if (!previewUrl || croppingImageUrl || !file) return null;

  const handleTransform = async (type: "rotate" | "flipX" | "flipY") => {
    let newRotation = rotation;
    let newFlipX = flipX;
    let newFlipY = flipY;

    if (type === "rotate") {
      newRotation = (rotation + 90) % 360;
      setRotation(newRotation);
    }
    if (type === "flipX") {
      newFlipX = !flipX;
      setFlipX(newFlipX);
    }
    if (type === "flipY") {
      newFlipY = !flipY;
      setFlipY(newFlipY);
    }

    // Apply immediately
    const url = await resizeImage(file, 512, newRotation, newFlipX, newFlipY);
    setPreviewUrl(url);
    setCroppingImageUrl(null);
    setHasCropped(false);
  };

  return (
    <div className="mt-4 flex flex-wrap gap-3 items-center">
      <button
        onClick={() => handleTransform("rotate")}
        className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
      >
        Rotate 90°
      </button>
      <button
        onClick={() => handleTransform("flipX")}
        className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
      >
        Flip Horizontally
      </button>
      <button
        onClick={() => handleTransform("flipY")}
        className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
      >
        Flip Vertically
      </button>
    </div>
  );
}
