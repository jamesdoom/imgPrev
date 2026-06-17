// /src/components/utilsgetDpi.ts

/**
 * Extracts the DPI (dots per inch) from a JPEG, PNG, or TIFF file.
 * Returns null if DPI cannot be determined or if the format is unsupported.
 */

export async function getDpi(file: File): Promise<number | null> {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);

  // Check JPEG
  if (view.getUint16(0, false) === 0xffd8) {
    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) return null;

      const marker = view.getUint8(offset + 1);
      const size = view.getUint16(offset + 2, false); // big-endian
      if (size < 2) return null; // safety

      if (marker === 0xe0 && offset + 2 + size <= view.byteLength) {
        // APP0 (JFIF)
        const payload = offset + 4; // after marker(2) + length(2)

        // Check "JFIF\0"
        if (
          view.getUint8(payload) === 0x4a && // 'J'
          view.getUint8(payload + 1) === 0x46 && // 'F'
          view.getUint8(payload + 2) === 0x49 && // 'I'
          view.getUint8(payload + 3) === 0x46 && // 'F'
          view.getUint8(payload + 4) === 0x00
        ) {
          const units = view.getUint8(payload + 7); // 1 = DPI, 2 = DPCM
          const xDensity = view.getUint16(payload + 8, false); // big-endian
          // const yDensity = view.getUint16(payload + 10, false); // not used

          if (units === 1) return xDensity; // DPI
          if (units === 2) return Math.round(xDensity * 2.54); // DPCM → DPI
          // units === 0 → no units; fall through to keep scanning
        }
      }

      // advance to next segment (size includes its own 2-byte length field)
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
