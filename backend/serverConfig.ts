export interface ServerBinding {
  host: string;
  port: number;
}

export function getServerBinding(
  env: NodeJS.ProcessEnv = process.env
): ServerBinding {
  const configuredPort = Number(env.PORT);

  return {
    host: env.HOST?.trim() || "0.0.0.0",
    port:
      Number.isInteger(configuredPort) &&
      configuredPort > 0 &&
      configuredPort <= 65_535
        ? configuredPort
        : 4000,
  };
}
