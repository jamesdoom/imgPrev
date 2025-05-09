// /src/components/ImageUploader/ImagePreview.tsx

function DpiLabel({ dpi }: { dpi: number | null }) {
  if (!dpi) return null;
  return <div className="mt-1 text-xs text-gray-500">Detected DPI: {dpi}</div>;
}

interface Props {
  previewUrl: string | null;
  hasCropped: boolean;
  croppingImageUrl: string | null;
  file: File | null;
  dpi: number | null;
}

export default function ImagePreview({
  previewUrl,
  hasCropped,
  croppingImageUrl,
  file,
  dpi,
}: Props) {
  if (!previewUrl || (croppingImageUrl && !hasCropped)) return null;
  console.log("Rendering ImagePreview with previewUrl:", previewUrl);

  return (
    <div className="mt-4">
      <h2 className="text-lg font-semibold mb-2">
        {hasCropped ? "Cropped Preview:" : "Original Preview:"}
      </h2>
      <img
        src={previewUrl}
        alt={hasCropped ? "Cropped Preview" : "Original Preview"}
        className="rounded shadow w-full"
        loading="lazy"
        onError={() => console.error("Image failed to load:", previewUrl)}
      />

      {/* File info and DPI */}
      {file && (
        <div className="mt-2 text-sm text-gray-600">
          {file.name} – {(file.size / 1024 / 1024).toFixed(2)} MB
          <DpiLabel dpi={dpi} />
        </div>
      )}
    </div>
  );
}
