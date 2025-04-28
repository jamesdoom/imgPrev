import * as exifr from "exifr";

export async function getDpi(file: File): Promise<number | null> {
  try {
    const metadata = await exifr.parse(file, { tiff: true });
    const xRes = metadata.XResolution;
    const resUnit = metadata.ResolutionUnit; // 2 = inches, 3 = cm

    if (xRes && resUnit === 2) {
      return Math.round(xRes);
    }

    return null;
  } catch (error) {
    console.error("Failed to extract DPI:", error);
    return null;
  }
}
