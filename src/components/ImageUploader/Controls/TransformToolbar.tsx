// src/components/ImageUploader/Controls/TransformToolbar.tsx

import type { ReactElement } from "react";
import {
  ArrowPathIcon,
  ArrowUturnRightIcon,
  ArrowsRightLeftIcon,
  ArrowsUpDownIcon,
} from "@heroicons/react/24/outline";

interface Props {
  isImageSelected: boolean;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  onRotate: () => void;
  onReset: () => void;
}

export default function TransformToolbar({
  isImageSelected,
  onFlipHorizontal,
  onFlipVertical,
  onRotate,
  onReset,
}: Props): ReactElement {
  const buttonClass =
    "inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm transition hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div
      className="flex w-full flex-wrap items-center justify-center gap-2 border-y border-gray-200 bg-white/70 px-3 py-3"
      role="toolbar"
      aria-label="Transform controls"
    >
      <button
        type="button"
        onClick={onFlipHorizontal}
        disabled={!isImageSelected}
        title="Flip Horizontally (Ctrl+H)"
        aria-label="Flip Horizontally"
        className={buttonClass}
      >
        <ArrowsRightLeftIcon className="h-5 w-5" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onFlipVertical}
        disabled={!isImageSelected}
        title="Flip Vertically (Ctrl+V)"
        aria-label="Flip Vertically"
        className={buttonClass}
      >
        <ArrowsUpDownIcon className="h-5 w-5" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onRotate}
        disabled={!isImageSelected}
        title="Rotate 90 deg (Ctrl+R)"
        aria-label="Rotate 90 deg"
        className={buttonClass}
      >
        <ArrowUturnRightIcon className="h-5 w-5" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onReset}
        disabled={!isImageSelected}
        title="Reset Transform (Ctrl+Shift+R)"
        aria-label="Reset Transform"
        className={buttonClass}
      >
        <ArrowPathIcon className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
