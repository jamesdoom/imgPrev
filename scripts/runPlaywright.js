const { spawnSync } = require("node:child_process");

const env = { ...process.env };

delete env.NO_COLOR;

const result = spawnSync(
  process.execPath,
  [require.resolve("@playwright/test/cli"), "test", ...process.argv.slice(2)],
  {
    env,
    stdio: "inherit",
  }
);

process.exit(result.status ?? 1);
