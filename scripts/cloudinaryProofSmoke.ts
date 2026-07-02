import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import request from "supertest";
import { createApp } from "../backend/app";

const requiredEnv = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
] as const;

const validPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);

interface SmokeResponse {
  cloudinary?: {
    files: Array<{
      path: string;
      resourceType: "image" | "raw";
      secureUrl: string;
    }>;
    folder: string;
  };
  projectId?: string;
  status?: string;
}

async function main() {
  const missingEnv = requiredEnv.filter((key) => !process.env[key]);

  if (missingEnv.length > 0) {
    throw new Error(`Missing Cloudinary env: ${missingEnv.join(", ")}`);
  }

  const response = await request(createApp())
    .post("/submit-project")
    .field("manifest", JSON.stringify(createRenderManifest()))
    .attach("assets", validPng, {
      contentType: "image/png",
      filename: "cloudinary-smoke.png",
    });
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

  const uploadedPaths = body.cloudinary.files.map((file) => file.path).sort();
  const expectedPaths = [
    "assets/cloudinary-smoke.png",
    "manifest.json",
    "preview.png",
    "print.pdf",
    "project.json",
    "review.json",
  ];
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
  console.log(`Folder: ${body.cloudinary.folder}`);
  body.cloudinary.files
    .slice()
    .sort((first, second) => first.path.localeCompare(second.path))
    .forEach((file) => {
      console.log(`${file.resourceType}: ${file.path} -> ${file.secureUrl}`);
    });
}

function createRenderManifest() {
  return {
    document: {
      assets: [
        {
          fileName: "cloudinary-smoke.png",
          fileType: "image/png",
          id: "asset-1",
          sourceUrl: "blob:asset-1",
        },
      ],
      id: "cloudinary-smoke-project",
      items: [
        {
          assetId: "asset-1",
          heightIn: 0.75,
          id: "item-1",
          rotationDeg: 0,
          scaleX: 1,
          scaleY: 1,
          widthIn: 0.75,
          xIn: 0.5,
          yIn: 0.5,
        },
      ],
      productionProfileId: "sticker-sheet-mvp",
      settings: {
        background: {
          type: "transparent",
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
