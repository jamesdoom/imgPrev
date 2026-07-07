import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import sharp from "sharp";
import request from "supertest";
import { createApp } from "../backend/app";

const requiredEnv = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
] as const;

interface SmokeResponse {
  cloudinary?: {
    files: Array<{
      path: string;
      resourceType: "image" | "raw";
      secureUrl: string;
    }>;
    folder: string;
    status?: "queued" | "mirrored" | "skipped" | "failed";
  };
  projectId?: string;
  status?: string;
}

async function main() {
  const missingEnv = requiredEnv.filter((key) => !process.env[key]);

  if (missingEnv.length > 0) {
    throw new Error(`Missing Cloudinary env: ${missingEnv.join(", ")}`);
  }

  process.env.CLOUDINARY_PROOF_FOLDER = getSmokeProofFolder();

  const smokeAssets = await createSmokeAssets();
  const submission = request(createApp())
    .post("/submit-project")
    .field("manifest", JSON.stringify(createRenderManifest(smokeAssets)));

  smokeAssets.forEach((asset) => {
    submission.attach("assets", asset.buffer, {
      contentType: asset.contentType,
      filename: asset.fileName,
    });
  });

  const response = await submission;
  const body = response.body as SmokeResponse;

  if (response.status !== 201 || body.status !== "submitted") {
    throw new Error(
      `Proof submission failed with HTTP ${response.status}: ${JSON.stringify(
        response.body
      )}`
    );
  }

  if (!body.projectId || !body.cloudinary) {
    throw new Error("Proof submitted locally, but Cloudinary mirror was missing.");
  }

  const mirroredProject = await waitForCloudinaryMirror(body.projectId);
  const uploadedPaths = mirroredProject.cloudinary.files
    .map((file) => file.path)
    .sort();
  const expectedPaths = ["preview.png", "print.pdf"];
  const missingPaths = expectedPaths.filter(
    (expectedPath) => !uploadedPaths.includes(expectedPath)
  );

  if (missingPaths.length > 0) {
    throw new Error(
      `Cloudinary mirror is missing files: ${missingPaths.join(", ")}`
    );
  }

  await cleanupLocalProject(body.projectId);

  console.log("Cloudinary proof smoke passed");
  console.log(`Project: ${body.projectId}`);
  console.log(`Folder: ${mirroredProject.cloudinary.folder}`);
  mirroredProject.cloudinary.files
    .slice()
    .sort((first, second) => first.path.localeCompare(second.path))
    .forEach((file) => {
      console.log(`${file.resourceType}: ${file.path} -> ${file.secureUrl}`);
    });
}

async function waitForCloudinaryMirror(projectId: string): Promise<{
  cloudinary: NonNullable<SmokeResponse["cloudinary"]>;
}> {
  const deadline = Date.now() + 60_000;
  const projectJsonPath = path.resolve(
    __dirname,
    "..",
    "backend",
    "storage",
    "projects",
    projectId,
    "project.json"
  );

  while (Date.now() < deadline) {
    const projectJson = JSON.parse(
      await fs.promises.readFile(projectJsonPath, "utf8")
    ) as { cloudinary?: SmokeResponse["cloudinary"] };

    if (projectJson.cloudinary?.status === "mirrored") {
      return {
        cloudinary: projectJson.cloudinary,
      };
    }

    if (projectJson.cloudinary?.status === "failed") {
      throw new Error(
        `Cloudinary mirror failed: ${JSON.stringify(projectJson.cloudinary)}`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Timed out waiting for background Cloudinary mirror.");
}

function getSmokeProofFolder(): string {
  const baseFolder = process.env.CLOUDINARY_PROOF_FOLDER?.trim() || "decal-sheet";
  const normalizedBaseFolder = baseFolder
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/+/g, "/");

  return `${normalizedBaseFolder || "decal-sheet"}/_smoke`;
}

interface SmokeAsset {
  buffer: Buffer;
  contentType: "image/png";
  fileName: string;
  id: string;
}

async function createSmokeAssets(): Promise<SmokeAsset[]> {
  const assets = [
    {
      accent: "#0f766e",
      background: "#5eead4",
      fileName: "cloudinary-smoke-teal.png",
      id: "asset-teal",
      label: "TEAL DECAL",
    },
    {
      accent: "#c2410c",
      background: "#fdba74",
      fileName: "cloudinary-smoke-orange.png",
      id: "asset-orange",
      label: "ORANGE DECAL",
    },
  ];

  return Promise.all(
    assets.map(async (asset) => ({
      buffer: await renderSmokePng(asset),
      contentType: "image/png" as const,
      fileName: asset.fileName,
      id: asset.id,
    }))
  );
}

async function renderSmokePng({
  accent,
  background,
  label,
}: {
  accent: string;
  background: string;
  label: string;
}) {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
  <rect width="900" height="600" rx="48" fill="${background}"/>
  <rect x="42" y="42" width="816" height="516" rx="36" fill="none" stroke="${accent}" stroke-width="24" stroke-dasharray="44 28"/>
  <circle cx="190" cy="190" r="88" fill="${accent}" opacity="0.9"/>
  <circle cx="710" cy="410" r="118" fill="${accent}" opacity="0.22"/>
  <text x="450" y="276" text-anchor="middle" font-family="Arial, sans-serif" font-size="82" font-weight="700" fill="#111827">Cloudinary</text>
  <text x="450" y="376" text-anchor="middle" font-family="Arial, sans-serif" font-size="58" font-weight="700" fill="#111827">${label}</text>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

function createRenderManifest(smokeAssets: SmokeAsset[]) {
  return {
    document: {
      assets: smokeAssets.map((asset) => ({
        fileName: asset.fileName,
        fileType: asset.contentType,
        id: asset.id,
        sourceUrl: `smoke://${asset.id}`,
      })),
      id: "cloudinary-smoke-project",
      items: [
        {
          assetId: "asset-teal",
          heightIn: 4,
          id: "item-teal",
          rotationDeg: 0,
          scaleX: 1,
          scaleY: 1,
          widthIn: 6,
          xIn: 0.75,
          yIn: 0.75,
        },
        {
          assetId: "asset-orange",
          heightIn: 4,
          id: "item-orange",
          rotationDeg: -8,
          scaleX: 1,
          scaleY: 1,
          widthIn: 6,
          xIn: 4.25,
          yIn: 6.25,
        },
      ],
      productionProfileId: "sticker-sheet-mvp",
      settings: {
        background: {
          color: "#f8fafc",
          type: "solid",
        },
      },
      sheet: {
        dpi: 300,
        heightIn: 17,
        sizeId: "11x17",
        widthIn: 11,
      },
      version: 1,
    },
  };
}

async function cleanupLocalProject(projectId: string) {
  const projectDir = path.resolve(__dirname, "..", "backend", "storage", "projects", projectId);

  await fs.promises.rm(projectDir, {
    force: true,
    recursive: true,
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
