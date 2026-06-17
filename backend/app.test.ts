import request from "supertest";
import { describe, expect, test } from "vitest";
import { createApp } from "./app";

const validPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);

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
});
