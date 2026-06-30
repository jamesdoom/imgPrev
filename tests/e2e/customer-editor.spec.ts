import { expect, test } from "@playwright/test";

const autosaveKey = "sticker-sheet-designer:autosave";
const artworkFile = {
  buffer: Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
      <rect width="600" height="600" fill="#0f766e"/>
      <circle cx="300" cy="300" r="180" fill="#f8fafc"/>
      <text x="300" y="322" text-anchor="middle" font-family="Arial" font-size="72" fill="#0f172a">QA</text>
    </svg>`,
  ),
  mimeType: "image/svg+xml",
  name: "playwright-artwork.svg",
};
const pngWithoutDpiFile = {
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64",
  ),
  mimeType: "image/png",
  name: "playwright-no-dpi.png",
};
const emptySvgDataUrl =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#0f766e"/></svg>`,
  );

test("customer can upload artwork and reload the saved project preview", async ({
  page,
}) => {
  await page.goto("/");

  await page.locator('input[type="file"]').first().setInputFiles(pngWithoutDpiFile);

  await expect(
    page.getByRole("button", { name: /playwright-no-dpi\.png Ready/ }),
  ).toBeVisible();
  await expect(page.getByText("1 x 1px")).toBeVisible();
  await expect(page.getByText("DPI metadata unavailable; using 300 DPI")).toBeVisible();
  await expect(page.getByLabel("Rotation")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Order Summary" })).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole("button", { name: /playwright-no-dpi\.png Ready/ }),
  ).toBeVisible();
  await expect(page.getByText("1 x 1px")).toBeVisible();
  await expect(page.getByRole("button", { name: /Place 1/ })).toBeVisible();
});

test("customer sees empty artwork state after malformed saved project JSON", async ({
  page,
}) => {
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [autosaveKey, "{not-json"] as const,
  );

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Custom decal sheet" })).toBeVisible();
  await expect(
    page.getByText(
      "Saved project data was stale or unreadable, so we started a fresh sheet.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Drag files here or choose PNG")).toBeVisible();
  await expect(page.getByText("Upload and place artwork before requesting a proof.")).toBeVisible();
});

test("customer restore filters stale blob-only artwork and keeps durable missing-thumbnail artwork", async ({
  page,
}) => {
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [
      autosaveKey,
      JSON.stringify(
        createSavedDocument({
          assets: [
            {
              id: "stale-asset",
              sourceUrl: "blob:http://127.0.0.1:5173/stale",
              previewUrl: "blob:http://127.0.0.1:5173/stale-preview",
              fileName: "stale.png",
              fileType: "image/png",
            },
            {
              id: "durable-asset",
              sourceUrl: emptySvgDataUrl,
              fileName: "missing-thumbnail.svg",
              fileType: "image/svg+xml",
              heightPx: 600,
              widthPx: 600,
            },
          ],
          items: [
            createSavedItem("stale-item", "stale-asset", "stale.png"),
            createSavedItem(
              "durable-item",
              "durable-asset",
              "missing-thumbnail.svg",
            ),
          ],
        }),
      ),
    ] as const,
  );

  await page.goto("/");

  await expect(page.getByText("stale.png")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /missing-thumbnail\.svg Ready/ }),
  ).toBeVisible();
  await expect(page.getByText("600 x 600px")).toBeVisible();
});

test("customer sees an explicit fallback when an image preview cannot load", async ({
  page,
}) => {
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [
      autosaveKey,
      JSON.stringify(
        createSavedDocument({
          assets: [
            {
              id: "broken-preview-asset",
              sourceUrl: "data:image/png;base64,not-a-real-image",
              fileName: "broken-preview.png",
              fileType: "image/png",
              heightPx: 600,
              widthPx: 600,
            },
          ],
          items: [
            createSavedItem(
              "broken-preview-item",
              "broken-preview-asset",
              "broken-preview.png",
            ),
          ],
        }),
      ),
    ] as const,
  );

  await page.goto("/");

  await expect(
    page.getByRole("button", { name: /broken-preview\.png Ready/ }),
  ).toBeVisible();
  await expect(page.getByText("No preview")).toBeVisible();
});

test("customer invalid uploads show errors and keep the empty artwork state", async ({
  page,
}) => {
  await page.goto("/");

  await page.locator('input[type="file"]').first().setInputFiles({
    buffer: Buffer.from("not artwork"),
    mimeType: "text/plain",
    name: "notes.txt",
  });

  await expect(page.getByText("notes.txt is not a supported upload type.")).toBeVisible();
  await expect(page.getByText("Drag files here or choose PNG")).toBeVisible();

  await page.locator('input[type="file"]').first().setInputFiles({
    buffer: Buffer.alloc(25 * 1024 * 1024 + 1),
    mimeType: "image/png",
    name: "too-large.png",
  });

  await expect(
    page.getByText("too-large.png exceeds the 25 MB upload limit."),
  ).toBeVisible();
  await expect(page.getByText("Drag files here or choose PNG")).toBeVisible();
});

test("customer can reach submit proof readiness and submit a proof request", async ({
  page,
}) => {
  await page.route("http://localhost:4000/submit-project", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        files: {
          assets: "/projects/project-playwright/assets/",
          manifestJson: "/projects/project-playwright/manifest.json",
          previewPng: "/projects/project-playwright/preview.png",
          printPdf: "/projects/project-playwright/print.pdf",
          projectJson: "/projects/project-playwright/project.json",
        },
        projectId: "project-playwright",
        status: "submitted",
      },
      status: 201,
    });
  });

  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(artworkFile);

  await expect(
    page.getByRole("button", { name: "Submit Proof Request" }),
  ).toBeEnabled();
  await expect(page.getByText("Ready to submit once")).toBeVisible();

  await page.getByRole("button", { name: "Submit Proof Request" }).click();

  await expect(
    page.getByText("Submitted as project-playwright", { exact: true }),
  ).toBeVisible();
});

test("customer can recover after a failed proof submission response", async ({
  page,
}) => {
  let submitAttempts = 0;

  await page.route("http://localhost:4000/submit-project", async (route) => {
    submitAttempts += 1;

    if (submitAttempts === 1) {
      await route.fulfill({
        contentType: "application/json",
        json: { error: "Proof service temporarily unavailable." },
        status: 503,
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      json: {
        files: {
          assets: "/projects/project-playwright-retry/assets/",
          manifestJson: "/projects/project-playwright-retry/manifest.json",
          previewPng: "/projects/project-playwright-retry/preview.png",
          printPdf: "/projects/project-playwright-retry/print.pdf",
          projectJson: "/projects/project-playwright-retry/project.json",
        },
        projectId: "project-playwright-retry",
        status: "submitted",
      },
      status: 201,
    });
  });

  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(artworkFile);

  await page.getByRole("button", { name: "Submit Proof Request" }).click();

  await expect(page.getByText("Proof service temporarily unavailable.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit Proof Request" }),
  ).toBeEnabled();
  await expect(page.getByText("Submitted as project-playwright")).toHaveCount(0);

  await page.getByRole("button", { name: "Submit Proof Request" }).click();

  await expect(
    page.getByText("Submitted as project-playwright-retry", { exact: true }),
  ).toBeVisible();
});

function createSavedDocument({
  assets,
  items,
}: {
  assets: Array<Record<string, unknown>>;
  items: Array<Record<string, unknown>>;
}) {
  return {
    id: "project-playwright-restore",
    version: 1,
    productionProfileId: "sticker-sheet-mvp",
    sheet: {
      dpi: 300,
      heightIn: 17,
      sizeId: "11x17",
      widthIn: 11,
    },
    assets,
    items,
    settings: {
      background: {
        type: "transparent",
      },
    },
  };
}

function createSavedItem(id: string, assetId: string, name: string) {
  return {
    id,
    assetId,
    heightIn: 2,
    name,
    rotationDeg: 0,
    scaleX: 1,
    scaleY: 1,
    widthIn: 2,
    xIn: 0.5,
    yIn: 0.5,
  };
}
