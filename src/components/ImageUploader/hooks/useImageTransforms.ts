import { useCallback } from "react";
import type { ImageUpdate, UploadedImage } from "../../../types";
import { showToast } from "../utils/showToast";
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
    showToast("Flipped image horizontally", { id: "flip-toast" });
  }, [getSelectedImage, selectedId, updateImage]);

  const flipSelectedVertical = useCallback(() => {
    const image = getSelectedImage();
    if (!image || !selectedId) return;
    updateImage(selectedId, flipVertical(image));
    showToast("Flipped image vertically", {
      id: "flip-vertical-toast",
    });
  }, [getSelectedImage, selectedId, updateImage]);

  const rotateSelected = useCallback(() => {
    const image = getSelectedImage();
    if (!image || !selectedId) return;
    updateImage(selectedId, rotate90(image));
    showToast("Rotated image 90 deg", { id: "rotate-toast" });
  }, [getSelectedImage, selectedId, updateImage]);

  const resetSelectedTransforms = useCallback(() => {
    const image = getSelectedImage();
    if (!image || !selectedId) return;
    updateImage(selectedId, resetTransform());
    showToast("Transform reset", { id: "reset-toast" });
  }, [getSelectedImage, selectedId, updateImage]);

  return {
    flipSelectedHorizontal,
    flipSelectedVertical,
    resetSelectedTransforms,
    rotateSelected,
  };
}
