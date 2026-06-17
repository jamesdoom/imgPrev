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

const MAX_FILE_SIZE = 21 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const storageRoot = path.resolve(__dirname, "storage");
const uploadsDir = path.join(storageRoot, "uploads");
const processedDir = path.join(storageRoot, "processed");

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

[uploadsDir, processedDir].forEach((dir) => {
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

  app.use(
    "/processed",
    express.static(processedDir, {
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

      next(err);
    }
  );

  return app;
}
