export function resizeImage(
  file: File,
  maxSize = 1024,
  rotation = 0,
  flipX = false,
  flipY = false
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      if (!e.target?.result) return reject("File load failed");
      img.src = e.target.result as string;
    };

    img.onload = () => {
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const width = img.width * scale;
      const height = img.height * scale;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject("Canvas context not found");

      const angleInRad = (rotation * Math.PI) / 180;
      const isRotated = rotation % 180 !== 0;
      canvas.width = isRotated ? height : width;
      canvas.height = isRotated ? width : height;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(angleInRad);
      ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      ctx.drawImage(img, -width / 2, -height / 2, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject("Resize failed");
          const url = URL.createObjectURL(blob);
          resolve(url);
        },
        "image/jpeg",
        0.95
      );
    };

    img.onerror = () => reject("Image load error");
    reader.onerror = () => reject("File read error");
    reader.readAsDataURL(file);
  });
}
