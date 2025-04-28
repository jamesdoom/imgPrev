// components/ImageUploader/ImagePreview.tsx

interface Props {
  previewUrl: string | null;
  hasCropped: boolean;
  croppingImageUrl: string | null;
  file: File | null;
}

export default function ImagePreview({
  previewUrl,
  hasCropped,
  croppingImageUrl,
  file,
}: Props) {
  if (!previewUrl || croppingImageUrl) return null;

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
      />

      {/* File info directly under the image */}
      {file && (
        <p className="mt-2 text-sm text-gray-500">
          {file.name} – {(file.size / 1024 / 1024).toFixed(2)} MB
        </p>
      )}
    </div>
  );
}
