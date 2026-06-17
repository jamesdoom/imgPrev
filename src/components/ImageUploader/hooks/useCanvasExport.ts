import { useCallback, type RefObject } from "react";
import type Konva from "konva";
import {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_UPLOAD_PRESET,
} from "../../../config/appEnv";
import { showToast } from "../utils/showToast";
import { uploadToCloudinary } from "../utils/uploadToCloudinary";

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

  const uploadToCloud = useCallback(async () => {
    if (!stageRef.current) return;

    try {
      const blob = await getCleanCanvasBlob();
      if (!blob) return;

      const cloudUrl = await uploadToCloudinary(
        blob,
        CLOUDINARY_UPLOAD_PRESET,
        CLOUDINARY_CLOUD_NAME
      );

      showToast("Uploaded to Cloudinary!", {
        id: "cloud-upload-success",
      });
      showToast(cloudUrl, { id: "cloud-upload-url", duration: 5000 });
    } catch (err) {
      console.error(err);
      showToast("Cloud upload failed", {
        id: "cloud-upload-error",
      });
    }
  }, [getCleanCanvasBlob, stageRef]);

  return {
    download,
    getCleanCanvasBlob,
    uploadToCloud,
  };
}
