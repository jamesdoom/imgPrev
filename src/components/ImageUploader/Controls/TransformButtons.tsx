import { resizeImage } from "../../utils/resizeImage";

type TransformType = "rotate" | "flipX" | "flipY" | null;

interface Props {
  file: File | null;
  previewUrl: string | null;
  croppingImageUrl: string | null;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  activeTransform: TransformType;
  setRotation: (val: number) => void;
  setFlipX: (val: boolean) => void;
  setFlipY: (val: boolean) => void;
  setActiveTransform: (val: TransformType) => void;
  setPreviewUrl: (val: string) => void;
  setCroppingImageUrl: (val: string | null) => void;
  setHasCropped: (val: boolean) => void;
}

export default function TransformButtons({
  file,
  previewUrl,
  croppingImageUrl,
  rotation,
  flipX,
  flipY,
  activeTransform,
  setRotation,
  setFlipX,
  setFlipY,
  setActiveTransform,
  setPreviewUrl,
  setCroppingImageUrl,
  setHasCropped,
}: Props) {
  if (!previewUrl || croppingImageUrl) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-3 items-center">
      <button
        onClick={() => setActiveTransform("rotate")}
        className={`px-3 py-1 text-sm rounded transition-colors duration-200 ${
          activeTransform === "rotate"
            ? "bg-yellow-500 text-white"
            : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
      >
        Rotate 90°
      </button>

      <button
        onClick={() => setActiveTransform("flipX")}
        className={`px-3 py-1 text-sm rounded transition-colors duration-200 ${
          activeTransform === "flipX"
            ? "bg-yellow-500 text-white"
            : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
      >
        Flip Horizontally
      </button>

      <button
        onClick={() => setActiveTransform("flipY")}
        className={`px-3 py-1 text-sm rounded transition-colors duration-200 ${
          activeTransform === "flipY"
            ? "bg-yellow-500 text-white"
            : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
      >
        Flip Vertically
      </button>

      <button
        onClick={async () => {
          if (!file || !activeTransform) return;

          let newRotation = rotation;
          let newFlipX = flipX;
          let newFlipY = flipY;

          if (activeTransform === "rotate") newRotation = (rotation + 90) % 360;
          if (activeTransform === "flipX") newFlipX = !flipX;
          if (activeTransform === "flipY") newFlipY = !flipY;

          const url = await resizeImage(
            file,
            512,
            newRotation,
            newFlipX,
            newFlipY
          );
          setRotation(newRotation);
          setFlipX(newFlipX);
          setFlipY(newFlipY);
          setPreviewUrl(url);
          setCroppingImageUrl(null);
          setHasCropped(false);
          setActiveTransform(null);
        }}
        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
      >
        Apply Transform
      </button>
    </div>
  );
}
