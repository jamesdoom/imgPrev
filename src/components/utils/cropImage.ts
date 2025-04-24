import type { Area } from "react-easy-crop";
export function cropImage(
  previewUrl: string,
  cropArea: Area
): Promise<{ url: string; blob: Blob }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = previewUrl;
    image.crossOrigin = "anonymous";

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = cropArea.width;
      canvas.height = cropArea.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return reject("Canvas context not found");

      ctx.drawImage(
        image,
        cropArea.x,
        cropArea.y,
        cropArea.width,
        cropArea.height,
        0,
        0,
        cropArea.width,
        cropArea.height
      );

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject("Crop failed");
          const url = URL.createObjectURL(blob);
          resolve({ url, blob });
        },
        "image/jpeg",
        0.9
      );
    };

    image.onerror = () => reject("Image load failed");
  });
}
