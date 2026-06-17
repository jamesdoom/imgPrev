type AppEnvKey =
  | "VITE_API_BASE_URL"
  | "VITE_CLOUDINARY_UPLOAD_PRESET"
  | "VITE_CLOUDINARY_CLOUD_NAME";

declare const __APP_ENV__: Partial<Record<AppEnvKey, string>> | undefined;

const appEnv = typeof __APP_ENV__ === "undefined" ? {} : __APP_ENV__;

export const API_BASE_URL =
  appEnv.VITE_API_BASE_URL ?? "http://localhost:4000";

export const CLOUDINARY_UPLOAD_PRESET =
  appEnv.VITE_CLOUDINARY_UPLOAD_PRESET ?? "frontend_unsigned";

export const CLOUDINARY_CLOUD_NAME =
  appEnv.VITE_CLOUDINARY_CLOUD_NAME ?? "demo";
