export async function uploadToCloudinary(
  blob: Blob,
  uploadPreset: string,
  cloudName: string
) {
  const formData = new FormData();
  formData.append("file", blob);
  formData.append("upload_preset", uploadPreset);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error("Cloudinary upload failed");
  }

  const data = await response.json();
  return data.secure_url; // URL of the uploaded image
}
