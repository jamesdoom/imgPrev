// backend/server.ts
import express, { Request, Response } from "express";
import multer from "multer";
import sharp from "sharp";
import cors from "cors";
import path from "path";
import fs from "fs";

// Delay-unlink helper to avoid Windows file lock issues
const safeUnlink = (filePath: string, delay = 500) => {
  setTimeout(() => {
    fs.promises.unlink(filePath).catch((err) => {
      if (process.env.NODE_ENV === "development") {
        console.warn(`Could not delete temp upload file:`, err);
      }
    });
  }, delay);
};

// Ensure storage folders exist
const storageDirs = ["storage/uploads", "storage/processed"];
storageDirs.forEach((dir) => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

const app = express();
const upload = multer({ dest: path.join(__dirname, "storage/uploads/") });

app.use(cors());
app.use(express.json());

// Simple health check
app.get("/", (_req, res) => {
  res.send("Server is running!");
});

// Upload and resize image with optional transforms
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
      const outputPath = path.join(
        __dirname,
        "storage/processed",
        outputFilename
      );

      try {
        let image = sharp(inputPath);

        // Optional transforms
        const rotation = parseInt(req.body.rotation) || 0;
        const flipX = req.body.flipX === "true";
        const flipY = req.body.flipY === "true";

        if (rotation) image = image.rotate(rotation);
        if (flipX) image = image.flop(); // horizontal
        if (flipY) image = image.flip(); // vertical

        // Optional cropping
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
      } catch (err) {
        console.error("Sharp processing error:", err);
        res.status(500).json({ error: "Sharp failed to process image." });
        return;
      }

      // Safely clean up temp upload file
      safeUnlink(inputPath);

      // Respond with processed image path
      res.json({ previewUrl: `/processed/${outputFilename}` });
    })();
  }
);

// Serve processed images statically
app.use(
  "/processed",
  express.static(path.join(__dirname, "storage/processed"))
);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
