import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import multer from "multer";
import sharp from "sharp";
import cors from "cors";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import { renderSheetToFiles, type RenderSheetDocument } from "./renderSheet";

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

const hasCloudinaryConfig =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;

if (hasCloudinaryConfig) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

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

function getProcessedFilePath(filename: unknown): string | null {
  if (typeof filename !== "string") return null;

  const safeFilename = path.basename(filename);
  if (safeFilename !== filename || !/^preview-\d+\.webp$/.test(filename)) {
    return null;
  }

  const filePath = path.resolve(processedDir, safeFilename);
  if (!filePath.startsWith(`${processedDir}${path.sep}`)) {
    return null;
  }

  return filePath;
}

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

  app.post("/save-to-cloud", (req: Request, res: Response) => {
    (async () => {
      const filePath = getProcessedFilePath(req.body.filename);

      if (!filePath) {
        return res.status(400).json({ error: "Invalid filename." });
      }

      if (!hasCloudinaryConfig) {
        return res.status(500).json({ error: "Cloudinary is not configured." });
      }

      try {
        const buffer = await fs.promises.readFile(filePath);

        const uploadStream = cloudinary.uploader.upload_stream(
          { resource_type: "image", format: "webp" },
          (error, result) => {
            if (error || !result) {
              console.error("Cloudinary upload failed:", error);
              return res
                .status(500)
                .json({ error: "Upload to Cloudinary failed." });
            }

            res.json({ url: result.secure_url });
          }
        );

        streamifier.createReadStream(buffer).pipe(uploadStream);
      } catch (err) {
        console.error("Failed to read local image:", err);
        res.status(500).json({ error: "Could not read local file." });
      }
    })();
  });

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
          const renderedFiles = await renderSheetToFiles(manifest.document, files);
          const projectId = createProjectId();
          const submittedAt = new Date().toISOString();
          const projectDir = path.join(projectsDir, projectId);
          const assetsDir = path.join(projectDir, "assets");

          await fs.promises.mkdir(assetsDir, { recursive: true });
          await Promise.all([
            fs.promises.writeFile(
              path.join(projectDir, "project.json"),
              JSON.stringify(
                {
                  ...getRecord(manifest.raw),
                  submittedAt,
                  projectId,
                },
                null,
                2
              )
            ),
            fs.promises.writeFile(
              path.join(projectDir, "review.json"),
              JSON.stringify(createInitialProjectReview(submittedAt), null, 2)
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
            ...files.map((file) =>
              fs.promises.writeFile(
                path.join(assetsDir, path.basename(file.originalname)),
                file.buffer
              )
            ),
          ]);

          res.status(201).json({
            projectId,
            status: "submitted",
            files: {
              projectJson: `/projects/${projectId}/project.json`,
              previewPng: `/projects/${projectId}/preview.png`,
              printPdf: `/projects/${projectId}/print.pdf`,
              manifestJson: `/projects/${projectId}/manifest.json`,
              assets: `/projects/${projectId}/assets/`,
            },
          });
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
      const projects = await listSubmittedProjects();

      res.json({ projects });
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
      _req: Request,
      res: Response,
      next: (err: Error) => void
    ) => {
      if (err instanceof multer.MulterError) {
        const message =
          err.code === "LIMIT_FILE_SIZE"
            ? "Image must be 21MB or smaller."
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

function getUploadedRenderFiles(files: Express.Multer.File[] | unknown) {
  return Array.isArray(files)
    ? files.map((file) => ({
        originalname: file.originalname,
        mimetype: file.mimetype,
        buffer: file.buffer,
      }))
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
  const projects = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => readSubmittedProject(entry.name))
  );

  return projects
    .filter((project): project is NonNullable<typeof project> => !!project)
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
    }));
}

async function readSubmittedProject(projectId: string) {
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
    const assets = Array.isArray(document.assets) ? document.assets : [];
    const items = Array.isArray(document.items) ? document.items : [];
    const submittedAt =
      typeof manifest.submittedAt === "string" ? manifest.submittedAt : "";

    const files = await getSubmittedProjectFiles(safeProjectId, projectDir);
    const review = await readProjectReview(projectDir, submittedAt);

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
      manifest,
    };
  } catch {
    return null;
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
  const currentProject = await readSubmittedProject(projectId);

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

  await fs.promises.writeFile(
    path.join(projectDir, "review.json"),
    JSON.stringify(review, null, 2)
  );

  return readSubmittedProject(projectId);
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
  const [projectJson, previewPng, printPdf, manifestJson, assets, assetFiles] =
    await Promise.all([
      getProjectFileUrl(projectId, projectDir, "project.json"),
      getProjectFileUrl(projectId, projectDir, "preview.png"),
      getProjectFileUrl(projectId, projectDir, "print.pdf"),
      getProjectFileUrl(projectId, projectDir, "manifest.json"),
      getProjectFileUrl(projectId, projectDir, "assets"),
      getSubmittedAssetFiles(projectId, projectDir),
    ]);

  return {
    projectJson,
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
