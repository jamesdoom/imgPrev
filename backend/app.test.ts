import request from "supertest";
import fs from "fs";
import path from "path";
import { Writable } from "stream";
import { v2 as cloudinary } from "cloudinary";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createApp } from "./app";
import { inspectProductionPdf, validateProductionPdf } from "./renderSheet";

const validPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);
const submittedProjectIds: string[] = [];
const projectsDir = path.resolve(__dirname, "storage", "projects");
const originalCloudinaryEnv = {
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_PROOF_FOLDER: process.env.CLOUDINARY_PROOF_FOLDER,
};
const originalProductionStorageEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  POSTGRES_SSL: process.env.POSTGRES_SSL,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  R2_BUCKET: process.env.R2_BUCKET,
  R2_ENDPOINT: process.env.R2_ENDPOINT,
  R2_PREFIX: process.env.R2_PREFIX,
  R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL,
  R2_REGION: process.env.R2_REGION,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
};
type TestCloudinaryStatus = "queued" | "mirrored" | "skipped" | "failed";
type TestProductionStorageStatus = "queued" | "stored" | "skipped" | "failed";
interface TestProjectJson {
  cloudinary?: {
    files?: Array<{ path: string }>;
    folder?: string;
    status?: TestCloudinaryStatus;
    warnings?: string[];
  };
  storage?: {
    provider?: "postgres+r2";
    status?: TestProductionStorageStatus;
    warnings?: string[];
  };
}

beforeEach(() => {
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_PROOF_FOLDER;
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_SSL;
  delete process.env.R2_ACCESS_KEY_ID;
  delete process.env.R2_ACCOUNT_ID;
  delete process.env.R2_BUCKET;
  delete process.env.R2_ENDPOINT;
  delete process.env.R2_PREFIX;
  delete process.env.R2_PUBLIC_BASE_URL;
  delete process.env.R2_REGION;
  delete process.env.R2_SECRET_ACCESS_KEY;
});

afterEach(async () => {
  await Promise.all(
    submittedProjectIds.splice(0).map((projectId) =>
      fs.promises.rm(path.join(projectsDir, projectId), {
        force: true,
        recursive: true,
      })
    )
  );
  restoreCloudinaryEnv();
  restoreProductionStorageEnv();
  vi.restoreAllMocks();
});

function renderManifest() {
  return {
    document: {
      id: "project-1",
      version: 1,
      productionProfileId: "sticker-sheet-mvp",
      sheet: {
        sizeId: "11x17",
        widthIn: 11,
        heightIn: 17,
        dpi: 300,
      },
      assets: [
        {
          id: "asset-1",
          sourceUrl: "blob:asset-1",
          fileName: "pixel.png",
          fileType: "image/png",
        },
      ],
      items: [
        {
          id: "item-1",
          assetId: "asset-1",
          xIn: 0.5,
          yIn: 0.5,
          widthIn: 0.75,
          heightIn: 0.75,
          rotationDeg: 0,
          scaleX: 1,
          scaleY: 1,
        },
      ],
      settings: {
        background: {
          type: "transparent",
        },
      },
    },
  };
}

async function waitForProjectCloudinaryStatus(
  projectId: string,
  status: TestCloudinaryStatus
): Promise<TestProjectJson> {
  const deadline = Date.now() + 2_000;

  while (Date.now() < deadline) {
    const projectJson = JSON.parse(
      await fs.promises.readFile(
        path.join(projectsDir, projectId, "project.json"),
        "utf8"
      )
    );

    if (projectJson.cloudinary?.status === status) {
      return projectJson;
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(`Timed out waiting for Cloudinary status ${status}.`);
}

describe("backend app", () => {
  test("responds to the health check", async () => {
    const response = await request(createApp()).get("/");

    expect(response.status).toBe(200);
    expect(response.text).toBe("Server is running!");
  });

  test("rejects upload requests without a file", async () => {
    const response = await request(createApp()).post("/upload");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "No file uploaded." });
  });

  test("rejects unsupported upload MIME types", async () => {
    const response = await request(createApp())
      .post("/upload")
      .attach("image", Buffer.from("hello"), {
        filename: "notes.txt",
        contentType: "text/plain",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Only PNG, JPEG, and WebP images are allowed.",
    });
  });

  test("rejects uploads over 21MB", async () => {
    const response = await request(createApp())
      .post("/upload")
      .attach("image", Buffer.alloc(21 * 1024 * 1024 + 1), {
        filename: "large.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Image must be 21MB or smaller." });
  });

  test("processes a valid image upload", async () => {
    const response = await request(createApp())
      .post("/upload")
      .attach("image", validPng, {
        filename: "pixel.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(200);
    expect(response.body.previewUrl).toMatch(
      /^\/processed\/preview-\d+\.webp$/
    );
  });

  test("rejects missing cloud-save filenames", async () => {
    const response = await request(createApp()).post("/save-to-cloud").send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Invalid filename." });
  });

  test("rejects cloud-save path traversal filenames", async () => {
    const response = await request(createApp())
      .post("/save-to-cloud")
      .send({ filename: "../preview-123.webp" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Invalid filename." });
  });

  test("rejects cloud-save filenames that do not match processed previews", async () => {
    const response = await request(createApp())
      .post("/save-to-cloud")
      .send({ filename: "not-a-preview.webp" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Invalid filename." });
  });

  test("reports missing Cloudinary config after validating a safe filename", async () => {
    const response = await request(createApp())
      .post("/save-to-cloud")
      .send({ filename: "preview-123.webp" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Cloudinary is not configured." });
  });

  test("rejects sheet renders without a manifest", async () => {
    const response = await request(createApp()).post("/render-sheet");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Missing render manifest." });
  });

  test("rejects sheet renders with invalid manifest JSON", async () => {
    const response = await request(createApp())
      .post("/render-sheet")
      .field("manifest", "{not-json");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Render manifest must be valid JSON.",
    });
  });

  test("rejects sheet renders when a placed asset file is missing", async () => {
    const response = await request(createApp())
      .post("/render-sheet")
      .field("manifest", JSON.stringify(renderManifest()));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Missing uploaded asset file: pixel.png.",
    });
  });

  test("renders a sheet preview PNG and production PDF", async () => {
    const response = await request(createApp())
      .post("/render-sheet")
      .field("manifest", JSON.stringify(renderManifest()))
      .attach("assets", validPng, {
        filename: "pixel.png",
        contentType: "image/png",
      });

    const previewPng = Buffer.from(response.body.previewPngBase64, "base64");
    const printPdf = Buffer.from(response.body.printPdfBase64, "base64");

    expect(response.status).toBe(200);
    expect(response.body.widthPx).toBe(3300);
    expect(response.body.heightPx).toBe(5100);
    expect(previewPng.subarray(0, 8)).toEqual(
      Buffer.from("89504e470d0a1a0a", "hex")
    );
    expect(printPdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(inspectProductionPdf(printPdf)).toMatchObject({
      imageCount: 2,
      imageHeightPx: 5100,
      imageWidthPx: 3300,
      pageCount: 1,
      pageHeightPt: 1224,
      pageWidthPt: 792,
    });
    expect(() =>
      validateProductionPdf(printPdf, {
        dpi: 300,
        heightPx: 5100,
        widthPx: 3300,
      })
    ).not.toThrow();
  });

  test("rejects invalid production PDF structure during validation", () => {
    expect(() =>
      validateProductionPdf(Buffer.from("%PDF-1.4\n%%EOF\n"), {
        dpi: 300,
        heightPx: 5100,
        widthPx: 3300,
      })
    ).toThrow("Generated print PDF must contain exactly one page.");
  });

  test("submits a rendered project for internal review", async () => {
    const response = await request(createApp())
      .post("/submit-project")
      .field("manifest", JSON.stringify(renderManifest()))
      .attach("assets", validPng, {
        filename: "pixel.png",
        contentType: "image/png",
      });

    submittedProjectIds.push(response.body.projectId);

    const projectDir = path.join(projectsDir, response.body.projectId);
    const projectJson = JSON.parse(
      await fs.promises.readFile(path.join(projectDir, "project.json"), "utf8")
    );
    const previewPng = await fs.promises.readFile(
      path.join(projectDir, "preview.png")
    );
    const printPdf = await fs.promises.readFile(
      path.join(projectDir, "print.pdf")
    );
    const manifestJson = JSON.parse(
      await fs.promises.readFile(path.join(projectDir, "manifest.json"), "utf8")
    );
    const orderJson = JSON.parse(
      await fs.promises.readFile(path.join(projectDir, "order.json"), "utf8")
    );
    const reviewJson = JSON.parse(
      await fs.promises.readFile(path.join(projectDir, "review.json"), "utf8")
    );
    const originalAsset = await fs.promises.readFile(
      path.join(projectDir, "assets", "pixel.png")
    );

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      status: "submitted",
      email: {
        status: "not-configured",
      },
      storage: {
        provider: "postgres+r2",
        status: "skipped",
      },
      files: {
        projectJson: expect.stringMatching(/^\/projects\/project-/),
        orderJson: expect.stringMatching(/^\/projects\/project-/),
        previewPng: expect.stringMatching(/^\/projects\/project-/),
        printPdf: expect.stringMatching(/^\/projects\/project-/),
        manifestJson: expect.stringMatching(/^\/projects\/project-/),
        assets: expect.stringMatching(/^\/projects\/project-/),
      },
    });
    expect(response.body.projectId).toMatch(/^project-\d+-[a-z0-9]+$/);
    expect(projectJson.projectId).toBe(response.body.projectId);
    expect(projectJson.submittedAt).toEqual(expect.any(String));
    expect(orderJson).toMatchObject({
      orderId: response.body.projectId,
      projectId: response.body.projectId,
      status: "submitted",
      customer: {
        company: "",
        email: "",
        name: "",
        note: "",
      },
      files: {
        orderJson: `/projects/${response.body.projectId}/order.json`,
        printPdf: `/projects/${response.body.projectId}/print.pdf`,
      },
      email: {
        status: "not-configured",
      },
      storage: {
        provider: "postgres+r2",
        status: "skipped",
      },
    });
    expect(projectJson.storage).toMatchObject({
      provider: "postgres+r2",
      status: "skipped",
    });
    expect(previewPng.subarray(0, 8)).toEqual(
      Buffer.from("89504e470d0a1a0a", "hex")
    );
    expect(printPdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(() =>
      validateProductionPdf(printPdf, {
        dpi: 300,
        heightPx: 5100,
        widthPx: 3300,
      })
    ).not.toThrow();
    expect(manifestJson.document.id).toBe("project-1");
    expect(reviewJson).toMatchObject({
      status: "submitted",
      updatedAt: projectJson.submittedAt,
      history: [],
    });
    expect(originalAsset).toEqual(validPng);
  });

  test("queues Cloudinary mirroring after saving submitted proof files", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "demo";
    process.env.CLOUDINARY_API_KEY = "key";
    process.env.CLOUDINARY_API_SECRET = "secret";
    process.env.CLOUDINARY_PROOF_FOLDER = "decal-sheet";

    const uploadedFiles: Array<{
      bytes: number;
      options: {
        folder?: string;
        public_id?: string;
        resource_type?: string;
      };
    }> = [];

    vi.spyOn(cloudinary.uploader, "upload_stream").mockImplementation(
      ((options, callback) => {
        let bytes = 0;
        const writable = new Writable({
          write(chunk: Buffer, _encoding, done) {
            bytes += chunk.length;
            done();
          },
        });

        writable.on("finish", () => {
          uploadedFiles.push({ bytes, options });
          callback?.(undefined, {
            public_id: `${options.folder}/${options.public_id}`,
            secure_url: `https://res.cloudinary.com/demo/${options.resource_type}/upload/${options.folder}/${options.public_id}`,
          });
        });

        return writable;
      }) as typeof cloudinary.uploader.upload_stream
    );

    const response = await request(createApp())
      .post("/submit-project")
      .field("manifest", JSON.stringify(renderManifest()))
      .attach("assets", validPng, {
        filename: "pixel.png",
        contentType: "image/png",
      });

    submittedProjectIds.push(response.body.projectId);

    expect(response.status).toBe(201);
    expect(response.body.cloudinary.folder).toBe(
      `decal-sheet/${response.body.projectId}`
    );
    expect(response.body.cloudinary.status).toBe("queued");
    expect(response.body.cloudinary.files).toEqual([]);

    const mirroredProjectJson = await waitForProjectCloudinaryStatus(
      response.body.projectId,
      "mirrored"
    );
    const uploadedPublicIds = uploadedFiles.map(
      (file) => file.options.public_id
    );

    expect(mirroredProjectJson.cloudinary.folder).toBe(
      `decal-sheet/${response.body.projectId}`
    );
    expect(mirroredProjectJson.cloudinary.status).toBe("mirrored");
    expect(mirroredProjectJson.storage).toMatchObject({
      provider: "postgres+r2",
      status: "skipped",
    });
    expect(uploadedPublicIds).toEqual(
      expect.arrayContaining(["preview", "print.pdf"])
    );
    expect(uploadedPublicIds).not.toEqual(
      expect.arrayContaining([
        "assets/pixel",
        "manifest.json",
        "project.json",
        "review.json",
      ])
    );
    expect(uploadedFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          options: expect.objectContaining({ resource_type: "image" }),
        }),
        expect.objectContaining({
          options: expect.objectContaining({ resource_type: "raw" }),
        }),
      ])
    );
    expect(uploadedFiles.every((file) => file.bytes > 0)).toBe(true);
  });

  test("records Cloudinary proof mirror failures without failing submission", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "demo";
    process.env.CLOUDINARY_API_KEY = "key";
    process.env.CLOUDINARY_API_SECRET = "secret";
    process.env.CLOUDINARY_PROOF_FOLDER = "decal-sheet";

    vi.spyOn(cloudinary.uploader, "upload_stream").mockImplementation(
      ((options, callback) => {
        const writable = new Writable({
          write(_chunk: Buffer, _encoding, done) {
            done();
          },
        });

        writable.on("finish", () => {
          if (options.public_id === "print.pdf") {
            callback?.(
              Object.assign(new Error("Invalid Cloudinary credentials."), {
                http_code: 401,
              })
            );
            return;
          }

          callback?.(undefined, {
            public_id: `${options.folder}/${options.public_id}`,
            secure_url: `https://res.cloudinary.com/demo/${options.resource_type}/upload/${options.folder}/${options.public_id}`,
          });
        });

        return writable;
      }) as typeof cloudinary.uploader.upload_stream
    );

    const response = await request(createApp())
      .post("/submit-project")
      .field("manifest", JSON.stringify(renderManifest()))
      .attach("assets", validPng, {
        filename: "pixel.png",
        contentType: "image/png",
      });

    if (response.body.projectId) {
      submittedProjectIds.push(response.body.projectId);
    }

    expect(response.status).toBe(201);
    expect(response.body.cloudinary.status).toBe("queued");

    const projectJson = await waitForProjectCloudinaryStatus(
      response.body.projectId,
      "failed"
    );

    expect(projectJson.cloudinary.warnings).toEqual([
      "Cloudinary upload failed for print.pdf: Invalid Cloudinary credentials. HTTP 401 Error",
    ]);
  });

  test("reports when Cloudinary mirroring is skipped because config is missing", async () => {
    const response = await request(createApp())
      .post("/submit-project")
      .field("manifest", JSON.stringify(renderManifest()))
      .attach("assets", validPng, {
        filename: "pixel.png",
        contentType: "image/png",
      });

    submittedProjectIds.push(response.body.projectId);

    const projectJson = JSON.parse(
      await fs.promises.readFile(
        path.join(projectsDir, response.body.projectId, "project.json"),
        "utf8"
      )
    );

    expect(response.status).toBe(201);
    expect(response.body.cloudinary).toEqual({
      files: [],
      folder: `decal-sheet/${response.body.projectId}`,
      status: "skipped",
      warnings: [
        "Cloudinary mirror skipped because the backend is missing CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET.",
      ],
    });
    expect(projectJson.cloudinary).toEqual(response.body.cloudinary);
  });

  test("keeps submitted proofs visible when a Cloudinary preview upload fails", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "demo";
    process.env.CLOUDINARY_API_KEY = "key";
    process.env.CLOUDINARY_API_SECRET = "secret";
    process.env.CLOUDINARY_PROOF_FOLDER = "decal-sheet";

    vi.spyOn(cloudinary.uploader, "upload_stream").mockImplementation(
      ((options, callback) => {
        const writable = new Writable({
          write(_chunk: Buffer, _encoding, done) {
            done();
          },
        });

        writable.on("finish", () => {
          if (options.public_id === "preview") {
            callback?.(
              Object.assign(new Error("Preview upload timed out."), {
                http_code: 499,
              })
            );
            return;
          }

          callback?.(undefined, {
            public_id: `${options.folder}/${options.public_id}`,
            secure_url: `https://res.cloudinary.com/demo/${options.resource_type}/upload/${options.folder}/${options.public_id}`,
          });
        });

        return writable;
      }) as typeof cloudinary.uploader.upload_stream
    );

    const response = await request(createApp())
      .post("/submit-project")
      .field("manifest", JSON.stringify(renderManifest()))
      .attach("assets", validPng, {
        filename: "pixel.png",
        contentType: "image/png",
      });

    submittedProjectIds.push(response.body.projectId);

    expect(response.status).toBe(201);
    expect(response.body.cloudinary.folder).toBe(
      `decal-sheet/${response.body.projectId}`
    );
    expect(response.body.cloudinary.status).toBe("queued");

    const projectJson = await waitForProjectCloudinaryStatus(
      response.body.projectId,
      "failed"
    );

    expect(projectJson.cloudinary.files.map((file: { path: string }) => file.path))
      .toEqual(["print.pdf"]);
    expect(projectJson.cloudinary.warnings).toEqual([
      "Cloudinary upload failed for preview.png: Preview upload timed out. HTTP 499 Error",
    ]);
  });

  test("lists submitted projects for admin review", async () => {
    const app = createApp();
    const submitResponse = await request(app)
      .post("/submit-project")
      .field("manifest", JSON.stringify(renderManifest()))
      .attach("assets", validPng, {
        filename: "pixel.png",
        contentType: "image/png",
      });

    submittedProjectIds.push(submitResponse.body.projectId);

    const response = await request(app).get("/admin/projects");

    expect(response.status).toBe(200);
    expect(response.body.projects).toContainEqual(
      expect.objectContaining({
        projectId: submitResponse.body.projectId,
        counts: {
          assets: 1,
          items: 1,
        },
        files: expect.objectContaining({
          projectJson: `/projects/${submitResponse.body.projectId}/project.json`,
          previewPng: `/projects/${submitResponse.body.projectId}/preview.png`,
          printPdf: `/projects/${submitResponse.body.projectId}/print.pdf`,
          manifestJson: `/projects/${submitResponse.body.projectId}/manifest.json`,
          assetFiles: [
            {
              fileName: "pixel.png",
              path: `/projects/${submitResponse.body.projectId}/assets/pixel.png`,
              sizeBytes: validPng.length,
            },
          ],
        }),
        review: {
          status: "submitted",
          updatedAt: expect.any(String),
          history: [],
        },
      })
    );
  });

  test("skips stale project folders with malformed project JSON", async () => {
    const staleProjectId = "project-20260701120000-stale1";

    submittedProjectIds.push(staleProjectId);
    await fs.promises.mkdir(path.join(projectsDir, staleProjectId), {
      recursive: true,
    });
    await fs.promises.writeFile(
      path.join(projectsDir, staleProjectId, "project.json"),
      JSON.stringify({
        document: {
          sheet: { widthIn: 11 },
        },
      })
    );

    const app = createApp();
    const listResponse = await request(app).get("/admin/projects");
    const detailResponse = await request(app).get(
      `/admin/projects/${staleProjectId}`
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.projects).not.toContainEqual(
      expect.objectContaining({ projectId: staleProjectId })
    );
    expect(detailResponse.status).toBe(404);
    expect(detailResponse.body).toEqual({ error: "Project not found." });
  });

  test("keeps submitted projects reviewable when generated files are missing", async () => {
    const app = createApp();
    const submitResponse = await request(app)
      .post("/submit-project")
      .field("manifest", JSON.stringify(renderManifest()))
      .attach("assets", validPng, {
        filename: "pixel.png",
        contentType: "image/png",
      });
    const projectDir = path.join(projectsDir, submitResponse.body.projectId);

    submittedProjectIds.push(submitResponse.body.projectId);
    await Promise.all([
      fs.promises.rm(path.join(projectDir, "preview.png"), { force: true }),
      fs.promises.rm(path.join(projectDir, "manifest.json"), { force: true }),
      fs.promises.rm(path.join(projectDir, "review.json"), { force: true }),
      fs.promises.rm(path.join(projectDir, "assets", "pixel.png"), {
        force: true,
      }),
    ]);

    const response = await request(app).get(
      `/admin/projects/${submitResponse.body.projectId}`
    );

    expect(response.status).toBe(200);
    expect(response.body.project).toMatchObject({
      projectId: submitResponse.body.projectId,
      counts: {
        assets: 1,
        items: 1,
      },
      files: {
        projectJson: `/projects/${submitResponse.body.projectId}/project.json`,
        assets: `/projects/${submitResponse.body.projectId}/assets/`,
        assetFiles: [],
      },
      review: {
        status: "submitted",
        history: [],
      },
    });
    expect(response.body.project.files.previewPng).toBeUndefined();
    expect(response.body.project.files.manifestJson).toBeUndefined();
  });

  test("returns submitted project details for admin review", async () => {
    const app = createApp();
    const submitResponse = await request(app)
      .post("/submit-project")
      .field("manifest", JSON.stringify(renderManifest()))
      .attach("assets", validPng, {
        filename: "pixel.png",
        contentType: "image/png",
      });

    submittedProjectIds.push(submitResponse.body.projectId);

    const response = await request(app).get(
      `/admin/projects/${submitResponse.body.projectId}`
    );

    expect(response.status).toBe(200);
    expect(response.body.project).toMatchObject({
      projectId: submitResponse.body.projectId,
      storage: {
        provider: "postgres+r2",
        status: "skipped",
      },
      review: {
        status: "submitted",
        history: [],
      },
      manifest: {
        document: {
          id: "project-1",
        },
      },
    });
  });

  test("rejects invalid admin project ids", async () => {
    const response = await request(createApp()).get("/admin/projects/not-safe");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Invalid project id." });
  });

  test("updates review status and appends admin review history", async () => {
    const app = createApp();
    const submitResponse = await request(app)
      .post("/submit-project")
      .field("manifest", JSON.stringify(renderManifest()))
      .attach("assets", validPng, {
        filename: "pixel.png",
        contentType: "image/png",
      });

    submittedProjectIds.push(submitResponse.body.projectId);

    const response = await request(app)
      .patch(`/admin/projects/${submitResponse.body.projectId}/review`)
      .send({
        status: "approved",
        note: "Ready for production.",
        reviewer: "Production lead",
      });

    const reviewJson = JSON.parse(
      await fs.promises.readFile(
        path.join(projectsDir, submitResponse.body.projectId, "review.json"),
        "utf8"
      )
    );

    expect(response.status).toBe(200);
    expect(response.body.project.review).toMatchObject({
      status: "approved",
      updatedAt: expect.any(String),
      history: [
        {
          status: "approved",
          note: "Ready for production.",
          reviewer: "Production lead",
          reviewedAt: expect.any(String),
        },
      ],
    });
    expect(reviewJson).toEqual(response.body.project.review);
  });

  test("rejects invalid admin review statuses", async () => {
    const app = createApp();
    const submitResponse = await request(app)
      .post("/submit-project")
      .field("manifest", JSON.stringify(renderManifest()))
      .attach("assets", validPng, {
        filename: "pixel.png",
        contentType: "image/png",
      });

    submittedProjectIds.push(submitResponse.body.projectId);

    const response = await request(app)
      .patch(`/admin/projects/${submitResponse.body.projectId}/review`)
      .send({ status: "submitted" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Invalid review status." });
  });
});

function restoreCloudinaryEnv() {
  restoreEnvValue("CLOUDINARY_API_KEY", originalCloudinaryEnv.CLOUDINARY_API_KEY);
  restoreEnvValue(
    "CLOUDINARY_API_SECRET",
    originalCloudinaryEnv.CLOUDINARY_API_SECRET
  );
  restoreEnvValue(
    "CLOUDINARY_CLOUD_NAME",
    originalCloudinaryEnv.CLOUDINARY_CLOUD_NAME
  );
  restoreEnvValue(
    "CLOUDINARY_PROOF_FOLDER",
    originalCloudinaryEnv.CLOUDINARY_PROOF_FOLDER
  );
}

function restoreProductionStorageEnv() {
  restoreEnvValue("DATABASE_URL", originalProductionStorageEnv.DATABASE_URL);
  restoreEnvValue("POSTGRES_SSL", originalProductionStorageEnv.POSTGRES_SSL);
  restoreEnvValue(
    "R2_ACCESS_KEY_ID",
    originalProductionStorageEnv.R2_ACCESS_KEY_ID
  );
  restoreEnvValue("R2_ACCOUNT_ID", originalProductionStorageEnv.R2_ACCOUNT_ID);
  restoreEnvValue("R2_BUCKET", originalProductionStorageEnv.R2_BUCKET);
  restoreEnvValue("R2_ENDPOINT", originalProductionStorageEnv.R2_ENDPOINT);
  restoreEnvValue("R2_PREFIX", originalProductionStorageEnv.R2_PREFIX);
  restoreEnvValue(
    "R2_PUBLIC_BASE_URL",
    originalProductionStorageEnv.R2_PUBLIC_BASE_URL
  );
  restoreEnvValue("R2_REGION", originalProductionStorageEnv.R2_REGION);
  restoreEnvValue(
    "R2_SECRET_ACCESS_KEY",
    originalProductionStorageEnv.R2_SECRET_ACCESS_KEY
  );
}

function restoreEnvValue(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
