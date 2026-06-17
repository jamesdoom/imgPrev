// src/components/ImageUploader/Spinner.tsx

import type { ReactElement } from "react";

export default function Spinner(): ReactElement {
  return (
    <div className="mt-4 flex justify-center">
      <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
