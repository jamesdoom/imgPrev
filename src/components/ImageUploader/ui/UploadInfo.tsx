// /src/components/ImageUploader/UploadInfo.tsx

export default function UploadInfo() {
  return (
    <div className="mt-4 bg-gray-100 border border-gray-300 rounded-md p-4 text-sm text-gray-700">
      <p className="mb-1">
        ✅ Only allow image files: <strong>PNG, JPEG, WebP</strong>
      </p>
      <p>
        ✅ Max file size: <strong>21MB</strong>
      </p>
    </div>
  );
}
