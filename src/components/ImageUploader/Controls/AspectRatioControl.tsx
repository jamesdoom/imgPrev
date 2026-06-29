// src/components/ImageUploader/Controls/AspectRatioControl.tsx

import type { ReactElement } from "react";

interface AspectRatioButtonsProps {
  aspectRatio: number;
  setAspectRatio: (ratio: number) => void;
}

const ASPECT_RATIO_OPTIONS = [
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
] as const;

export default function AspectRatioButtons({
  aspectRatio,
  setAspectRatio,
}: AspectRatioButtonsProps): ReactElement {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-gray-700">
      <span className="font-medium mr-2">Aspect Ratio:</span>

      <div role="radiogroup" aria-label="Aspect Ratio" className="flex gap-2">
        {ASPECT_RATIO_OPTIONS.map((option) => {
          const isSelected = aspectRatio === option.value;

          return (
            <label
              key={option.label}
              className={`cursor-pointer rounded border px-2 py-1 ${
                isSelected
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700"
              }`}
            >
              <input
                className="sr-only"
                type="radio"
                name="aspect-ratio"
                value={option.label}
                checked={isSelected}
                onChange={() => setAspectRatio(option.value)}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
