// setupTests.ts

import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value: vi.fn(() => null),
});

Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
  configurable: true,
  value: vi.fn(() => "data:image/png;base64,"),
});
