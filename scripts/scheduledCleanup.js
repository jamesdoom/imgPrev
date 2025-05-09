const cron = require("node-cron");
const { exec } = require("child_process");

console.log("📅 Scheduled cleanup script initialized.");

// For testing: run every minute
// Change "*/1 * * * *" to "0 * * * *" for once an hour
cron.schedule("*/1 * * * *", () => {
  const timestamp = new Date().toLocaleString();
  console.log(`\n⏰ [${timestamp}] Running scheduled cleanup...`);

  exec("node scripts/cleanupProcessed.js", (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Cleanup failed: ${error.message}`);
      return;
    }
    if (stderr) {
      console.warn(`⚠️  stderr: ${stderr}`);
    }
    console.log(`✅ Cleanup completed:\n${stdout}`);
  });
});
