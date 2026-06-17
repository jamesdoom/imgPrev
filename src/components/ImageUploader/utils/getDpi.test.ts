import { getDpi } from "./getDpi";
import { expect, test } from "vitest";

function fileFromBytes(name: string, bytes: number[], type: string) {
  return new File([new Uint8Array(bytes)], name, { type });
}

// Minimal JPEG with JFIF header and density units = 1 (dpi), Xdensity=0x00,0x48 (72)
function makeJpeg72Dpi(): File {
  const SOI = [0xFF,0xD8];
  const APP0 = [0xFF,0xE0];
  const length = [0x00, 0x10]; // 16 bytes for APP0 segment
  const JFIF = [0x4A,0x46,0x49,0x46,0x00]; // "JFIF\0"
  const ver = [0x01,0x02];
  const units = [0x01]; // dpi
  const Xdensity = [0x00,0x48]; // 72
  const Ydensity = [0x00,0x48]; // 72
  const Xthumbnail = [0x00];
  const Ythumbnail = [0x00];
  const dummy = [0xFF,0xD9]; // EOI
  const arr = [...SOI, ...APP0, ...length, ...JFIF, ...ver, ...units, ...Xdensity, ...Ydensity, ...Xthumbnail, ...Ythumbnail, ...dummy];
  return fileFromBytes("test.jpg", arr, "image/jpeg");
}

// Minimal PNG with pHYs chunk set to 2835 pixels per meter (~72 dpi)
function makePng72Dpi(): File {
  const sig = [0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A];
  // IHDR chunk (length 13, type 'IHDR', dummy data, crc placeholder)
  const ihdrLen = [0x00,0x00,0x00,0x0D];
  const IHDR = [0x49,0x48,0x44,0x52];
  const ihdrData = [0,0,0,1, 0,0,0,1, 8, 2, 0, 0, 0]; // 1x1, 8-bit, truecolor
  const ihdrCrc = [0,0,0,0];
  // pHYs chunk (length 9, type 'pHYs', 2835 ppm both axes, unit=1)
  const physLen = [0x00,0x00,0x00,0x09];
  const pHYs = [0x70,0x48,0x59,0x73];
  const ppm = [0x00,0x00,0x0B,0x13]; // 2835
  const unit = [0x01];
  const physCrc = [0,0,0,0];
  // IDAT/IEND minimal to finish
  const idatLen = [0,0,0,0]; const IDAT = [0x49,0x44,0x41,0x54]; const idatCrc=[0,0,0,0];
  const iendLen = [0,0,0,0]; const IEND = [0x49,0x45,0x4E,0x44]; const iendCrc=[0,0,0,0];
  const arr = [...sig, ...ihdrLen, ...IHDR, ...ihdrData, ...ihdrCrc, ...physLen, ...pHYs, ...ppm, ...ppm, ...unit, ...physCrc, ...idatLen, ...IDAT, ...idatCrc, ...iendLen, ...IEND, ...iendCrc];
  return fileFromBytes("test.png", arr, "image/png");
}

test("extracts 72 DPI from JPEG JFIF", async () => {
  const dpi = await getDpi(makeJpeg72Dpi());
  expect(dpi).toBe(72);
});

test("extracts ~72 DPI from PNG pHYs", async () => {
  const dpi = await getDpi(makePng72Dpi());
  expect(dpi).toBe(72);
});

test("returns null for unsupported/unknown", async () => {
  const f = fileFromBytes("x.bin", [0,1,2,3,4], "application/octet-stream");
  const dpi = await getDpi(f);
  expect(dpi).toBeNull();
});
