import sharp from "sharp";
import zlib from "zlib";

const PDF_POINTS_PER_INCH = 72;

export interface RenderSheetDocument {
  sheet: {
    widthIn: number;
    heightIn: number;
    dpi: number;
  };
  assets: RenderSheetAsset[];
  items: RenderSheetItem[];
  settings: {
    background: { type: "transparent" } | { type: "solid"; color: string };
  };
}

export interface RenderSheetAsset {
  id: string;
  fileName: string;
  fileType: string;
}

export interface RenderSheetItem {
  id: string;
  assetId: string;
  xIn: number;
  yIn: number;
  widthIn: number;
  heightIn: number;
  rotationDeg: number;
  scaleX: number;
  scaleY: number;
}

export interface RenderSheetAssetFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

export interface RenderSheetResult {
  previewPng: Buffer;
  printPdf: Buffer;
  widthPx: number;
  heightPx: number;
}

export interface ProductionPdfInfo {
  imageCount: number;
  imageHeightPx: number | null;
  imageWidthPx: number | null;
  pageCount: number;
  pageHeightPt: number | null;
  pageWidthPt: number | null;
}

interface Bounds {
  minX: number;
  minY: number;
}

export async function renderSheetToFiles(
  document: RenderSheetDocument,
  files: RenderSheetAssetFile[]
): Promise<RenderSheetResult> {
  const widthPx = Math.round(document.sheet.widthIn * document.sheet.dpi);
  const heightPx = Math.round(document.sheet.heightIn * document.sheet.dpi);
  const assetsById = new Map(document.assets.map((asset) => [asset.id, asset]));
  const filesByName = new Map(files.map((file) => [file.originalname, file]));
  const composites = await Promise.all(
    document.items.map(async (item) => {
      const asset = assetsById.get(item.assetId);

      if (!asset) {
        throw new Error(`Missing asset metadata for item ${item.id}.`);
      }

      const file = filesByName.get(asset.fileName);

      if (!file) {
        throw new Error(`Missing uploaded asset file: ${asset.fileName}.`);
      }

      if (file.mimetype === "application/pdf") {
        throw new Error("PDF assets are not supported by the production renderer yet.");
      }

      const itemWidthPx = Math.max(
        1,
        Math.round(item.widthIn * Math.abs(item.scaleX) * document.sheet.dpi)
      );
      const itemHeightPx = Math.max(
        1,
        Math.round(item.heightIn * Math.abs(item.scaleY) * document.sheet.dpi)
      );
      let image = sharp(file.buffer).resize(itemWidthPx, itemHeightPx, {
        fit: "fill",
      });

      if (item.scaleX < 0) {
        image = image.flop();
      }

      if (item.scaleY < 0) {
        image = image.flip();
      }

      const rotated = await image
        .rotate(item.rotationDeg, {
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
      const bounds = getItemBounds(item);

      return {
        input: rotated,
        left: Math.max(0, Math.round(bounds.minX * document.sheet.dpi)),
        top: Math.max(0, Math.round(bounds.minY * document.sheet.dpi)),
      };
    })
  );
  const background =
    document.settings.background.type === "solid"
      ? document.settings.background.color
      : { r: 0, g: 0, b: 0, alpha: 0 };
  const previewPng = await sharp({
    create: {
      width: widthPx,
      height: heightPx,
      channels: 4,
      background,
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
  const printPdf = await createPdfFromPng(
    previewPng,
    widthPx,
    heightPx,
    document.sheet.dpi
  );

  validateProductionPdf(printPdf, {
    dpi: document.sheet.dpi,
    heightPx,
    widthPx,
  });

  return {
    previewPng,
    printPdf,
    widthPx,
    heightPx,
  };
}

function getItemBounds(item: RenderSheetItem): Bounds {
  const width = item.widthIn * Math.abs(item.scaleX);
  const height = item.heightIn * Math.abs(item.scaleY);
  const centerX = item.xIn + width / 2;
  const centerY = item.yIn + height / 2;
  const radians = (item.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const corners = [
    { x: -width / 2, y: -height / 2 },
    { x: width / 2, y: -height / 2 },
    { x: width / 2, y: height / 2 },
    { x: -width / 2, y: height / 2 },
  ].map((corner) => ({
    x: centerX + corner.x * cos - corner.y * sin,
    y: centerY + corner.x * sin + corner.y * cos,
  }));

  return {
    minX: Math.min(...corners.map((corner) => corner.x)),
    minY: Math.min(...corners.map((corner) => corner.y)),
  };
}

async function createPdfFromPng(
  png: Buffer,
  widthPx: number,
  heightPx: number,
  dpi: number
): Promise<Buffer> {
  const { data } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgb = Buffer.alloc(widthPx * heightPx * 3);
  const alpha = Buffer.alloc(widthPx * heightPx);

  for (let source = 0, pixel = 0; source < data.length; source += 4, pixel += 1) {
    const rgbIndex = pixel * 3;
    rgb[rgbIndex] = data[source];
    rgb[rgbIndex + 1] = data[source + 1];
    rgb[rgbIndex + 2] = data[source + 2];
    alpha[pixel] = data[source + 3];
  }

  const compressedRgb = zlib.deflateSync(rgb);
  const compressedAlpha = zlib.deflateSync(alpha);
  const pageWidthPt = (widthPx / dpi) * PDF_POINTS_PER_INCH;
  const pageHeightPt = (heightPx / dpi) * PDF_POINTS_PER_INCH;
  const content = Buffer.from(
    `q\n${formatPdfNumber(pageWidthPt)} 0 0 ${formatPdfNumber(
      pageHeightPt
    )} 0 0 cm\n/Im0 Do\nQ\n`
  );

  return buildPdf([
    pdfObject(1, "<< /Type /Catalog /Pages 2 0 R >>"),
    pdfObject(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    pdfObject(
      3,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${formatPdfNumber(
        pageWidthPt
      )} ${formatPdfNumber(
        pageHeightPt
      )}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`
    ),
    pdfStreamObject(4, "<<", content),
    pdfStreamObject(
      5,
      `<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask 6 0 R`,
      compressedRgb
    ),
    pdfStreamObject(
      6,
      `<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`,
      compressedAlpha
    ),
  ]);
}

function pdfObject(id: number, body: string): { id: number; body: Buffer } {
  return {
    id,
    body: Buffer.from(body),
  };
}

function pdfStreamObject(
  id: number,
  dictionaryPrefix: string,
  stream: Buffer
): { id: number; body: Buffer } {
  return {
    id,
    body: Buffer.concat([
      Buffer.from(`${dictionaryPrefix} /Length ${stream.length} >>\nstream\n`),
      stream,
      Buffer.from("\nendstream"),
    ]),
  };
}

function buildPdf(objects: { id: number; body: Buffer }[]): Buffer {
  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n")];
  const offsets: number[] = [0];
  let length = chunks[0].length;

  for (const object of objects) {
    offsets[object.id] = length;

    const chunk = Buffer.concat([
      Buffer.from(`${object.id} 0 obj\n`),
      object.body,
      Buffer.from("\nendobj\n"),
    ]);

    chunks.push(chunk);
    length += chunk.length;
  }

  const xrefOffset = length;
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    "0000000000 65535 f \n",
    ...objects.map((object) => `${formatPdfOffset(offsets[object.id])} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  ].join("");

  chunks.push(Buffer.from(xref));

  return Buffer.concat(chunks);
}

function formatPdfNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(4);
}

function formatPdfOffset(value: number): string {
  return String(value).padStart(10, "0");
}

export function inspectProductionPdf(pdf: Buffer): ProductionPdfInfo {
  const source = pdf.toString("latin1");
  const mediaBoxMatch = source.match(
    /\/MediaBox\s*\[\s*0\s+0\s+([0-9.]+)\s+([0-9.]+)\s*\]/
  );
  const imageMatches = Array.from(
    source.matchAll(/\/Subtype\s+\/Image\s+\/Width\s+(\d+)\s+\/Height\s+(\d+)/g)
  );
  const firstImageMatch = imageMatches[0];

  return {
    imageCount: imageMatches.length,
    imageHeightPx: firstImageMatch ? Number(firstImageMatch[2]) : null,
    imageWidthPx: firstImageMatch ? Number(firstImageMatch[1]) : null,
    pageCount: (source.match(/\/Type\s+\/Page\b/g) ?? []).length,
    pageHeightPt: mediaBoxMatch ? Number(mediaBoxMatch[2]) : null,
    pageWidthPt: mediaBoxMatch ? Number(mediaBoxMatch[1]) : null,
  };
}

export function validateProductionPdf(
  pdf: Buffer,
  expected: {
    dpi: number;
    heightPx: number;
    widthPx: number;
  }
): void {
  if (pdf.subarray(0, 5).toString() !== "%PDF-") {
    throw new Error("Generated print PDF is missing a valid PDF header.");
  }

  const info = inspectProductionPdf(pdf);
  const expectedWidthPt = (expected.widthPx / expected.dpi) * PDF_POINTS_PER_INCH;
  const expectedHeightPt =
    (expected.heightPx / expected.dpi) * PDF_POINTS_PER_INCH;

  if (info.pageCount !== 1) {
    throw new Error("Generated print PDF must contain exactly one page.");
  }

  if (
    !numbersAreClose(info.pageWidthPt, expectedWidthPt) ||
    !numbersAreClose(info.pageHeightPt, expectedHeightPt)
  ) {
    throw new Error("Generated print PDF page size does not match the sheet.");
  }

  if (
    info.imageCount < 2 ||
    info.imageWidthPx !== expected.widthPx ||
    info.imageHeightPx !== expected.heightPx
  ) {
    throw new Error(
      "Generated print PDF image dimensions do not match the rendered sheet."
    );
  }
}

function numbersAreClose(actual: number | null, expected: number): boolean {
  return actual !== null && Math.abs(actual - expected) <= 0.01;
}
