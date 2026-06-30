// src/components/ImageUploader/Dropzone.tsx

import type { ReactElement } from "react";
import { useDropzone } from "react-dropzone";
import { ArrowUpTrayIcon, PhotoIcon } from "@heroicons/react/24/outline";

export interface DropzoneProps {
  onDrop: (acceptedFiles: File[]) => void;
  disabled?: boolean;
}

export default function Dropzone({
  onDrop,
  disabled = false,
}: DropzoneProps): ReactElement {
  const rootClassName = `flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-gray-400 bg-white px-4 py-5 text-center transition ${
    disabled
      ? "cursor-not-allowed opacity-60"
      : "cursor-pointer hover:border-gray-600 hover:bg-gray-50"
  }`;
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: 1,
    disabled,
  });

  return (
    <div
      {...getRootProps()}
      data-testid="dropzone"
      tabIndex={disabled ? -1 : 0}
      className={rootClassName}
    >
      <input
        {...getInputProps({ "aria-label": "Upload image file" })}
        data-testid="file-input"
      />
      {isDragActive ? (
        <>
          <ArrowUpTrayIcon className="h-7 w-7 text-gray-700" aria-hidden />
          <p className="text-sm font-medium text-gray-800">
            Drop your image here
          </p>
        </>
      ) : (
        <>
          <PhotoIcon className="h-7 w-7 text-gray-500" aria-hidden />
          <p className="text-sm font-medium text-gray-800">
            Drag & drop an image, or click to upload
          </p>
        </>
      )}
    </div>
  );
}
