const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");

const requiredScripts = [
  "check:client-ready",
  "test:client-ready",
  "test:quality",
  "test:e2e",
  "test:a11y",
];

const requiredDocs = [
  {
    filePath: "docs/client-test-plan.md",
    phrases: [
      "Confirm the receipt shows the saved print files",
      "Open Application instructions",
      "Print handoff panel",
      "Feedback Template",
      "Triage Rules",
    ],
  },
  {
    filePath: "docs/client-test-script.md",
    phrases: [
      "Client Testing Package",
      "[CUSTOMER APP URL]",
      "[ADMIN REVIEW URL]",
      "Artwork to Have Ready",
      "Feedback Template",
      "Blocker:",
      "Internal Send Checklist",
    ],
  },
  {
    filePath: "docs/quality-gate.md",
    phrases: ["Standard Done Checklist", "Regression Test Rule"],
  },
  {
    filePath: "docs/qa-baseline.md",
    phrases: ["npm run test:quality", "Manual Smoke Checks"],
  },
  {
    filePath: "docs/qa-notes.md",
    phrases: ["QA Notes"],
  },
];

const failures = [];

const packageJson = readJson("package.json");

for (const scriptName of requiredScripts) {
  if (!packageJson.scripts?.[scriptName]) {
    failures.push(`Missing package script: ${scriptName}`);
  }
}

for (const doc of requiredDocs) {
  const absolutePath = path.join(rootDir, doc.filePath);

  if (!fs.existsSync(absolutePath)) {
    failures.push(`Missing readiness document: ${doc.filePath}`);
    continue;
  }

  const contents = fs.readFileSync(absolutePath, "utf8");

  for (const phrase of doc.phrases) {
    if (!contents.includes(phrase)) {
      failures.push(`${doc.filePath} is missing: ${phrase}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Client readiness check failed:");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log("Client readiness check passed.");
console.log("- Automated gate: npm run test:quality");
console.log("- Client walkthrough: docs/client-test-plan.md");
console.log("- Client test script: docs/client-test-script.md");
console.log("- Session notes: docs/qa-notes.md");

function readJson(filePath) {
  const absolutePath = path.join(rootDir, filePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}
