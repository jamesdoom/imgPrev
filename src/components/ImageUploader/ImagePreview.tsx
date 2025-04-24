// components/ImageUploader/ImagePreview.tsx

interface Props {
  previewUrl: string | null;
  hasCropped: boolean;
  croppingImageUrl: string | null;
}

export default function ImagePreview({
  previewUrl,
  hasCropped,
  croppingImageUrl,
}: Props) {
  if (!previewUrl || croppingImageUrl) return null;

  return (
    <div className="mt-4">
      <h2 className="text-lg font-semibold mb-2">
        {hasCropped ? "Cropped Preview:" : "Original Preview:"}
      </h2>
      <img
        src={previewUrl}
        alt={hasCropped ? "Cropped preview" : "Original preview"}
        className="rounded shadow w-full"
        loading="lazy"
      />
    </div>
  );
}
