// src/components/ImageUploader/Controls/CropControl.tsx

import toast from "react-hot-toast";
import type { Area } from "react-easy-crop";

const isDemo =
  new URLSearchParams(window.location.search).get("demo") === "true";

interface Props {
  previewUrl: string | null;
  croppingImageUrl: string | null;
  hasCropped: boolean;
  originalUrl: string | null;
  setCroppingImageUrl: (url: string | null) => void;
  setHasCropped: (value: boolean) => void;
  setPreviewUrl: (url: string | null) => void;
  setShowComparison: (fn: (prev: boolean) => boolean) => void;
  file: File | null;
  croppedAreaPixels: Area | null;
}

export default function CropButtons({
  previewUrl,
  croppingImageUrl,
  hasCropped,
  originalUrl,
  setCroppingImageUrl,
  setHasCropped,
  setPreviewUrl,
  setShowComparison,
  file,
  croppedAreaPixels,
}: Props) {
  const handleSaveToCloud = async () => {
    if (!previewUrl) return;
    const filename = previewUrl.split("/").pop();

    try {
      const res = await fetch("http://localhost:4000/save-to-cloud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();

      if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");

      toast.success("Saved to Cloud!", {
        icon: "☁️",
        duration: 3000,
        style: {
          border: "1px solid #4ade80",
          padding: "10px",
          color: "#064e3b",
        },
        iconTheme: {
          primary: "#4ade80",
          secondary: "#ecfdf5",
        },
      });
    } catch (err) {
      console.error("Save to Cloud failed:", err);
      toast.error("Failed to save image to cloud.");
    }
  };

  return (
    <>
      {previewUrl && croppingImageUrl && !hasCropped && (
        <button
          onClick={async () => {
            if (file && croppedAreaPixels) {
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
        </div>
      )}

      {hasCropped && previewUrl && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={async () => {
              try {
                const response = await fetch(previewUrl);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);

                const link = document.createElement("a");
                link.href = blobUrl;
                link.download = "cropped-image.webp";
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(blobUrl);
              } catch (err) {
                console.error("Failed to download image:", err);
              }
            }}
            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
          >
            Download Cropped Image
          </button>

          <button
            onClick={handleSaveToCloud}
            disabled={!isDemo}
            className={`px-3 py-1 text-white text-sm rounded transition-colors ${
              isDemo
                ? "bg-indigo-600 hover:bg-indigo-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            Save to Cloud
          </button>
        </div>
      )}

      {hasCropped && originalUrl && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => {
              setPreviewUrl(originalUrl);
              setHasCropped(false);
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
