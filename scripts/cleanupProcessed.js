const fs = require("fs");
const path = require("path");

const PROCESSED_DIR = path.join(__dirname, "../backend/storage/processed");
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const configuredMaxAge = Number(process.env.PROCESSED_MAX_AGE_MS);
const MAX_AGE_MS =
  Number.isFinite(configuredMaxAge) && configuredMaxAge > 0
    ? configuredMaxAge
    : DEFAULT_MAX_AGE_MS;

console.log(`Scanning: ${PROCESSED_DIR}`);
console.log(`Max age for files: ${Math.round(MAX_AGE_MS / 1000)} seconds`);

fs.readdir(PROCESSED_DIR, (err, files) => {
  if (err) {
    console.error("Error reading processed directory:", err);
    return;
  }

  if (files.length === 0) {
    console.log("No files to clean up.");
    return;
  }

  const now = Date.now();

  files.forEach((file) => {
    const filePath = path.join(PROCESSED_DIR, file);

    fs.stat(filePath, (err, stats) => {
      if (err) {
        console.error("Error getting stats for", file, ":", err);
        return;
      }

      const age = now - stats.mtimeMs;
      console.log(`Found ${file} (${Math.round(age / 1000)}s old)`);

      if (age > MAX_AGE_MS) {
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error("Failed to delete:", file, "-", err.message);
          } else {
            console.log("Deleted:", file);
          }
        });
      }
    });
  });
});
