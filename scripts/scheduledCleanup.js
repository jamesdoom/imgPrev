const cron = require("node-cron");
const { execFile } = require("child_process");
const path = require("path");

console.log("Scheduled cleanup script initialized.");

const schedule = process.env.CLEANUP_CRON || "0 * * * *";
const cleanupScript = path.join(__dirname, "cleanupProcessed.js");

cron.schedule(schedule, () => {
  const timestamp = new Date().toLocaleString();
  console.log(`\n[${timestamp}] Running scheduled cleanup...`);

  execFile(process.execPath, [cleanupScript], (error, stdout, stderr) => {
    if (error) {
      console.error(`Cleanup failed: ${error.message}`);
      return;
    }
    if (stderr) {
      console.warn(`stderr: ${stderr}`);
    }
    console.log(`Cleanup completed:\n${stdout}`);
  });
});
