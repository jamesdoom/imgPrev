// components/ImageUploader/FileInfo.tsx

interface Props {
  onRemove: () => void;
}

export default function FileInfo({ onRemove }: Props) {
  return (
    <div className="mt-4">
      <button
        onClick={onRemove}
        className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
      >
        Remove Image
      </button>
    </div>
  );
}
