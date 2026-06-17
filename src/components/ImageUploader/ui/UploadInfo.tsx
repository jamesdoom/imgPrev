// src/components/ImageUploader/UploadInfo.tsx

import type { ReactElement } from "react";

export default function UploadInfo(): ReactElement {
  return (
    <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-600">
      <span className="rounded border border-gray-200 bg-white px-2.5 py-1">
        PNG, JPEG, WebP
      </span>
      <span className="rounded border border-gray-200 bg-white px-2.5 py-1">
        Max 21MB
      </span>
    </div>
  );
}
