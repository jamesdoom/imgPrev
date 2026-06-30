import { expect, test } from "@playwright/test";

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

test("customer can upload artwork and reload the saved project preview", async ({
  page,
}) => {
  await page.goto("/");

  await page.locator('input[type="file"]').first().setInputFiles(artworkFile);

  await expect(
    page.getByRole("button", { name: /playwright-artwork\.svg Ready/ }),
  ).toBeVisible();
  await expect(page.getByText("600 x 600px")).toBeVisible();
  await expect(page.getByLabel("Rotation")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Order Summary" })).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole("button", { name: /playwright-artwork\.svg Ready/ }),
  ).toBeVisible();
  await expect(page.getByText("600 x 600px")).toBeVisible();
  await expect(page.getByRole("button", { name: /Place 1/ })).toBeVisible();
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
