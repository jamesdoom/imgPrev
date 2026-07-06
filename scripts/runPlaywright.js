const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");

const env = { ...process.env };
const host = "127.0.0.1";
const port = 5173;
const serverUrl = `http://${host}:${port}`;

delete env.NO_COLOR;

env.PLAYWRIGHT_MANAGED_SERVER = "1";

let serverProcess = null;
let stoppingServer = false;

run().then(
  (exitCode) => {
    process.exit(exitCode);
  },
  (error) => {
    console.error(error);
    process.exit(1);
  }
);

async function run() {
  const existingServer = await isServerReady();

  if (!existingServer) {
    serverProcess = spawn(
      process.execPath,
      [getViteBinPath(), "--host", host, "--port", String(port)],
      {
        env,
        stdio: "inherit",
      }
    );

    serverProcess.on("exit", (code, signal) => {
      if (stoppingServer) {
        return;
      }

      if (code !== null && code !== 0) {
        console.error(`Vite dev server exited with code ${code}.`);
      }

      if (signal) {
        console.error(`Vite dev server exited with signal ${signal}.`);
      }
    });

    await waitForServer();
  }

  try {
    return await runPlaywright();
  } finally {
    if (serverProcess) {
      stoppingServer = true;
      await stopServer(serverProcess);
    }
  }
}

function runPlaywright() {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [require.resolve("@playwright/test/cli"), "test", ...process.argv.slice(2)],
      {
        env,
        stdio: "inherit",
      }
    );

    child.on("exit", (code, signal) => {
      if (signal) {
        resolve(1);
        return;
      }

      resolve(code ?? 1);
    });
  });
}

async function waitForServer() {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    if (await isServerReady()) {
      return;
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for dev server at ${serverUrl}.`);
}

function isServerReady() {
  return new Promise((resolve) => {
    const request = http.get(serverUrl, (response) => {
      response.resume();
      resolve(response.statusCode ? response.statusCode < 500 : false);
    });

    request.on("error", () => resolve(false));
    request.setTimeout(1_000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

function stopServer(child) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGKILL");
      }

      resolve();
    }, 5_000);

    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });

    child.kill();
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getViteBinPath() {
  return path.join(path.dirname(require.resolve("vite/package.json")), "bin", "vite.js");
}
