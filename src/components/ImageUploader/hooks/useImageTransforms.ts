import { useCallback } from "react";
import type { ImageUpdate, UploadedImage } from "../../../types";
import {
  flipHorizontal,
  flipVertical,
  resetTransform,
  rotate90,
} from "../utils/transformUtils";

interface UseImageTransformsOptions {
  images: UploadedImage[];
  selectedId: string | null;
  updateImage: (id: string, updates: ImageUpdate) => void;
}

export function useImageTransforms({
  images,
  selectedId,
  updateImage,
}: UseImageTransformsOptions) {
  const getSelectedImage = useCallback(() => {
    if (!selectedId) return null;
    return images.find((img) => img.id === selectedId) ?? null;
  }, [images, selectedId]);

  const flipSelectedHorizontal = useCallback(() => {
    const image = getSelectedImage();
    if (!image || !selectedId) return;
    updateImage(selectedId, flipHorizontal(image));
  }, [getSelectedImage, selectedId, updateImage]);

  const flipSelectedVertical = useCallback(() => {
    const image = getSelectedImage();
    if (!image || !selectedId) return;
    updateImage(selectedId, flipVertical(image));
  }, [getSelectedImage, selectedId, updateImage]);

  const rotateSelected = useCallback(() => {
    const image = getSelectedImage();
    if (!image || !selectedId) return;
    updateImage(selectedId, rotate90(image));
  }, [getSelectedImage, selectedId, updateImage]);

  const resetSelectedTransforms = useCallback(() => {
    const image = getSelectedImage();
    if (!image || !selectedId) return;
    updateImage(selectedId, resetTransform());
  }, [getSelectedImage, selectedId, updateImage]);

  return {
    flipSelectedHorizontal,
    flipSelectedVertical,
    resetSelectedTransforms,
    rotateSelected,
  };
}
