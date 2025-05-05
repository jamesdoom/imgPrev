// src/components/ImageUploader/Controls/CropButtons.tsx

import toast from "react-hot-toast";
import type { Area } from "react-easy-crop";

interface Props {
  previewUrl: string | null;
  croppingImageUrl: string | null;
  croppedBlob: Blob | null;
  hasCropped: boolean;
  originalUrl: string | null;
  setCroppingImageUrl: (url: string | null) => void;
  setHasCropped: (value: boolean) => void;
  setPreviewUrl: (url: string | null) => void;
  setCroppedBlob: (blob: Blob | null) => void;
  setShowComparison: (fn: (prev: boolean) => boolean) => void;
  onCrop: () => void;
  useServer: boolean;
  file: File | null;
  croppedAreaPixels: Area | null;
}

export default function CropButtons({
  previewUrl,
  croppingImageUrl,
  croppedBlob,
  hasCropped,
  originalUrl,
  setCroppingImageUrl,
  setHasCropped,
  setPreviewUrl,
  setCroppedBlob,
  setShowComparison,
  onCrop,
  useServer,
  file,
  croppedAreaPixels,
}: Props) {
  return (
    <>
      {previewUrl && croppingImageUrl && !hasCropped && (
        <button
          onClick={async () => {
            if (useServer && file && croppedAreaPixels) {
              const formData = new FormData();
              formData.append("image", file);
              formData.append(
                "cropX",
                Math.round(croppedAreaPixels.x).toString()
              );
              formData.append(
                "cropY",
                Math.round(croppedAreaPixels.y).toString()
              );
              formData.append(
                "cropWidth",
                Math.round(croppedAreaPixels.width).toString()
              );
              formData.append(
                "cropHeight",
                Math.round(croppedAreaPixels.height).toString()
              );
              if (previewUrl) {
                const img = new Image();
                img.src = previewUrl;
                await img.decode();
                formData.append("previewWidth", img.naturalWidth.toString());
                formData.append("previewHeight", img.naturalHeight.toString());
              }

              try {
                const res = await fetch("http://localhost:4000/upload", {
                  method: "POST",
                  body: formData,
                });
                const data = await res.json();
                if (!res.ok || !data.previewUrl) {
                  throw new Error(data.error || "Crop failed");
                }
                const origin = window.location.origin.replace("5173", "4000");
                setPreviewUrl(`${origin}${data.previewUrl}`);
                setCroppingImageUrl(null);
                setHasCropped(true);
              } catch (err) {
                console.error("Server-side crop failed", err);
              }
            } else {
              onCrop(); // client-side
            }
          }}
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors mt-4"
        >
          Crop Image
        </button>
      )}

      {previewUrl && !croppingImageUrl && !hasCropped && (
        <div className="mt-2 flex flex-col items-start gap-2">
          <button
            onClick={() => setCroppingImageUrl(previewUrl)}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors mt-4"
          >
            Crop Image
          </button>

          {croppedBlob && (
            <a
              href={URL.createObjectURL(croppedBlob)}
              download="cropped-image.jpg"
              className="text-sm text-green-600 underline hover:text-green-800"
            >
              Download Cropped Image
            </a>
          )}
        </div>
      )}

      {hasCropped && originalUrl && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => {
              setPreviewUrl(originalUrl);
              setHasCropped(false);
              setCroppedBlob(null);
              <button
                onClick={() => {
                  setPreviewUrl(originalUrl);
                  setHasCropped(false);
                  setCroppedBlob(null);
                  setShowComparison(() => false);
                  setCroppingImageUrl(originalUrl);
                  toast.success("Crop undone!", {
                    duration: 3000,
                    style: {
                      border: "1px solid #facc15",
                      padding: "10px",
                      color: "#78350f",
                    },
                    iconTheme: {
                      primary: "#facc15",
                      secondary: "#fff7ed",
                    },
                  });
                }}
                className="px-3 py-1 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600 transition-colors"
              >
                Undo Crop
              </button>;

              setCroppingImageUrl(originalUrl);
              toast.success("Crop undone!", {
                duration: 3000,
                style: {
                  border: "1px solid #facc15",
                  padding: "10px",
                  color: "#78350f",
                },
                iconTheme: {
                  primary: "#facc15",
                  secondary: "#fff7ed",
                },
              });
            }}
            className="px-3 py-1 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600 transition-colors"
          >
            Undo Crop
          </button>

          <button
            onClick={() => setShowComparison((prev) => !prev)}
            className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
          >
            Compare to Original
          </button>
        </div>
      )}
    </>
  );
}
