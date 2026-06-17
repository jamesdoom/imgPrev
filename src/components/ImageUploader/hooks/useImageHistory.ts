import { useCallback, useState } from "react";
import { showToast } from "../utils/showToast";
import type { ImageUpdate, ImageUpdater, UploadedImage } from "../../../types";

export function useImageHistory() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [history, setHistory] = useState<UploadedImage[][]>([]);
  const [redoStack, setRedoStack] = useState<UploadedImage[][]>([]);

  const updateImages: ImageUpdater = useCallback((updater) => {
    setImages((prev) => {
      const next = updater(prev);
      setHistory((h) => [...h.slice(-19), prev]);
      setRedoStack([]);
      return next;
    });
  }, []);

  const updateImage = useCallback(
    (id: string, updates: ImageUpdate) => {
      updateImages((prev) =>
        prev.map((img) => (img.id === id ? { ...img, ...updates } : img))
      );
    },
    [updateImages]
  );

  const undo = useCallback(() => {
    setImages((current) => {
      if (history.length === 0) return current;
      const previous = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      setRedoStack((r) => [current, ...r]);
      showToast("Undo performed", { id: "undo-toast" });
      return previous;
    });
  }, [history]);

  const redo = useCallback(() => {
    setImages((current) => {
      if (redoStack.length === 0) return current;
      const next = redoStack[0];
      setRedoStack((r) => r.slice(1));
      setHistory((h) => [...h, current]);
      showToast("Redo applied", { id: "redo-toast" });
      return next;
    });
  }, [redoStack]);

  return {
    images,
    updateImages,
    updateImage,
    undo,
    redo,
    canUndo: history.length > 0,
    canRedo: redoStack.length > 0,
  };
}
