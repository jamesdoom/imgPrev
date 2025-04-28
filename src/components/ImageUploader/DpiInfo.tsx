// src/components/ImageUploader/DpiInfo.tsx

interface Props {
  dpi: number | null;
}

export default function DpiInfo({ dpi }: Props) {
  if (!dpi) return null;

  return (
    <div className="mt-2 text-sm text-gray-700">
      <strong>DPI:</strong> {dpi}
    </div>
  );
}
