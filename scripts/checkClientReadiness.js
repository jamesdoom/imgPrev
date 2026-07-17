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
    filePath: "docs/production-reliability-checks.md",
    phrases: [
      "Production Reliability Checks",
      "R2 upload or Neon persistence fails",
      "SMTP delivery fails",
      "Admin list API cannot read storage",
      "Reliability Invariants",
    ],
  },
  {
    filePath: "docs/deployment-environment.md",
    phrases: [
      "Deployment And Environment Reference",
      "VITE_API_BASE_URL",
      "DATABASE_URL",
      "R2_ACCESS_KEY_ID",
      "SMTP_HOST",
      "Retired Cloudinary Configuration",
    ],
  },
  {
    filePath: "docs/deployment-checklist.md",
    phrases: [
      "Deployment Checklist",
      "Post-Deploy Smoke Test",
      "Rollback",
      "Release Record",
    ],
  },
  {
    filePath: "docs/live-submission-proof.md",
    phrases: [
      "Live Submission Proof",
      "Operator Verification",
      "Status: passed",
      "approximately 30 seconds",
    ],
  },
  {
    filePath: "docs/client-feedback-log.md",
    phrases: [
      "Client Feedback Log",
      "Current Release-Candidate Status",
      "First submission latency on free-tier hosting",
      "Fix blockers first",
      "Regression test:",
    ],
  },
  {
    filePath: "docs/release-candidate-gate.md",
    phrases: [
      "Release-Candidate Gate",
      "Promotion Requirements",
      "No blocker or high issue remains open",
      "npm run test:client-ready",
      "Gate Decision",
    ],
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
const retiredCloudinaryVariables = [
  "VITE_CLOUDINARY_UPLOAD_PRESET",
  "VITE_CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "CLOUDINARY_PROOF_FOLDER",
];
const activeConfigurationFiles = [
  ".env.example",
  "package.json",
  "backend/package.json",
  "README.md",
  "src/config/appEnv.ts",
  "backend/app.ts",
];

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

for (const filePath of activeConfigurationFiles) {
  const contents = fs.readFileSync(path.join(rootDir, filePath), "utf8");

  for (const variableName of retiredCloudinaryVariables) {
    if (contents.includes(variableName)) {
      failures.push(
        `${filePath} still references retired variable: ${variableName}`
      );
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
console.log("- Feedback queue: docs/client-feedback-log.md");
console.log("- Release decision: docs/release-candidate-gate.md");
console.log("- Session notes: docs/qa-notes.md");

function readJson(filePath) {
  const absolutePath = path.join(rootDir, filePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}
