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

interface SubmittedProofManifest {
  document: {
    assets: Array<{
      fileName?: string;
      fileType?: string;
    }>;
    items: Array<{
      xIn?: number;
    }>;
  };
}

test("customer can upload artwork and reload the saved project preview", async ({
  page,
}) => {
  await page.goto("/");

  await page.locator('input[type="file"]').first().setInputFiles(pngWithoutDpiFile);

  await expect(
    page.getByRole("button", {
      name: /playwright-no-dpi\.png Needs attention/,
    }),
  ).toBeVisible();
  await expect(page.getByText("1 x 1px")).toBeVisible();
  await expect(page.getByText(/approximately 1 effective DPI/).first()).toBeVisible();
  await expect(page.getByLabel("Rotation")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Order Summary" })).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole("button", {
      name: /playwright-no-dpi\.png Needs attention/,
    }),
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
  await expect(page.getByText("Start with your artwork")).toBeVisible();
  await expect(page.getByText("Drag files here or choose PNG")).toBeVisible();
  await expect(
    page.getByText("We will place each file on the sheet for you."),
  ).toBeVisible();
  await expect(
    page.getByText("Upload artwork before submitting. We will place it for you."),
  ).toBeVisible();
});

test("Delete removes the artwork row when its last placed decal is selected", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(artworkFile);

  const artworkRow = page.getByRole("button", {
    name: /playwright-artwork\.svg Ready/,
  });

  await expect(artworkRow).toBeVisible();
  await page.keyboard.press("Delete");

  await expect(artworkRow).toHaveCount(0);
  await expect(
    page.getByText(
      "Upload your files once. We will place them automatically, then guide you through checking and submitting the sheet.",
    ),
  ).toBeVisible();
});

test("Delete preserves artwork while another placed copy still uses it", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(artworkFile);
  await page.getByRole("button", { name: "Duplicate" }).click();
  await page.keyboard.press("Delete");

  await expect(
    page.getByRole("button", {
      name: /playwright-artwork\.svg Ready/,
    }),
  ).toBeVisible();
  await expect(page.getByText("1 on sheet", { exact: true })).toBeVisible();
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

test("customer editor remains reachable without page-level horizontal overflow on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.locator('input[type="file"]').first().setInputFiles(artworkFile);

  await expect(
    page.getByRole("region", { name: "Sticker sheet canvas" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Editor controls and order summary"),
  ).toBeVisible();

  const pageLevelOverflowPx = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

  expect(pageLevelOverflowPx).toBeLessThanOrEqual(1);

  const submitButton = page.getByRole("button", {
    name: "Submit for Print",
  });

  await submitButton.scrollIntoViewIfNeeded();
  await expect(submitButton).toBeVisible();
  await expect(submitButton).toBeEnabled();
});

test("customer can reach print readiness and submit a print order", async ({
  page,
}) => {
  await page.route("http://localhost:4000/submit-project", async (route) => {
    await delay(300);
    await route.fulfill({
      contentType: "application/json",
      json: {
        files: {
          assets: "/projects/project-playwright/assets/",
          manifestJson: "/projects/project-playwright/manifest.json",
          orderJson: "/projects/project-playwright/order.json",
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
    page.getByRole("button", { name: "Submit for Print" }),
  ).toBeEnabled();
  await expect(page.getByText("Ready to submit once")).toBeVisible();

  await page.getByRole("button", { name: "Submit for Print" }).click();

  const submitProgress = page.locator("#production-submit-progress");

  await expect(submitProgress).toContainText("Submitting for print");
  await expect(submitProgress).toContainText(
    "Uploading artwork and requesting the print PDF.",
  );
  const receipt = page.getByRole("status", {
    name: "Proof submitted receipt",
  });
  await expect(receipt.getByText("Proof submitted", { exact: true })).toBeVisible();
  await expect(
    receipt.getByText("Project ID: project-playwright", { exact: true }),
  ).toBeVisible();
  await expect(receipt.getByText("What was saved")).toBeVisible();
  await expect(receipt.getByText("Print PDF", { exact: true })).toBeVisible();
  await expect(
    receipt.getByText("Proof preview", { exact: true }),
  ).toBeVisible();
  await expect(
    receipt.getByText("Order details", { exact: true }),
  ).toBeVisible();
  await expect(
    receipt.getByText("Project backup", { exact: true }),
  ).toBeVisible();
  await expect(receipt.getByText("What happens next")).toBeVisible();
});

test("customer main proof path preserves layout, order summary, submit payload, and reload", async ({
  page,
}) => {
  let submittedManifest: SubmittedProofManifest | null = null;
  let submittedBody = "";

  await page.route("http://localhost:4000/submit-project", async (route) => {
    submittedBody = route.request().postDataBuffer()?.toString("utf8") ?? "";
    submittedManifest = extractMultipartJsonField<SubmittedProofManifest>(
      submittedBody,
      "manifest",
    );

    expect(submittedBody).toContain('filename="playwright-artwork.svg"');
    expect(submittedManifest.document.assets).toHaveLength(1);
    expect(submittedManifest.document.assets[0]).toMatchObject({
      fileName: "playwright-artwork.svg",
      fileType: "image/svg+xml",
    });
    expect(submittedManifest.document.items).toHaveLength(2);
    expect(
      new Set(
        submittedManifest.document.items.map((item) => item.xIn),
      ).size,
    ).toBeGreaterThan(1);

    await route.fulfill({
      contentType: "application/json",
      json: {
        files: {
          assets: "/projects/project-playwright-main/assets/",
          manifestJson: "/projects/project-playwright-main/manifest.json",
          orderJson: "/projects/project-playwright-main/order.json",
          previewPng: "/projects/project-playwright-main/preview.png",
          printPdf: "/projects/project-playwright-main/print.pdf",
          projectJson: "/projects/project-playwright-main/project.json",
        },
        projectId: "project-playwright-main",
        storage: {
          files: [],
          provider: "postgres+r2",
          status: "queued",
        },
        status: "submitted",
      },
      status: 201,
    });
  });

  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(artworkFile);

  await expect(
    page.getByRole("button", { name: /playwright-artwork\.svg Ready/ }),
  ).toBeVisible();
  await expect(page.getByText("Vector artwork; DPI metadata is not required")).toBeVisible();

  await page.getByText("View", { exact: true }).click();
  await expect(
    page.getByRole("checkbox", { exact: true, name: "Grid" }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Spacing guides" }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Snap to grid" }),
  ).toBeChecked();
  await page.getByRole("checkbox", { name: "Snap to grid" }).uncheck();
  await page
    .getByRole("checkbox", { name: "Snap to decals and sheet" })
    .uncheck();
  await expect(
    page.getByRole("checkbox", { name: "Snap to grid" }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Snap to decals and sheet" }),
  ).not.toBeChecked();

  await page.getByRole("button", { name: "Duplicate" }).click();
  const autoArrangeButton = page.getByRole("button", {
    name: "Auto-arrange sheet",
  });
  await expect(autoArrangeButton).toHaveClass(/bg-sky-700/);
  await autoArrangeButton.click();

  const editorSummary = page.getByLabel("Editor controls and order summary");

  await expect(editorSummary.getByText("Order Summary")).toBeVisible();
  await expect(editorSummary.getByText("Decals", { exact: true })).toBeVisible();
  await expect(editorSummary.getByText("2", { exact: true })).toBeVisible();
  await expect(editorSummary.getByText("Estimated total", { exact: true })).toBeVisible();
  await expect(editorSummary.getByText("$10.00", { exact: true })).toHaveCount(2);
  await expect(editorSummary.getByText("Sheet count", { exact: true })).toBeVisible();
  await expect(editorSummary.getByText("1 sheet", { exact: true })).toBeVisible();
  await expect(editorSummary.getByText("Price", { exact: true })).toBeVisible();
  await expect(
    editorSummary.getByText("$7.50 per sheet", { exact: true }),
  ).toBeVisible();
  await expect(editorSummary.getByText("Minimum order", { exact: true })).toBeVisible();
  await expect(
    editorSummary.getByText("Free shipping threshold", { exact: true }),
  ).toBeVisible();
  await expect(
    editorSummary.getByText("$15.00 from free shipping.", { exact: true }),
  ).toBeVisible();
  await expect(editorSummary.getByText("Ready", { exact: true })).toHaveCount(2);

  await page.getByRole("button", { name: "Submit for Print" }).click();

  const receipt = page.getByRole("status", {
    name: "Proof submitted receipt",
  });
  await expect(receipt.getByText("Proof submitted", { exact: true })).toBeVisible();
  await expect(
    receipt.getByText("Project ID: project-playwright-main", { exact: true }),
  ).toBeVisible();
  await expect(receipt.getByText("What was saved")).toBeVisible();
  await expect(receipt.getByText("Print PDF", { exact: true })).toBeVisible();
  await expect(
    receipt.getByText("Proof preview", { exact: true }),
  ).toBeVisible();
  await expect(
    receipt.getByText("Order details", { exact: true }),
  ).toBeVisible();
  await expect(
    receipt.getByText("Project backup", { exact: true }),
  ).toBeVisible();
  await expect(
    receipt.getByText(
      "The print PDF and order details are ready for review. We will follow up if anything needs attention before printing.",
    ),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "Application instructions for when your decals arrive",
    })
    .click();
  const instructionsDialog = page.getByRole("dialog", {
    name: "Application instructions",
  });
  await expect(instructionsDialog).toBeVisible();
  await expect(instructionsDialog.getByText("Prep + pre-squeegee")).toBeVisible();
  await expect(
    instructionsDialog.getByRole("link", {
      name: "Download instructions PDF",
    }),
  ).toHaveAttribute("href", "/uv-dtf-sticker-application-instructions.pdf");
  await page.keyboard.press("Escape");
  await expect(instructionsDialog).toHaveCount(0);
  expect(submittedManifest).not.toBeNull();

  await page.reload();

  await expect(
    page.getByRole("button", { name: /playwright-artwork\.svg Ready/ }),
  ).toBeVisible();
  await expect(page.getByLabel("Editor controls and order summary").getByText("2", { exact: true })).toBeVisible();
});

test("Auto-arrange confirms overflow and creates a priced second sheet", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(artworkFile);
  await page
    .getByRole("spinbutton", { name: "Quantity for playwright-artwork.svg" })
    .fill("20");
  await page.getByRole("button", { name: "Place 20" }).click();

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toMatch(
      /\d+ decals don’t fit\. Add Sheet 2\?/,
    );
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Auto-arrange sheet" }).click();

  await expect(page.getByRole("button", { name: /Sheet 1/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Sheet 2/ })).toBeVisible();
  await expect(
    page.getByLabel("Editor controls and order summary").getByText("2 sheets", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Editor controls and order summary").getByText("$15.00", {
      exact: true,
    }),
  ).toHaveCount(2);
});

test("customer can recover after a failed print submission response", async ({
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
          orderJson: "/projects/project-playwright-retry/order.json",
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

  await page.getByRole("button", { name: "Submit for Print" }).click();

  const submitAlert = page.locator("#production-submit-failure");

  await expect(submitAlert).toContainText("Proof service temporarily unavailable.");
  await expect(submitAlert).toContainText(
    "Submission did not complete.",
  );
  await expect(submitAlert).toContainText(
    "Check your connection and try again.",
  );
  await expect(
    page.getByRole("button", { name: "Submit for Print" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("status", { name: "Proof submitted receipt" }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Submit for Print" }).click();

  await expect(
    page
      .getByRole("status", { name: "Proof submitted receipt" })
      .getByText("Project ID: project-playwright-retry", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("#production-submit-failure")).toHaveCount(0);
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function extractMultipartJsonField<T>(body: string, fieldName: string): T {
  const fieldMarker = `name="${fieldName}"`;
  const fieldStart = body.indexOf(fieldMarker);

  expect(fieldStart).toBeGreaterThanOrEqual(0);

  const valueStart = body.indexOf("\r\n\r\n", fieldStart);

  expect(valueStart).toBeGreaterThanOrEqual(0);

  const valueEnd = body.indexOf("\r\n--", valueStart + 4);

  expect(valueEnd).toBeGreaterThan(valueStart);

  return JSON.parse(body.slice(valueStart + 4, valueEnd)) as T;
}
