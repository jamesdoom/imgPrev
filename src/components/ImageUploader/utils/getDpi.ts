// /src/components/utilsgetDpi.ts

/**
 * Extracts the DPI (dots per inch) from a JPEG, PNG, or TIFF file.
 * Returns null if DPI cannot be determined or if the format is unsupported.
 */

export async function getDpi(file: File): Promise<number | null> {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);

  // Check JPEG
  if (view.getUint16(0) === 0xffd8) {
    let offset = 2;
    while (offset < view.byteLength) {
      if (view.getUint8(offset) !== 0xff) return null;
      const marker = view.getUint8(offset + 1);
      const size = view.getUint16(offset + 2);
      if (marker === 0xe0) {
        // APP0 (JFIF)
        const unit = view.getUint8(offset + 9);
        const xDensity = view.getUint16(offset + 10);
        if (unit === 1 || unit === 2) return xDensity;
      }
      offset += 2 + size;
    }
    return null;
  }

  // Check PNG
  const isPng = view.getUint32(0) === 0x89504e47;
  if (isPng) {
    let offset = 8;
    while (offset < buffer.byteLength) {
      const length = view.getUint32(offset);
      const type = String.fromCharCode(
        view.getUint8(offset + 4),
        view.getUint8(offset + 5),
        view.getUint8(offset + 6),
        view.getUint8(offset + 7)
      );

      if (type === "pHYs") {
        const pixelsPerUnitX = view.getUint32(offset + 8);
        const unitSpecifier = view.getUint8(offset + 16);
        if (unitSpecifier === 1) {
          // DPI = pixels per meter / 39.3701
          return Math.round(pixelsPerUnitX / 39.3701);
        }
        break;
      }

      offset += 12 + length;
    }
    return null;
  }

  // Check TIFF (II - Intel / MM - Motorola byte order)
  const byteOrder = view.getUint16(0);
  const isLittleEndian = byteOrder === 0x4949;
  const isBigEndian = byteOrder === 0x4d4d;
  if (!isLittleEndian && !isBigEndian) return null;

  const getUint16 = (offset: number) =>
    isLittleEndian
      ? view.getUint16(offset, true)
      : view.getUint16(offset, false);
  const getUint32 = (offset: number) =>
    isLittleEndian
      ? view.getUint32(offset, true)
      : view.getUint32(offset, false);

  const ifdOffset = getUint32(4);
  const numTags = getUint16(ifdOffset);

  for (let i = 0; i < numTags; i++) {
    const tagOffset = ifdOffset + 2 + i * 12;
    const tag = getUint16(tagOffset);
    if (tag === 0x011a) {
      // XResolution
      const valOffset = getUint32(tagOffset + 8);
      const num = getUint32(valOffset);
      const denom = getUint32(valOffset + 4);
      if (denom !== 0) return Math.round(num / denom);
    }
  }

  return null;
}
