type AppEnvKey = "VITE_API_BASE_URL";

declare const __APP_ENV__: Partial<Record<AppEnvKey, string>> | undefined;

const appEnv = typeof __APP_ENV__ === "undefined" ? {} : __APP_ENV__;

export const API_BASE_URL =
  appEnv.VITE_API_BASE_URL ?? "http://localhost:4000";
