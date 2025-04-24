// components/ImageUploader/Dropzone.tsx
import { useDropzone } from "react-dropzone";

interface DropzoneProps {
  onDrop: (acceptedFiles: File[]) => void;
  disabled?: boolean;
}

export default function Dropzone({ onDrop, disabled = false }: DropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: 1,
    disabled,
  });

  return (
    <div
      {...getRootProps()}
      className="border-2 border-dashed border-gray-400 rounded-md p-6 text-center cursor-pointer hover:border-blue-500 transition"
    >
      <input {...getInputProps()} />
      {isDragActive ? (
        <p className="text-blue-600">Drop your image here...</p>
      ) : (
        <p className="text-gray-600">
          Drag & drop an image, or click to upload
        </p>
      )}
    </div>
  );
}
