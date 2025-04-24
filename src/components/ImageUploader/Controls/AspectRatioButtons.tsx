interface AspectRatioButtonsProps {
  aspectRatio: number;
  setAspectRatio: (ratio: number) => void;
}

export default function AspectRatioButtons({
  aspectRatio,
  setAspectRatio,
}: AspectRatioButtonsProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-gray-700">
      <span className="font-medium mr-2">Aspect Ratio:</span>
      <button
        onClick={() => setAspectRatio(1)}
        className={`px-2 py-1 rounded border ${
          aspectRatio === 1
            ? "bg-blue-600 text-white"
            : "bg-white text-gray-700"
        }`}
      >
        1:1
      </button>
      <button
        onClick={() => setAspectRatio(4 / 3)}
        className={`px-2 py-1 rounded border ${
          aspectRatio === 4 / 3
            ? "bg-blue-600 text-white"
            : "bg-white text-gray-700"
        }`}
      >
        4:3
      </button>
      <button
        onClick={() => setAspectRatio(16 / 9)}
        className={`px-2 py-1 rounded border ${
          aspectRatio === 16 / 9
            ? "bg-blue-600 text-white"
            : "bg-white text-gray-700"
        }`}
      >
        16:9
      </button>
    </div>
  );
}
