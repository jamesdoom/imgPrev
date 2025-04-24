type FileInfoProps = {
  file: File;
  onRemove: () => void;
};

export default function FileInfo({ file, onRemove }: FileInfoProps) {
  return (
    <div className="mt-4">
      <p className="text-sm text-gray-500">
        {file.name} – {(file.size / 1024 / 1024).toFixed(2)} MB
      </p>
      <button
        onClick={onRemove}
        className="mt-2 px-3 py-1 bg-gray-300 text-gray-800 text-sm rounded hover:bg-gray-400 transition-colors"
      >
        Remove Image
      </button>
    </div>
  );
}
