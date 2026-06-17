// src/types.ts
export interface Transform {
  rotation?: number; // degrees
  scaleX?: number;
  scaleY?: number;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Small helpers for reuse in components
export type Point = { x: number; y: number };
export type Size = { width: number; height: number };

export interface UploadedImage {
  id: string;
  url: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  width: number;
  height: number;
  rotation?: number;
  isHovered?: boolean;
  dpi?: number;
}

// Helpful alias for update callbacks
export type ImageUpdate = Partial<UploadedImage>;
export type ImageUpdater = (
  updater: (prev: UploadedImage[]) => UploadedImage[]
) => void;

export interface HistoryEntry {
  images: UploadedImage[];
}
