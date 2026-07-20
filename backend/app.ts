import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import multer from "multer";
import sharp from "sharp";
import cors from "cors";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import { renderSheetToFiles, type RenderSheetDocument } from "./renderSheet";
import {
  createQueuedProductionStorageRecord,
  isProductionDatabaseConfigured,
  isProductionStorageConfigured,
  listDurableProductionSubmissions,
  persistProductionSubmissionToStorage,
  readDurableProductionFile,
  readDurableProductionSubmission,
  updateDurableProductionSubmissionReview,
  type DurableProductionSubmission,
  type ProductionStorageRecord,
} from "./productionStorage";

const MAX_FILE_SIZE = 21 * 1024 * 1024;
const MAX_RENDER_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ALLOWED_RENDER_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
]);
const REVIEW_STATUSES = new Set([
  "submitted",
  "approved",
  "rejected",
  "changes-requested",
]);
const storageRoot = path.resolve(__dirname, "storage");
const uploadsDir = path.join(storageRoot, "uploads");
const processedDir = path.join(storageRoot, "processed");
const projectsDir = path.join(storageRoot, "projects");
const projectRecordWriteQueues = new Map<string, Promise<void>>();

const safeUnlink = (filePath: string, delay = 500) => {
  setTimeout(() => {
    fs.promises.unlink(filePath).catch((err) => {
      if (process.env.NODE_ENV === "development") {
        console.warn(`Could not delete temp upload file:`, err);
      }
    });
  }, delay);
};

[uploadsDir, processedDir, projectsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(new Error("Only PNG, JPEG, and WebP images are allowed."));
      return;
    }
    callback(null, true);
  },
});

const renderUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_RENDER_FILE_SIZE,
    files: 50,
    fieldSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_RENDER_MIME_TYPES.has(file.mimetype)) {
      callback(
        new Error("Only PNG, JPEG, WebP, SVG, and PDF render assets are allowed.")
      );
      return;
    }

    callback(null, true);
  },
});

export function createApp() {
  const app = express();

  const allowedOrigins = process.env.CORS_ORIGIN?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: allowedOrigins?.length ? allowedOrigins : true,
    })
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/", (_req, res) => {
    res.send("Server is running!");
  });

  app.post(
    "/upload",
    upload.single("image"),
    (req: Request, res: Response): void => {
      void (async () => {
        if (!req.file) {
          res.status(400).json({ error: "No file uploaded." });
          return;
        }

        const inputPath = req.file.path;
        const outputFilename = `preview-${Date.now()}.webp`;
        const outputPath = path.join(processedDir, outputFilename);

        try {
          let image = sharp(inputPath);

          const rotation = parseInt(req.body.rotation) || 0;
          const flipX = req.body.flipX === "true";
          const flipY = req.body.flipY === "true";

          if (rotation) image = image.rotate(rotation);
          if (flipX) image = image.flop();
          if (flipY) image = image.flip();

          const cropX = parseInt(req.body.cropX);
          const cropY = parseInt(req.body.cropY);
          const cropWidth = parseInt(req.body.cropWidth);
          const cropHeight = parseInt(req.body.cropHeight);
          const previewWidth = parseInt(req.body.previewWidth);
          const previewHeight = parseInt(req.body.previewHeight);

          if (
            !isNaN(cropX) &&
            !isNaN(cropY) &&
            !isNaN(cropWidth) &&
            !isNaN(cropHeight) &&
            !isNaN(previewWidth) &&
            !isNaN(previewHeight)
          ) {
            const metadata = await image.metadata();
            const scaleX = (metadata.width || 1) / previewWidth;
            const scaleY = (metadata.height || 1) / previewHeight;

            image = image.extract({
              left: Math.round(cropX * scaleX),
              top: Math.round(cropY * scaleY),
              width: Math.round(cropWidth * scaleX),
              height: Math.round(cropHeight * scaleY),
            });
          }

          await image
            .resize(1024, 1024, { fit: "inside" })
            .toFormat("webp")
            .toFile(outputPath);

          res.json({ previewUrl: `/processed/${outputFilename}` });
        } catch (err) {
          console.error("Sharp processing error:", err);
          res.status(500).json({ error: "Sharp failed to process image." });
        } finally {
          safeUnlink(inputPath);
        }
      })();
    }
  );

  app.post(
    "/render-sheet",
    renderUpload.array("assets", 50),
    (req: Request, res: Response): void => {
      void (async () => {
        try {
          const document = parseRenderDocument(getRequestBodyField(req, "manifest"));
          const files = Array.isArray(req.files)
            ? req.files.map((file) => ({
                originalname: file.originalname,
                mimetype: file.mimetype,
                buffer: file.buffer,
              }))
            : [];

          const result = await renderSheetToFiles(document, files);

          res.json({
            widthPx: result.widthPx,
            heightPx: result.heightPx,
            previewPngBase64: result.previewPng.toString("base64"),
            printPdfBase64: result.printPdf.toString("base64"),
          });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Could not render sheet.";

          res.status(400).json({ error: message });
        }
      })();
    }
  );

  app.post(
    "/submit-project",
    renderUpload.array("assets", 50),
    (req: Request, res: Response): void => {
      void (async () => {
        try {
          const manifest = parseRenderManifest(
            getRequestBodyField(req, "manifest")
          );
          const files = getUploadedRenderFiles(req.files);
          const timing = createSubmitTiming();
          logSubmitTiming(timing, "parsed request", {
            assetCount: String(files.length),
          });
          const renderedFiles = await renderSheetToFiles(manifest.document, files);
          logSubmitTiming(timing, "rendered print files");
          const projectId = createProjectId();
          const submittedAt = new Date().toISOString();
          const projectDir = path.join(projectsDir, projectId);
          const assetsDir = path.join(projectDir, "assets");
          const initialReview = createInitialProjectReview(submittedAt);
          const projectRecord = {
            ...getRecord(manifest.raw),
            submittedAt,
            projectId,
          };
          const productionStorage = createQueuedProductionStorageRecord(projectId);
          const emailDelivery = createPrintOrderEmailDelivery();
          const projectJsonRecord = {
            ...projectRecord,
            storage: productionStorage,
          };
          const orderRecord = createPrintOrderRecord({
            emailDelivery,
            files,
            manifest: manifest.raw,
            projectId,
            productionStorage,
            submittedAt,
          });

          await fs.promises.mkdir(assetsDir, { recursive: true });
          await Promise.all([
            fs.promises.writeFile(
              path.join(projectDir, "project.json"),
              JSON.stringify(projectJsonRecord, null, 2)
            ),
            fs.promises.writeFile(
              path.join(projectDir, "review.json"),
              JSON.stringify(initialReview, null, 2)
            ),
            fs.promises.writeFile(
              path.join(projectDir, "manifest.json"),
              JSON.stringify(manifest.raw, null, 2)
            ),
            fs.promises.writeFile(
              path.join(projectDir, "preview.png"),
              renderedFiles.previewPng
            ),
            fs.promises.writeFile(
              path.join(projectDir, "print.pdf"),
              renderedFiles.printPdf
            ),
            fs.promises.writeFile(
              path.join(projectDir, "order.json"),
              JSON.stringify(orderRecord, null, 2)
            ),
            ...files.map((file) =>
              fs.promises.writeFile(
                path.join(assetsDir, path.basename(file.originalname)),
                file.buffer
              )
            ),
          ]);
          logSubmitTiming(timing, "saved local print files", { projectId });

          res.status(201).json({
            projectId,
            status: "submitted",
            email: emailDelivery,
            storage: productionStorage,
            files: {
              projectJson: `/projects/${projectId}/project.json`,
              orderJson: `/projects/${projectId}/order.json`,
              previewPng: `/projects/${projectId}/preview.png`,
              printPdf: `/projects/${projectId}/print.pdf`,
              manifestJson: `/projects/${projectId}/manifest.json`,
              assets: `/projects/${projectId}/assets/`,
            },
          });
          logSubmitTiming(timing, "response sent", {
            projectId,
            storage: productionStorage.status,
          });

          if (emailDelivery.status === "queued") {
            void sendPrintOrderEmailInBackground({
              orderRecord,
              projectDir,
              projectId,
              renderedFiles,
              timing,
            });
          } else {
            logSubmitTiming(timing, "email skipped", { projectId });
          }

          if (isProductionStorageConfigured()) {
            void persistProductionStorageInBackground({
              orderRecord,
              productionStorage,
              projectDir,
              projectId,
              projectRecord,
              renderedFiles,
              timing,
            });
          } else {
            logSubmitTiming(timing, "postgres r2 skipped", { projectId });
          }
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Could not submit project.";

          res.status(400).json({ error: message });
        }
      })();
    }
  );

  app.get("/admin/projects", (_req: Request, res: Response): void => {
    void (async () => {
      try {
        const projects = await listSubmittedProjects();

        res.json({ projects });
      } catch (error) {
        console.error("[admin-projects] could not list projects", error);
        res.status(500).json({
          error: "Could not load submitted projects.",
        });
      }
    })();
  });

  app.get("/admin/projects/:projectId", (req: Request, res: Response): void => {
    void (async () => {
      const projectId = getSafeProjectId(req.params.projectId);

      if (!projectId) {
        res.status(400).json({ error: "Invalid project id." });
        return;
      }

      const project = await readSubmittedProject(projectId);

      if (!project) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      res.json({ project });
    })();
  });

  app.patch(
    "/admin/projects/:projectId/review",
    (req: Request, res: Response): void => {
      void (async () => {
        const projectId = getSafeProjectId(req.params.projectId);

        if (!projectId) {
          res.status(400).json({ error: "Invalid project id." });
          return;
        }

        const status = getReviewStatus(req.body.status);

        if (!status || status === "submitted") {
          res.status(400).json({ error: "Invalid review status." });
          return;
        }

        const note = getReviewNote(req.body.note);

        if (note === null) {
          res.status(400).json({ error: "Review note is too long." });
          return;
        }

        const project = await updateProjectReview(projectId, {
          note,
          reviewer: getReviewer(req.body.reviewer),
          status,
        });

        if (!project) {
          res.status(404).json({ error: "Project not found." });
          return;
        }

        res.json({ project });
      })();
    }
  );

  app.get(
    "/production-files/:projectId/:fileName",
    (req: Request, res: Response): void => {
      void (async () => {
        const projectId = getSafeProjectId(req.params.projectId);
        const fileName = getDurableFileName(req.params.fileName);

        if (!projectId || !fileName) {
          res.status(400).json({ error: "Invalid production file path." });
          return;
        }

        try {
          const file = await readDurableProductionFile(projectId, fileName);

          if (!file) {
            res.status(404).json({ error: "Production file not found." });
            return;
          }

          res.setHeader("Content-Type", file.contentType);
          res.setHeader(
            "Content-Disposition",
            `${fileName === "print.pdf" ? "inline" : "attachment"}; filename="${fileName}"`
          );
          res.send(file.body);
        } catch (error) {
          console.error("[production-file] could not read R2 file", error);
          res.status(502).json({
            error: "Could not open the stored production file.",
          });
        }
      })();
    }
  );

  app.use(
    "/processed",
    express.static(processedDir, {
      setHeaders: (res) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
      },
    })
  );

  app.use(
    "/projects",
    express.static(projectsDir, {
      setHeaders: (res) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
      },
    })
  );

  app.use(
    (
      err: Error,
      req: Request,
      res: Response,
      next: (err: Error) => void
    ) => {
      if (err instanceof multer.MulterError) {
        const message =
          err.code === "LIMIT_FILE_SIZE"
            ? req.path === "/upload"
              ? "Image must be 21 MB or smaller."
              : "Artwork files must be 25 MB or smaller."
            : err.message;
        res.status(400).json({ error: message });
        return;
      }

      if (err.message === "Only PNG, JPEG, and WebP images are allowed.") {
        res.status(400).json({ error: err.message });
        return;
      }

      if (
        err.message ===
        "Only PNG, JPEG, WebP, SVG, and PDF render assets are allowed."
      ) {
        res.status(400).json({ error: err.message });
        return;
      }

      next(err);
    }
  );

  return app;
}

function parseRenderManifest(manifest: unknown): {
  document: RenderSheetDocument;
  raw: unknown;
} {
  if (typeof manifest !== "string" || manifest.trim().length === 0) {
    throw new Error("Missing render manifest.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(manifest);
  } catch {
    throw new Error("Render manifest must be valid JSON.");
  }

  const candidate = getRecord(parsed);
  const document = getRecord(candidate.document ?? candidate);
  const sheet = getRecord(document.sheet);
  const settings = getRecord(document.settings);

  if (
    typeof sheet.widthIn !== "number" ||
    typeof sheet.heightIn !== "number" ||
    typeof sheet.dpi !== "number" ||
    !Array.isArray(document.assets) ||
    !Array.isArray(document.items) ||
    !settings.background
  ) {
    throw new Error("Render manifest is missing required sheet document data.");
  }

  return {
    document: document as unknown as RenderSheetDocument,
    raw: parsed,
  };
}

function parseRenderDocument(manifest: unknown): RenderSheetDocument {
  return parseRenderManifest(manifest).document;
}

function getUploadedRenderFiles(
  files: Express.Multer.File[] | unknown
): UploadedRenderFile[] {
  return Array.isArray(files)
    ? files.map((file) => ({
        originalname: file.originalname,
        mimetype: file.mimetype,
        buffer: file.buffer,
      }))
    : [];
}

function createPrintOrderEmailDelivery(): PrintOrderEmailDelivery {
  const config = getPrintOrderEmailConfig();

  if (config) {
    return {
      message: `Print order email queued for ${formatEmailRecipients(
        config.to
      )}.`,
      recipient: formatEmailRecipients(config.to),
      status: "queued",
    };
  }

  const missingConfig = getMissingPrintOrderEmailConfig();

  return {
    message:
      missingConfig.length > 0
        ? `Email delivery is not configured yet. Missing ${missingConfig.join(
            ", "
          )}. The printable PDF and order files were saved for admin review.`
        : "Email delivery is not configured yet. The printable PDF and order files were saved for admin review.",
    status: "not-configured",
  };
}

function getPrintOrderEmailConfig(): PrintOrderEmailConfig | null {
  const missingConfig = getMissingPrintOrderEmailConfig();

  if (missingConfig.length > 0) {
    return null;
  }

  return {
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            pass: process.env.SMTP_PASS,
            user: process.env.SMTP_USER,
          }
        : undefined,
    from: process.env.PRINT_ORDER_EMAIL_FROM?.trim() ?? "",
    host: process.env.SMTP_HOST?.trim() ?? "",
    port: getSmtpPort(),
    secure: getSmtpSecure(),
    subjectPrefix:
      process.env.PRINT_ORDER_EMAIL_SUBJECT_PREFIX?.trim() ||
      "New decal sheet order",
    timeoutMs: getSmtpTimeoutMs(),
    to: getEmailRecipients(process.env.PRINT_ORDER_EMAIL_TO),
  };
}

function getMissingPrintOrderEmailConfig(): string[] {
  const missingConfig: string[] = [];

  if (!process.env.SMTP_HOST?.trim()) {
    missingConfig.push("SMTP_HOST");
  }

  if (getEmailRecipients(process.env.PRINT_ORDER_EMAIL_TO).length === 0) {
    missingConfig.push("PRINT_ORDER_EMAIL_TO");
  }

  if (!process.env.PRINT_ORDER_EMAIL_FROM?.trim()) {
    missingConfig.push("PRINT_ORDER_EMAIL_FROM");
  }

  return missingConfig;
}

function getSmtpPort(): number {
  const configuredPort = Number(process.env.SMTP_PORT);

  return Number.isFinite(configuredPort) && configuredPort > 0
    ? configuredPort
    : 587;
}

function getSmtpSecure(): boolean {
  const configuredSecure = process.env.SMTP_SECURE?.trim().toLowerCase();

  if (configuredSecure === "true" || configuredSecure === "1") {
    return true;
  }

  if (configuredSecure === "false" || configuredSecure === "0") {
    return false;
  }

  return getSmtpPort() === 465;
}

function getSmtpTimeoutMs(): number {
  const configuredTimeout = Number(process.env.SMTP_TIMEOUT_MS);

  return Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : 15_000;
}

function getEmailRecipients(value: string | undefined): string[] {
  return (
    value
      ?.split(",")
      .map((recipient) => recipient.trim())
      .filter(Boolean) ?? []
  );
}

function formatEmailRecipients(recipients: string[]): string {
  return recipients.join(", ");
}

function createPrintOrderRecord({
  emailDelivery,
  files,
  manifest,
  projectId,
  productionStorage,
  submittedAt,
}: {
  emailDelivery: PrintOrderEmailDelivery;
  files: UploadedRenderFile[];
  manifest: unknown;
  projectId: string;
  productionStorage: ProductionStorageRecord;
  submittedAt: string;
}): PrintOrderRecord {
  const rawManifest = getRecord(manifest);
  const document = getRecord(rawManifest.document);
  const sheet = getRecord(document.sheet);
  const assets = Array.isArray(document.assets) ? document.assets : [];
  const items = Array.isArray(document.items) ? document.items : [];

  return {
    orderId: projectId,
    projectId,
    status: "submitted",
    submittedAt,
    customer: getPrintOrderCustomer(rawManifest),
    sheet: {
      widthIn: getFiniteNumber(sheet.widthIn),
      heightIn: getFiniteNumber(sheet.heightIn),
      dpi: getFiniteNumber(sheet.dpi),
    },
    counts: {
      assets: assets.length,
      decals: items.length,
    },
    files: {
      projectJson: `/projects/${projectId}/project.json`,
      orderJson: `/projects/${projectId}/order.json`,
      previewPng: `/projects/${projectId}/preview.png`,
      printPdf: `/projects/${projectId}/print.pdf`,
      manifestJson: `/projects/${projectId}/manifest.json`,
      assets: `/projects/${projectId}/assets/`,
      assetFiles: files
        .map((file) => path.basename(file.originalname))
        .sort((first, second) => first.localeCompare(second)),
    },
    email: emailDelivery,
    storage: productionStorage,
  };
}

function getPrintOrderCustomer(manifest: Record<string, unknown>) {
  const customer = getRecord(manifest.customer);

  return {
    company: getStringValue(customer.company),
    email: getStringValue(customer.email),
    name: getStringValue(customer.name),
    note: getStringValue(customer.note),
  };
}

function getStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

interface SubmitTiming {
  lastAt: number;
  startedAt: number;
}

function createSubmitTiming(): SubmitTiming {
  const now = Date.now();

  return {
    lastAt: now,
    startedAt: now,
  };
}

function logSubmitTiming(
  timing: SubmitTiming,
  phase: string,
  details: Record<string, string> = {}
) {
  const now = Date.now();
  const detailText = Object.entries(details)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");

  console.info(
    [
      "[submit-project]",
      phase,
      `stepMs=${now - timing.lastAt}`,
      `totalMs=${now - timing.startedAt}`,
      detailText,
    ]
      .filter(Boolean)
      .join(" ")
  );
  timing.lastAt = now;
}

async function sendPrintOrderEmailInBackground({
  orderRecord,
  projectDir,
  projectId,
  renderedFiles,
  timing,
}: {
  orderRecord: PrintOrderRecord;
  projectDir: string;
  projectId: string;
  renderedFiles: { previewPng: Buffer; printPdf: Buffer };
  timing: SubmitTiming;
}) {
  const config = getPrintOrderEmailConfig();

  if (!config) {
    logSubmitTiming(timing, "email skipped", { projectId });
    return;
  }

  logSubmitTiming(timing, "email started", { projectId });

  try {
    const transporter = nodemailer.createTransport({
      auth: config.auth,
      connectionTimeout: config.timeoutMs,
      greetingTimeout: config.timeoutMs,
      host: config.host,
      port: config.port,
      secure: config.secure,
      socketTimeout: config.timeoutMs,
    });
    const message = createPrintOrderEmailMessage({
      config,
      orderRecord,
      renderedFiles,
    });

    await transporter.sendMail(message);

    const emailDelivery: PrintOrderEmailDelivery = {
      message: `Print order email sent to ${formatEmailRecipients(config.to)}.`,
      recipient: formatEmailRecipients(config.to),
      sentAt: new Date().toISOString(),
      status: "sent",
    };

    await writePrintOrderEmailRecord({
      emailDelivery,
      orderRecord,
      projectDir,
    });
    logSubmitTiming(timing, "email finished", { projectId, status: "sent" });
  } catch (error) {
    const emailDelivery: PrintOrderEmailDelivery = {
      error: error instanceof Error ? error.message : String(error),
      message: `Print order email failed for ${formatEmailRecipients(
        config.to
      )}. The printable PDF and order files were saved for admin review.`,
      recipient: formatEmailRecipients(config.to),
      status: "failed",
    };

    console.warn(`[submit-project] email failed projectId=${projectId}`, error);

    try {
      await writePrintOrderEmailRecord({
        emailDelivery,
        orderRecord,
        projectDir,
      });
    } catch (writeError) {
      console.warn(
        `[submit-project] could not persist email failure projectId=${projectId}`,
        writeError
      );
    }
  }
}

function createPrintOrderEmailMessage({
  config,
  orderRecord,
  renderedFiles,
}: {
  config: PrintOrderEmailConfig;
  orderRecord: PrintOrderRecord;
  renderedFiles: { previewPng: Buffer; printPdf: Buffer };
}): nodemailer.SendMailOptions {
  const text = createPrintOrderEmailText(orderRecord);

  return {
    attachments: [
      {
        content: renderedFiles.printPdf,
        contentType: "application/pdf",
        filename: `${orderRecord.projectId}-print.pdf`,
      },
      {
        content: renderedFiles.previewPng,
        contentType: "image/png",
        filename: `${orderRecord.projectId}-preview.png`,
      },
      {
        content: JSON.stringify(orderRecord, null, 2),
        contentType: "application/json",
        filename: `${orderRecord.projectId}-order.json`,
      },
    ],
    from: config.from,
    subject: `${config.subjectPrefix}: ${orderRecord.projectId}`,
    text,
    to: config.to,
  };
}

function createPrintOrderEmailText(orderRecord: PrintOrderRecord): string {
  const customerDetails = [
    orderRecord.customer.name
      ? `Customer name: ${orderRecord.customer.name}`
      : null,
    orderRecord.customer.company
      ? `Company: ${orderRecord.customer.company}`
      : null,
    orderRecord.customer.email
      ? `Customer email: ${orderRecord.customer.email}`
      : null,
    orderRecord.customer.note
      ? `Customer note: ${orderRecord.customer.note}`
      : null,
  ].filter(Boolean);

  return [
    "A new decal sheet print order was submitted.",
    "",
    `Project ID: ${orderRecord.projectId}`,
    `Submitted: ${orderRecord.submittedAt}`,
    `Sheet: ${formatNullableNumber(orderRecord.sheet.widthIn)}" x ${formatNullableNumber(
      orderRecord.sheet.heightIn
    )}" at ${formatNullableNumber(orderRecord.sheet.dpi)} DPI`,
    `Artwork assets: ${orderRecord.counts.assets}`,
    `Decals: ${orderRecord.counts.decals}`,
    "",
    ...(customerDetails.length > 0
      ? ["Customer details:", ...customerDetails, ""]
      : []),
    "Attached files:",
    "- Print PDF",
    "- Proof preview PNG",
    "- Order JSON",
  ].join("\n");
}

function formatNullableNumber(value: number | null): string {
  return value === null ? "unknown" : String(value);
}

async function writePrintOrderEmailRecord({
  emailDelivery,
  orderRecord,
  projectDir,
}: {
  emailDelivery: PrintOrderEmailDelivery;
  orderRecord: PrintOrderRecord;
  projectDir: string;
}) {
  await withProjectRecordWriteLock(projectDir, async () => {
    const currentOrderRecord = await readCurrentPrintOrderRecord(
      projectDir,
      orderRecord
    );
    const updatedOrderRecord: PrintOrderRecord = {
      ...currentOrderRecord,
      email: emailDelivery,
    };

    await writeJsonAtomically(
      path.join(projectDir, "order.json"),
      updatedOrderRecord
    );
  });
}

async function persistProductionStorageInBackground({
  orderRecord,
  productionStorage,
  projectDir,
  projectId,
  projectRecord,
  renderedFiles,
  timing,
}: {
  orderRecord: PrintOrderRecord;
  productionStorage: ProductionStorageRecord;
  projectDir: string;
  projectId: string;
  projectRecord: Record<string, unknown>;
  renderedFiles: { previewPng: Buffer; printPdf: Buffer };
  timing: SubmitTiming;
}) {
  logSubmitTiming(timing, "postgres r2 storage started", { projectId });

  try {
    const currentProjectRecord = await readCurrentProjectRecord(
      projectDir,
      projectRecord
    );
    const projectJsonRecord = {
      ...currentProjectRecord,
      storage: productionStorage,
    };
    const storageRecord = await persistProductionSubmissionToStorage({
      files: {
        orderJson: Buffer.from(JSON.stringify(orderRecord, null, 2)),
        previewPng: renderedFiles.previewPng,
        printPdf: renderedFiles.printPdf,
        projectJson: Buffer.from(JSON.stringify(projectJsonRecord, null, 2)),
      },
      orderRecord,
      projectId,
      projectRecord: projectJsonRecord,
      submittedAt: orderRecord.submittedAt,
    });

    await writeProductionStorageRecords({
      orderRecord,
      productionStorage: storageRecord,
      projectDir,
      projectRecord,
    });
    logSubmitTiming(timing, "postgres r2 storage finished", {
      projectId,
      status: storageRecord.status,
    });
  } catch (error) {
    const storageRecord = createFailedProductionStorageRecord(error);

    console.warn(
      `[submit-project] postgres r2 storage failed projectId=${projectId}`,
      error
    );

    try {
      await writeProductionStorageRecords({
        orderRecord,
        productionStorage: storageRecord,
        projectDir,
        projectRecord,
      });
    } catch (writeError) {
      console.warn(
        `[submit-project] could not persist postgres r2 storage failure projectId=${projectId}`,
        writeError
      );
    }
  }
}

async function writeProductionStorageRecords({
  orderRecord,
  productionStorage,
  projectDir,
  projectRecord,
}: {
  orderRecord: PrintOrderRecord;
  productionStorage: ProductionStorageRecord;
  projectDir: string;
  projectRecord: Record<string, unknown>;
}) {
  await withProjectRecordWriteLock(projectDir, async () => {
    const currentProjectRecord = await readCurrentProjectRecord(
      projectDir,
      projectRecord
    );
    const currentOrderRecord = await readCurrentPrintOrderRecord(
      projectDir,
      orderRecord
    );
    const updatedOrderRecord: PrintOrderRecord = {
      ...currentOrderRecord,
      storage: productionStorage,
    };

    await Promise.all([
      writeJsonAtomically(path.join(projectDir, "project.json"), {
        ...currentProjectRecord,
        storage: productionStorage,
      }),
      writeJsonAtomically(
        path.join(projectDir, "order.json"),
        updatedOrderRecord
      ),
    ]);
  });
}

async function withProjectRecordWriteLock(
  projectDir: string,
  action: () => Promise<void>
) {
  const previous = projectRecordWriteQueues.get(projectDir) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(action);

  projectRecordWriteQueues.set(projectDir, current);

  try {
    await current;
  } finally {
    if (projectRecordWriteQueues.get(projectDir) === current) {
      projectRecordWriteQueues.delete(projectDir);
    }
  }
}

async function writeJsonAtomically(filePath: string, value: unknown) {
  const temporaryPath = `${filePath}.${process.pid}.${Math.random()
    .toString(36)
    .slice(2)}.tmp`;

  await fs.promises.writeFile(temporaryPath, JSON.stringify(value, null, 2));

  try {
    await fs.promises.rename(temporaryPath, filePath);
  } catch (error) {
    const errorCode =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";

    if (process.platform !== "win32" || !["EEXIST", "EPERM"].includes(errorCode)) {
      await fs.promises.rm(temporaryPath, { force: true });
      throw error;
    }

    const backupPath = `${temporaryPath}.previous`;

    try {
      await fs.promises.rename(filePath, backupPath);
      await fs.promises.rename(temporaryPath, filePath);
      await fs.promises.rm(backupPath, { force: true });
    } catch (replacementError) {
      await fs.promises
        .rename(backupPath, filePath)
        .catch(() => undefined);
      await fs.promises.rm(temporaryPath, { force: true });
      throw replacementError;
    }
  }
}

function createFailedProductionStorageRecord(
  error: unknown
): ProductionStorageRecord {
  return {
    files: [],
    provider: "postgres+r2",
    status: "failed",
    warnings: [
      error instanceof Error
        ? error.message
        : `Postgres/R2 storage warning: ${String(error)}`,
    ],
  };
}

async function readCurrentProjectRecord(
  projectDir: string,
  fallback: Record<string, unknown>
): Promise<Record<string, unknown>> {
  try {
    const contents = await fs.promises.readFile(
      path.join(projectDir, "project.json"),
      "utf8"
    );

    return {
      ...fallback,
      ...getRecord(JSON.parse(contents)),
    };
  } catch {
    return fallback;
  }
}

async function readCurrentPrintOrderRecord(
  projectDir: string,
  fallback: PrintOrderRecord
): Promise<PrintOrderRecord> {
  try {
    const contents = await fs.promises.readFile(
      path.join(projectDir, "order.json"),
      "utf8"
    );
    const parsed = getRecord(JSON.parse(contents));

    return {
      ...fallback,
      ...parsed,
      storage: getProductionStorageRecord(parsed.storage) ?? fallback.storage,
    } as PrintOrderRecord;
  } catch {
    return fallback;
  }
}

function getProductionStorageRecord(
  value: unknown
): ProductionStorageRecord | null {
  const record = getRecord(value);

  if (
    record.provider !== "postgres+r2" ||
    !isProductionStorageStatus(record.status)
  ) {
    return null;
  }

  return {
    files: Array.isArray(record.files)
      ? record.files
          .map(getProductionStorageFile)
          .filter(
            (file): file is ProductionStorageRecord["files"][number] =>
              file !== null
          )
      : [],
    provider: "postgres+r2",
    status: record.status,
    warnings: getStringArray(record.warnings),
  };
}

function isProductionStorageStatus(
  value: unknown
): value is ProductionStorageRecord["status"] {
  return (
    value === "queued" ||
    value === "stored" ||
    value === "skipped" ||
    value === "failed"
  );
}

function getProductionStorageFile(
  value: unknown
): ProductionStorageRecord["files"][number] | null {
  const record = getRecord(value);

  if (
    typeof record.contentType !== "string" ||
    typeof record.key !== "string" ||
    typeof record.path !== "string" ||
    typeof record.sizeBytes !== "number"
  ) {
    return null;
  }

  return {
    contentType: record.contentType,
    key: record.key,
    path: record.path,
    publicUrl:
      typeof record.publicUrl === "string" ? record.publicUrl : undefined,
    sizeBytes: record.sizeBytes,
  };
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function createProjectId(): string {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  const suffix = Math.random().toString(36).slice(2, 8);

  return `project-${timestamp}-${suffix}`;
}

async function listSubmittedProjects() {
  const entries = await fs.promises.readdir(projectsDir, {
    withFileTypes: true,
  });
  const localProjects = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => readLocalSubmittedProject(entry.name))
  );
  const durableProjects = isProductionDatabaseConfigured()
    ? (await listDurableProductionSubmissions()).map(readDurableProject)
    : [];
  const projectsById = new Map(
    durableProjects
      .filter((project): project is NonNullable<typeof project> => !!project)
      .map((project) => [project.projectId, project])
  );

  localProjects
    .filter((project): project is NonNullable<typeof project> => !!project)
    .forEach((project) => projectsById.set(project.projectId, project));

  return Array.from(projectsById.values())
    .sort((first, second) =>
      second.submittedAt.localeCompare(first.submittedAt)
    )
    .map((project) => ({
      projectId: project.projectId,
      submittedAt: project.submittedAt,
      sheet: project.sheet,
      counts: project.counts,
      files: project.files,
      review: project.review,
      storage: project.storage,
      email: project.email,
    }));
}

async function readSubmittedProject(projectId: string) {
  const localProject = await readLocalSubmittedProject(projectId);

  if (localProject || !isProductionDatabaseConfigured()) {
    return localProject;
  }

  const durableProject = await readDurableProductionSubmission(projectId);
  return durableProject ? readDurableProject(durableProject) : null;
}

async function readLocalSubmittedProject(projectId: string) {
  const safeProjectId = getSafeProjectId(projectId);

  if (!safeProjectId) {
    return null;
  }

  const projectDir = path.join(projectsDir, safeProjectId);
  const projectJsonPath = path.join(projectDir, "project.json");

  try {
    const manifest = JSON.parse(
      await fs.promises.readFile(projectJsonPath, "utf8")
    );
    const document = getRecord(manifest.document);
    const sheet = getRecord(document.sheet);

    if (!isStoredProjectManifest(manifest, document, sheet)) {
      return null;
    }

    const assets = Array.isArray(document.assets) ? document.assets : [];
    const items = Array.isArray(document.items) ? document.items : [];
    const submittedAt =
      typeof manifest.submittedAt === "string" ? manifest.submittedAt : "";

    const files = await getSubmittedProjectFiles(safeProjectId, projectDir);
    const review = await readProjectReview(projectDir, submittedAt);
    const storage = getProductionStorageRecord(manifest.storage) ?? undefined;
    const email = await readProjectEmailDelivery(projectDir);

    return {
      projectId: safeProjectId,
      submittedAt,
      sheet: {
        widthIn: sheet.widthIn,
        heightIn: sheet.heightIn,
        dpi: sheet.dpi,
      },
      counts: {
        assets: assets.length,
        items: items.length,
      },
      files,
      review,
      storage,
      email,
      manifest,
    };
  } catch {
    return null;
  }
}

async function readProjectEmailDelivery(
  projectDir: string
): Promise<PrintOrderEmailDelivery | undefined> {
  try {
    const order = JSON.parse(
      await fs.promises.readFile(path.join(projectDir, "order.json"), "utf8")
    );
    const email = getRecord(order.email);
    const status = email.status;

    if (
      status !== "not-configured" &&
      status !== "queued" &&
      status !== "sent" &&
      status !== "failed"
    ) {
      return undefined;
    }

    return {
      status,
      ...(typeof email.message === "string"
        ? { message: email.message }
        : {}),
      ...(typeof email.error === "string" ? { error: email.error } : {}),
      ...(typeof email.recipient === "string"
        ? { recipient: email.recipient }
        : {}),
      ...(typeof email.sentAt === "string" ? { sentAt: email.sentAt } : {}),
    };
  } catch {
    return undefined;
  }
}

async function updateProjectReview(
  projectId: string,
  {
    note,
    reviewer,
    status,
  }: {
    note: string;
    reviewer: string;
    status: ProjectReviewStatus;
  }
) {
  const projectDir = path.join(projectsDir, projectId);
  const localProject = await readLocalSubmittedProject(projectId);
  const currentProject = localProject ?? (await readSubmittedProject(projectId));

  if (!currentProject) {
    return null;
  }

  const reviewedAt = new Date().toISOString();
  const review = {
    status,
    updatedAt: reviewedAt,
    history: [
      ...currentProject.review.history,
      {
        status,
        note,
        reviewer,
        reviewedAt,
      },
    ],
  };

  if (localProject) {
    await fs.promises.writeFile(
      path.join(projectDir, "review.json"),
      JSON.stringify(review, null, 2)
    );
  }

  if (isProductionDatabaseConfigured()) {
    await updateDurableProductionSubmissionReview(projectId, review);
  }

  return localProject
    ? readLocalSubmittedProject(projectId)
    : readSubmittedProject(projectId);
}

function createInitialProjectReview(submittedAt: string): ProjectReview {
  return {
    status: "submitted",
    updatedAt: submittedAt,
    history: [],
  };
}

async function readProjectReview(
  projectDir: string,
  submittedAt: string
): Promise<ProjectReview> {
  const fallbackReview = createInitialProjectReview(submittedAt);

  try {
    const review = JSON.parse(
      await fs.promises.readFile(path.join(projectDir, "review.json"), "utf8")
    );
    const record = getRecord(review);
    const status = getReviewStatus(record.status);
    const updatedAt =
      typeof record.updatedAt === "string" ? record.updatedAt : submittedAt;
    const history = Array.isArray(record.history)
      ? record.history
          .map(readProjectReviewEvent)
          .filter((event): event is ProjectReviewEvent => !!event)
      : [];

    if (!status) {
      return fallbackReview;
    }

    return {
      status,
      updatedAt,
      history,
    };
  } catch {
    return fallbackReview;
  }
}

function readProjectReviewEvent(value: unknown): ProjectReviewEvent | null {
  const record = getRecord(value);
  const status = getReviewStatus(record.status);
  const reviewedAt =
    typeof record.reviewedAt === "string" ? record.reviewedAt : "";

  if (!status || !reviewedAt) {
    return null;
  }

  return {
    status,
    note: typeof record.note === "string" ? record.note : "",
    reviewer: typeof record.reviewer === "string" ? record.reviewer : "admin",
    reviewedAt,
  };
}

async function getSubmittedProjectFiles(projectId: string, projectDir: string) {
  const [
    projectJson,
    orderJson,
    previewPng,
    printPdf,
    manifestJson,
    assets,
    assetFiles,
  ] =
    await Promise.all([
      getProjectFileUrl(projectId, projectDir, "project.json"),
      getProjectFileUrl(projectId, projectDir, "order.json"),
      getProjectFileUrl(projectId, projectDir, "preview.png"),
      getProjectFileUrl(projectId, projectDir, "print.pdf"),
      getProjectFileUrl(projectId, projectDir, "manifest.json"),
      getProjectFileUrl(projectId, projectDir, "assets"),
      getSubmittedAssetFiles(projectId, projectDir),
    ]);

  return {
    projectJson,
    orderJson,
    previewPng,
    printPdf,
    manifestJson,
    assets,
    assetFiles,
  };
}

async function getSubmittedAssetFiles(projectId: string, projectDir: string) {
  const assetsDir = path.join(projectDir, "assets");

  try {
    const entries = await fs.promises.readdir(assetsDir, {
      withFileTypes: true,
    });
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map(async (entry) => {
          const fileName = path.basename(entry.name);
          const stats = await fs.promises.stat(path.join(assetsDir, fileName));

          return {
            fileName,
            path: `/projects/${projectId}/assets/${encodeURIComponent(fileName)}`,
            sizeBytes: stats.size,
          };
        })
    );

    return files.sort((first, second) =>
      first.fileName.localeCompare(second.fileName)
    );
  } catch {
    return [];
  }
}

async function getProjectFileUrl(
  projectId: string,
  projectDir: string,
  filename: string
) {
  const filePath = path.join(projectDir, filename);

  try {
    await fs.promises.access(filePath);
  } catch {
    return undefined;
  }

  return `/projects/${projectId}/${filename}${filename === "assets" ? "/" : ""}`;
}

function getSafeProjectId(projectId: unknown): string | null {
  if (typeof projectId !== "string") {
    return null;
  }

  return /^project-\d+-[a-z0-9]+$/.test(projectId) ? projectId : null;
}

function getDurableFileName(fileName: unknown) {
  return fileName === "print.pdf" ||
    fileName === "preview.png" ||
    fileName === "order.json" ||
    fileName === "project.json"
    ? fileName
    : null;
}

function readDurableProject(submission: DurableProductionSubmission) {
  const manifest = getRecord(submission.projectRecord);
  const document = getRecord(manifest.document);
  const sheet = getRecord(document.sheet);

  if (!isStoredProjectManifest(manifest, document, sheet)) {
    return null;
  }

  const assets = Array.isArray(document.assets) ? document.assets : [];
  const items = Array.isArray(document.items) ? document.items : [];
  const storage =
    getProductionStorageRecord(submission.storageRecord) ?? undefined;
  const storedFiles = new Map(
    storage?.files.map((file) => [
      file.path,
      file.publicUrl ??
        `/production-files/${submission.projectId}/${encodeURIComponent(
          file.path
        )}`,
    ])
  );
  const order = getRecord(submission.orderRecord);
  const emailRecord = getRecord(order.email);
  const emailStatus = emailRecord.status;
  const review = readDurableProjectReview(
    submission.review,
    submission.submittedAt
  );

  return {
    projectId: submission.projectId,
    submittedAt: submission.submittedAt,
    sheet: {
      widthIn: sheet.widthIn,
      heightIn: sheet.heightIn,
      dpi: sheet.dpi,
    },
    counts: {
      assets: assets.length,
      items: items.length,
    },
    files: {
      projectJson: storedFiles.get("project.json"),
      orderJson: storedFiles.get("order.json"),
      previewPng: storedFiles.get("preview.png"),
      printPdf: storedFiles.get("print.pdf"),
      assetFiles: [] as Array<{
        fileName: string;
        path: string;
        sizeBytes?: number;
      }>,
    },
    review,
    storage,
    email:
      emailStatus === "not-configured" ||
      emailStatus === "queued" ||
      emailStatus === "sent" ||
      emailStatus === "failed"
        ? {
            status: emailStatus,
            ...(typeof emailRecord.message === "string"
              ? { message: emailRecord.message }
              : {}),
            ...(typeof emailRecord.error === "string"
              ? { error: emailRecord.error }
              : {}),
            ...(typeof emailRecord.recipient === "string"
              ? { recipient: emailRecord.recipient }
              : {}),
            ...(typeof emailRecord.sentAt === "string"
              ? { sentAt: emailRecord.sentAt }
              : {}),
          }
        : undefined,
    manifest,
  };
}

function readDurableProjectReview(
  value: unknown,
  submittedAt: string
): ProjectReview {
  const record = getRecord(value);
  const status = getReviewStatus(record.status);
  const history = Array.isArray(record.history)
    ? record.history
        .map(readProjectReviewEvent)
        .filter((event): event is ProjectReviewEvent => !!event)
    : [];

  return status
    ? {
        status,
        updatedAt:
          typeof record.updatedAt === "string"
            ? record.updatedAt
            : submittedAt,
        history,
      }
    : createInitialProjectReview(submittedAt);
}

function isStoredProjectManifest(
  manifest: Record<string, unknown>,
  document: Record<string, unknown>,
  sheet: Record<string, unknown>
): boolean {
  return (
    typeof manifest.submittedAt === "string" &&
    manifest.submittedAt.length > 0 &&
    typeof document.id === "string" &&
    Array.isArray(document.assets) &&
    Array.isArray(document.items) &&
    typeof sheet.widthIn === "number" &&
    Number.isFinite(sheet.widthIn) &&
    typeof sheet.heightIn === "number" &&
    Number.isFinite(sheet.heightIn) &&
    typeof sheet.dpi === "number" &&
    Number.isFinite(sheet.dpi)
  );
}

type ProjectReviewStatus =
  | "submitted"
  | "approved"
  | "rejected"
  | "changes-requested";

interface ProjectReview {
  status: ProjectReviewStatus;
  updatedAt: string;
  history: ProjectReviewEvent[];
}

interface ProjectReviewEvent {
  status: ProjectReviewStatus;
  note: string;
  reviewer: string;
  reviewedAt: string;
}

interface UploadedRenderFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

interface PrintOrderRecord {
  orderId: string;
  projectId: string;
  status: "submitted";
  submittedAt: string;
  customer: {
    company: string;
    email: string;
    name: string;
    note: string;
  };
  sheet: {
    widthIn: number | null;
    heightIn: number | null;
    dpi: number | null;
  };
  counts: {
    assets: number;
    decals: number;
  };
  files: {
    projectJson: string;
    orderJson: string;
    previewPng: string;
    printPdf: string;
    manifestJson: string;
    assets: string;
    assetFiles: string[];
  };
  email: PrintOrderEmailDelivery;
  storage: ProductionStorageRecord;
}

interface PrintOrderEmailDelivery {
  status: "not-configured" | "queued" | "sent" | "failed";
  error?: string;
  message?: string;
  recipient?: string;
  sentAt?: string;
}

interface PrintOrderEmailConfig {
  auth?: {
    pass: string;
    user: string;
  };
  from: string;
  host: string;
  port: number;
  secure: boolean;
  subjectPrefix: string;
  timeoutMs: number;
  to: string[];
}

function getReviewStatus(status: unknown): ProjectReviewStatus | null {
  if (typeof status !== "string" || !REVIEW_STATUSES.has(status)) {
    return null;
  }

  return status as ProjectReviewStatus;
}

function getReviewNote(note: unknown): string | null {
  if (typeof note !== "string") {
    return "";
  }

  const normalizedNote = note.trim();

  return normalizedNote.length > 1000 ? null : normalizedNote;
}

function getReviewer(reviewer: unknown): string {
  if (typeof reviewer !== "string" || reviewer.trim().length === 0) {
    return "admin";
  }

  return reviewer.trim().slice(0, 80);
}

function getRequestBodyField(req: Request, fieldName: string): unknown {
  return getRecord(req.body)[fieldName];
}

function getRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as Record<string, unknown>;
}
