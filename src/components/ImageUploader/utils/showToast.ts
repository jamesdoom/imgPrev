// src/components/ImageUploader/utils/showToast.ts
import toast, { ToastOptions } from "react-hot-toast";

export function showToast(message: string, options: ToastOptions = {}) {
  return toast(message, {
    position: "top-center",
    duration: 3000,
    style: {
      background: "#333",
      color: "#fff",
    },
    ...options,
  });
}
