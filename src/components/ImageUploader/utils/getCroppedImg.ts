// src/components/ImageUploader/utils/getCroppedImg.ts

export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  transform?: {
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
  }
): Promise<string> {
  console.log("🪓 getCroppedImg triggered");
  console.log("Pixel Crop:", pixelCrop);
  console.log("Transform:", transform);

  const image = await createImage(imageSrc);
  console.log("🖼️ Original image size:", image.width, image.height);

  const radians = ((transform?.rotation ?? 0) * Math.PI) / 180;
  const scaleX = transform?.scaleX ?? 1;
  const scaleY = transform?.scaleY ?? 1;
  const absScaleX = Math.abs(scaleX);
  const absScaleY = Math.abs(scaleY);
  const flipX = scaleX < 0 ? -1 : 1;
  const flipY = scaleY < 0 ? -1 : 1;

  // Extract raw crop region
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = pixelCrop.width;
  cropCanvas.height = pixelCrop.height;
  const cropCtx = cropCanvas.getContext("2d");
  if (!cropCtx) throw new Error("❌ Could not get crop canvas context");

  cropCtx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  console.log("🧩 Cropped size:", cropCanvas.width, cropCanvas.height);

  // If no rotation or flip, just return
  const hasTransform =
    (transform?.rotation ?? 0) !== 0 || scaleX !== 1 || scaleY !== 1;
  if (!hasTransform) {
    console.log("✅ No transform detected, returning raw crop.");
    return new Promise((resolve) => {
      cropCanvas.toBlob((blob) => {
        if (blob) resolve(URL.createObjectURL(blob));
      }, "image/png");
    });
  }

  // Calculate rotated canvas size
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const rotatedWidth = cropCanvas.width * cos + cropCanvas.height * sin;
  const rotatedHeight = cropCanvas.width * sin + cropCanvas.height * cos;

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = Math.ceil(rotatedWidth * absScaleX);
  outputCanvas.height = Math.ceil(rotatedHeight * absScaleY);
  const outputCtx = outputCanvas.getContext("2d");
  if (!outputCtx) throw new Error("❌ Could not get output canvas context");

  outputCtx.save();
  outputCtx.translate(outputCanvas.width / 2, outputCanvas.height / 2);
  outputCtx.rotate(radians);
  outputCtx.scale(flipX * absScaleX, flipY * absScaleY);

  console.log("🌀 Drawing with transform:");
  console.log("  scaleX:", scaleX, "scaleY:", scaleY);
  console.log("  radians:", radians);
  console.log(
    "  drawImage offset:",
    -cropCanvas.width / 2,
    -cropCanvas.height / 2
  );

  outputCtx.drawImage(
    cropCanvas,
    -cropCanvas.width / 2,
    -cropCanvas.height / 2
  );

  outputCtx.restore();

  return new Promise((resolve) => {
    outputCanvas.toBlob((blob) => {
      if (blob) resolve(URL.createObjectURL(blob));
    }, "image/png");
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
