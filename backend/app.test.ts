import request from "supertest";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createApp } from "./app";
import { inspectProductionPdf, validateProductionPdf } from "./renderSheet";
import {
  listDurableProductionSubmissions,
  persistProductionSubmissionToStorage,
  readDurableProductionFile,
  readDurableProductionSubmission,
  updateDurableProductionSubmissionReview,
} from "./productionStorage";

vi.mock("./productionStorage", async () => {
  const actual =
    await vi.importActual<typeof import("./productionStorage")>(
      "./productionStorage"
    );

  return {
    ...actual,
    listDurableProductionSubmissions: vi.fn(
      actual.listDurableProductionSubmissions
    ),
    persistProductionSubmissionToStorage: vi.fn(
      actual.persistProductionSubmissionToStorage
    ),
    readDurableProductionFile: vi.fn(actual.readDurableProductionFile),
    readDurableProductionSubmission: vi.fn(
      actual.readDurableProductionSubmission
    ),
    updateDurableProductionSubmissionReview: vi.fn(
      actual.updateDurableProductionSubmissionReview
    ),
  };
});

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(),
  },
}));

const validPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);
const submittedProjectIds: string[] = [];
const projectsDir = path.resolve(__dirname, "storage", "projects");
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
const originalEmailEnv = {
  PRINT_ORDER_EMAIL_FROM: process.env.PRINT_ORDER_EMAIL_FROM,
  PRINT_ORDER_EMAIL_SUBJECT_PREFIX: process.env.PRINT_ORDER_EMAIL_SUBJECT_PREFIX,
  PRINT_ORDER_EMAIL_TO: process.env.PRINT_ORDER_EMAIL_TO,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_SECURE: process.env.SMTP_SECURE,
  SMTP_TIMEOUT_MS: process.env.SMTP_TIMEOUT_MS,
  SMTP_USER: process.env.SMTP_USER,
};

beforeEach(() => {
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
  delete process.env.PRINT_ORDER_EMAIL_FROM;
  delete process.env.PRINT_ORDER_EMAIL_SUBJECT_PREFIX;
  delete process.env.PRINT_ORDER_EMAIL_TO;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PASS;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_SECURE;
  delete process.env.SMTP_TIMEOUT_MS;
  delete process.env.SMTP_USER;
  vi.mocked(nodemailer.createTransport).mockReset();
  vi.mocked(listDurableProductionSubmissions).mockReset();
  vi.mocked(persistProductionSubmissionToStorage).mockReset();
  vi.mocked(readDurableProductionFile).mockReset();
  vi.mocked(readDurableProductionSubmission).mockReset();
  vi.mocked(updateDurableProductionSubmissionReview).mockReset();
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
  restoreProductionStorageEnv();
  restoreEmailEnv();
  vi.restoreAllMocks();
});

async function waitForOrderEmailStatus(
  projectId: string,
  status: "queued" | "sent" | "failed"
) {
  const deadline = Date.now() + 2_000;

  while (Date.now() < deadline) {
    const orderJson = JSON.parse(
      await fs.promises.readFile(
        path.join(projectsDir, projectId, "order.json"),
        "utf8"
      )
    );

    if (orderJson.email?.status === status) {
      return orderJson;
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(`Timed out waiting for email status ${status}.`);
}

async function waitForProjectStorageStatus(
  projectId: string,
  status: "stored" | "failed"
) {
  const deadline = Date.now() + 2_000;

  while (Date.now() < deadline) {
    const projectJson = JSON.parse(
      await fs.promises.readFile(
        path.join(projectsDir, projectId, "project.json"),
        "utf8"
      )
    );

    if (projectJson.storage?.status === status) {
      return projectJson;
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(`Timed out waiting for storage status ${status}.`);
}

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
      sheets: [{ id: "sheet-1", label: "Sheet 1" }],
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
          sheetId: "sheet-1",
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
    expect(response.body).toEqual({ error: "Image must be 21 MB or smaller." });
  });

  test("reports the correct 25 MB limit for oversized print artwork", async () => {
    const response = await request(createApp())
      .post("/submit-project")
      .field("manifest", JSON.stringify(renderManifest()))
      .attach("assets", Buffer.alloc(25 * 1024 * 1024 + 1), {
        filename: "large.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Artwork files must be 25 MB or smaller.",
    });
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

  test("renders multiple sheets as previews and one multi-page PDF", async () => {
    const manifest = renderManifest();
    manifest.document.sheet.dpi = 30;
    manifest.document.sheets = [
      { id: "sheet-1", label: "Sheet 1" },
      { id: "sheet-2", label: "Sheet 2" },
    ];
    manifest.document.items = [
      { ...manifest.document.items[0], sheetId: "sheet-1" },
      {
        ...manifest.document.items[0],
        id: "item-2",
        sheetId: "sheet-2",
      },
    ];
    const response = await request(createApp())
      .post("/render-sheet")
      .field("manifest", JSON.stringify(manifest))
      .attach("assets", validPng, {
        filename: "pixel.png",
        contentType: "image/png",
      });
    const printPdf = Buffer.from(response.body.printPdfBase64, "base64");

    expect(response.status).toBe(200);
    expect(response.body.previewPngsBase64).toHaveLength(2);
    expect(inspectProductionPdf(printPdf)).toMatchObject({
      imageCount: 4,
      pageCount: 2,
      pageHeightPt: 1224,
      pageWidthPt: 792,
    });
    expect(() =>
      validateProductionPdf(printPdf, {
        dpi: 30,
        heightPx: 510,
        pageCount: 2,
        widthPx: 330,
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

  test("submits multi-sheet previews and exposes them to admin review", async () => {
    const manifest = renderManifest();
    manifest.document.sheet.dpi = 30;
    manifest.document.sheets = [
      { id: "sheet-1", label: "Sheet 1" },
      { id: "sheet-2", label: "Sheet 2" },
    ];
    manifest.document.items = [
      { ...manifest.document.items[0], sheetId: "sheet-1" },
      {
        ...manifest.document.items[0],
        id: "item-2",
        sheetId: "sheet-2",
      },
    ];
    const app = createApp();
    const response = await request(app)
      .post("/submit-project")
      .field("manifest", JSON.stringify(manifest))
      .attach("assets", validPng, {
        filename: "pixel.png",
        contentType: "image/png",
      });

    submittedProjectIds.push(response.body.projectId);
    const detailResponse = await request(app).get(
      `/admin/projects/${response.body.projectId}`
    );
    const printPdf = await fs.promises.readFile(
      path.join(projectsDir, response.body.projectId, "print.pdf")
    );

    expect(response.status).toBe(201);
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.project).toMatchObject({
      counts: {
        assets: 1,
        items: 2,
        sheets: 2,
      },
      files: {
        sheetPreviews: [
          `/projects/${response.body.projectId}/preview-sheet-1.png`,
          `/projects/${response.body.projectId}/preview-sheet-2.png`,
        ],
      },
    });
    expect(inspectProductionPdf(printPdf).pageCount).toBe(2);
  });

  test("emails print order details when SMTP is configured", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "message-1" });

    process.env.PRINT_ORDER_EMAIL_FROM = "orders@example.com";
    process.env.PRINT_ORDER_EMAIL_SUBJECT_PREFIX = "Print-ready decal sheet";
    process.env.PRINT_ORDER_EMAIL_TO = "print@example.com, owner@example.com";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PASS = "smtp-pass";
    process.env.SMTP_PORT = "2525";
    process.env.SMTP_SECURE = "false";
    process.env.SMTP_TIMEOUT_MS = "5000";
    process.env.SMTP_USER = "smtp-user";
    vi.mocked(nodemailer.createTransport).mockReturnValue({
      sendMail,
    } as never);

    const response = await request(createApp())
      .post("/submit-project")
      .field("manifest", JSON.stringify(renderManifest()))
      .attach("assets", validPng, {
        filename: "pixel.png",
        contentType: "image/png",
      });

    submittedProjectIds.push(response.body.projectId);

    expect(response.status).toBe(201);
    expect(response.body.email).toMatchObject({
      recipient: "print@example.com, owner@example.com",
      status: "queued",
    });

    const orderJson = await waitForOrderEmailStatus(
      response.body.projectId,
      "sent"
    );

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      auth: {
        pass: "smtp-pass",
        user: "smtp-user",
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      host: "smtp.example.com",
      port: 2525,
      secure: false,
      socketTimeout: 5000,
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({
            contentType: "application/pdf",
            filename: `${response.body.projectId}-print.pdf`,
          }),
          expect.objectContaining({
            contentType: "image/png",
            filename: `${response.body.projectId}-preview.png`,
          }),
          expect.objectContaining({
            contentType: "application/json",
            filename: `${response.body.projectId}-order.json`,
          }),
        ]),
        from: "orders@example.com",
        subject: `Print-ready decal sheet: ${response.body.projectId}`,
        to: ["print@example.com", "owner@example.com"],
      })
    );
    expect(orderJson.email).toMatchObject({
      recipient: "print@example.com, owner@example.com",
      sentAt: expect.any(String),
      status: "sent",
    });
  });

  test("records failed print order email delivery", async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error("SMTP rejected"));

    process.env.PRINT_ORDER_EMAIL_FROM = "orders@example.com";
    process.env.PRINT_ORDER_EMAIL_TO = "print@example.com";
    process.env.SMTP_HOST = "smtp.example.com";
    vi.mocked(nodemailer.createTransport).mockReturnValue({
      sendMail,
    } as never);

    const response = await request(createApp())
      .post("/submit-project")
      .field("manifest", JSON.stringify(renderManifest()))
      .attach("assets", validPng, {
        filename: "pixel.png",
        contentType: "image/png",
      });

    submittedProjectIds.push(response.body.projectId);

    expect(response.status).toBe(201);
    expect(response.body.email).toMatchObject({
      recipient: "print@example.com",
      status: "queued",
    });

    const orderJson = await waitForOrderEmailStatus(
      response.body.projectId,
      "failed"
    );

    expect(orderJson.email).toMatchObject({
      error: "SMTP rejected",
      recipient: "print@example.com",
      status: "failed",
    });
  });

  test("records failed R2 or Neon persistence without losing the local order", async () => {
    process.env.DATABASE_URL = "postgres://example.test/print";
    process.env.R2_ACCESS_KEY_ID = "access-key";
    process.env.R2_ACCOUNT_ID = "account-id";
    process.env.R2_BUCKET = "print-bucket";
    process.env.R2_SECRET_ACCESS_KEY = "secret-key";
    vi.mocked(persistProductionSubmissionToStorage).mockRejectedValue(
      new Error("R2 upload unavailable")
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
    expect(response.body.storage.status).toBe("queued");

    const projectJson = await waitForProjectStorageStatus(
      response.body.projectId,
      "failed"
    );
    const orderJson = JSON.parse(
      await fs.promises.readFile(
        path.join(projectsDir, response.body.projectId, "order.json"),
        "utf8"
      )
    );

    expect(projectJson.storage).toMatchObject({
      files: [],
      provider: "postgres+r2",
      status: "failed",
      warnings: ["R2 upload unavailable"],
    });
    expect(orderJson.storage).toEqual(projectJson.storage);
    await expect(
      fs.promises.readFile(
        path.join(projectsDir, response.body.projectId, "print.pdf")
      )
    ).resolves.toBeInstanceOf(Buffer);
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
          sheets: 1,
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
        email: expect.objectContaining({
          status: "not-configured",
        }),
      })
    );
  });

  test("keeps Neon-backed projects reviewable after local Render files disappear", async () => {
    process.env.DATABASE_URL = "postgres://example.test/print";
    const projectId = "project-20260720120000-durable";
    const submittedAt = "2026-07-20T12:00:00.000Z";
    const manifest = {
      ...renderManifest(),
      projectId,
      submittedAt,
    };
    const durableSubmission = {
      projectId,
      submittedAt,
      status: "submitted",
      projectRecord: manifest,
      orderRecord: {
        email: {
          recipient: "print@example.com",
          status: "sent",
        },
      },
      review: null,
      storageRecord: {
        provider: "postgres+r2" as const,
        status: "stored" as const,
        files: [
          {
            contentType: "application/pdf",
            key: `decal-sheet/${projectId}/print.pdf`,
            path: "print.pdf",
            sizeBytes: 1234,
          },
          {
            contentType: "image/png",
            key: `decal-sheet/${projectId}/preview.png`,
            path: "preview.png",
            sizeBytes: 456,
          },
        ],
      },
    };

    vi.mocked(listDurableProductionSubmissions).mockResolvedValue([
      durableSubmission,
    ]);
    vi.mocked(readDurableProductionSubmission).mockResolvedValue(
      durableSubmission
    );
    vi.mocked(updateDurableProductionSubmissionReview).mockResolvedValue(true);
    vi.mocked(readDurableProductionFile).mockResolvedValue({
      body: Buffer.from("%PDF durable"),
      contentType: "application/pdf",
    });

    const app = createApp();
    const listResponse = await request(app).get("/admin/projects");
    const detailResponse = await request(app).get(
      `/admin/projects/${projectId}`
    );
    const reviewResponse = await request(app)
      .patch(`/admin/projects/${projectId}/review`)
      .send({
        note: "Ready for print.",
        reviewer: "Production",
        status: "approved",
      });
    const printPdfResponse = await request(app).get(
      `/production-files/${projectId}/print.pdf`
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.projects).toContainEqual(
      expect.objectContaining({
        projectId,
        files: expect.objectContaining({
          printPdf: `/production-files/${projectId}/print.pdf`,
          previewPng: `/production-files/${projectId}/preview.png`,
        }),
        storage: expect.objectContaining({ status: "stored" }),
      })
    );
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.project.manifest).toMatchObject({
      document: expect.objectContaining({
        assets: expect.any(Array),
        items: expect.any(Array),
      }),
    });
    expect(reviewResponse.status).toBe(200);
    expect(printPdfResponse.status).toBe(200);
    expect(printPdfResponse.headers["content-type"]).toContain(
      "application/pdf"
    );
    expect(printPdfResponse.headers["content-disposition"]).toContain("inline");
    expect(readDurableProductionFile).toHaveBeenCalledWith(
      projectId,
      "print.pdf"
    );
    expect(updateDurableProductionSubmissionReview).toHaveBeenCalledWith(
      projectId,
      expect.objectContaining({
        status: "approved",
        history: [
          expect.objectContaining({
            note: "Ready for print.",
            reviewer: "Production",
            status: "approved",
          }),
        ],
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

  test("returns a controlled error when the admin project list cannot be read", async () => {
    vi.spyOn(fs.promises, "readdir").mockRejectedValueOnce(
      new Error("Storage volume unavailable")
    );

    const response = await request(createApp()).get("/admin/projects");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: "Could not load submitted projects.",
    });
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
      email: {
        status: "not-configured",
      },
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

function restoreEmailEnv() {
  restoreEnvValue(
    "PRINT_ORDER_EMAIL_FROM",
    originalEmailEnv.PRINT_ORDER_EMAIL_FROM
  );
  restoreEnvValue(
    "PRINT_ORDER_EMAIL_SUBJECT_PREFIX",
    originalEmailEnv.PRINT_ORDER_EMAIL_SUBJECT_PREFIX
  );
  restoreEnvValue("PRINT_ORDER_EMAIL_TO", originalEmailEnv.PRINT_ORDER_EMAIL_TO);
  restoreEnvValue("SMTP_HOST", originalEmailEnv.SMTP_HOST);
  restoreEnvValue("SMTP_PASS", originalEmailEnv.SMTP_PASS);
  restoreEnvValue("SMTP_PORT", originalEmailEnv.SMTP_PORT);
  restoreEnvValue("SMTP_SECURE", originalEmailEnv.SMTP_SECURE);
  restoreEnvValue("SMTP_TIMEOUT_MS", originalEmailEnv.SMTP_TIMEOUT_MS);
  restoreEnvValue("SMTP_USER", originalEmailEnv.SMTP_USER);
}

function restoreEnvValue(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
