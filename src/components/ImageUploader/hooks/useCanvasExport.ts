import { useCallback, type RefObject } from "react";
import type Konva from "konva";

interface UseCanvasExportOptions {
  stageRef: RefObject<Konva.Stage | null>;
  setShowGrid: (show: boolean) => void;
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export function useCanvasExport({
  stageRef,
  setShowGrid,
}: UseCanvasExportOptions) {
  const getCleanCanvasBlob = useCallback(async (): Promise<Blob | null> => {
    if (!stageRef.current) return null;

    setShowGrid(false);
    await waitForPaint();

    try {
      const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
      return await (await fetch(dataUrl)).blob();
    } finally {
      setShowGrid(true);
    }
  }, [setShowGrid, stageRef]);

  const download = useCallback(async () => {
    const blob = await getCleanCanvasBlob();
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = "exported-image.png";
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [getCleanCanvasBlob]);

  return {
    download,
    getCleanCanvasBlob,
  };
}
