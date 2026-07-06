import { expect, test } from "@playwright/test";

const projectId = "project-playwright-admin";
const submittedProject = {
  counts: {
    assets: 1,
    items: 1,
  },
  files: {
    assetFiles: [
      {
        fileName: "playwright-artwork.svg",
        path: `/projects/${projectId}/assets/playwright-artwork.svg`,
        sizeBytes: 275,
      },
    ],
    assets: `/projects/${projectId}/assets/`,
    manifestJson: `/projects/${projectId}/manifest.json`,
    orderJson: `/projects/${projectId}/order.json`,
    previewPng: `/projects/${projectId}/preview.png`,
    printPdf: `/projects/${projectId}/print.pdf`,
    projectJson: `/projects/${projectId}/project.json`,
  },
  manifest: {
    document: {
      settings: {
        background: {
          type: "transparent",
        },
      },
    },
    preflight: {
      errorCount: 0,
      issues: [],
      warningCount: 0,
    },
  },
  projectId,
  review: {
    history: [],
    status: "submitted",
  },
  sheet: {
    dpi: 300,
    heightIn: 17,
    sizeId: "11x17",
    widthIn: 11,
  },
  submittedAt: "2026-06-30T14:00:00.000Z",
};

test("admin can review downloadable previews and approve a project", async ({
  page,
}) => {
  await page.route("http://localhost:4000/admin/projects", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { projects: [submittedProject] },
    });
  });
  await page.route(
    `http://localhost:4000/admin/projects/${projectId}`,
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: { project: submittedProject },
      });
    },
  );
  await page.route(
    `http://localhost:4000/admin/projects/${projectId}/review`,
    async (route) => {
      expect(route.request().method()).toBe("PATCH");
      expect(await route.request().postDataJSON()).toMatchObject({
        note: "Looks production ready.",
        reviewer: "Playwright QA",
        status: "approved",
      });

      await route.fulfill({
        contentType: "application/json",
        json: {
          project: {
            ...submittedProject,
            review: {
              history: [
                {
                  note: "Looks production ready.",
                  reviewedAt: "2026-06-30T14:05:00.000Z",
                  reviewer: "Playwright QA",
                  status: "approved",
                },
              ],
              status: "approved",
            },
          },
        },
      });
    },
  );

  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: "Admin review" })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(projectId) }).click();

  await expect(page.getByRole("img", { name: "Submitted sheet preview" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Download PNG/ }).first()).toHaveAttribute(
    "href",
    "http://localhost:4000/projects/project-playwright-admin/preview.png",
  );
  await expect(page.getByText("Print PDF")).toBeVisible();
  await expect(page.getByText("Order record")).toBeVisible();
  await expect(page.getByRole("link", { name: /Download order/ })).toHaveAttribute(
    "href",
    "http://localhost:4000/projects/project-playwright-admin/order.json",
  );

  await page.getByPlaceholder("Admin reviewer").fill("Playwright QA");
  await page.getByPlaceholder("Decision note").fill("Looks production ready.");
  await page.getByRole("button", { name: "Approve" }).click();

  await expect(page.getByText("Approved").first()).toBeVisible();
  await expect(page.getByText("Decision 1")).toBeVisible();
  await expect(page.getByText("Latest reviewer")).toBeVisible();
  await expect(page.getByText("Looks production ready.")).toBeVisible();
});

test("admin can inspect downloadable project files and reject a submitted proof", async ({
  page,
}) => {
  await page.route("http://localhost:4000/admin/projects", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { projects: [submittedProject] },
    });
  });
  await page.route(
    `http://localhost:4000/admin/projects/${projectId}`,
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: { project: submittedProject },
      });
    },
  );
  await page.route(
    `http://localhost:4000/admin/projects/${projectId}/review`,
    async (route) => {
      expect(route.request().method()).toBe("PATCH");
      expect(await route.request().postDataJSON()).toMatchObject({
        note: "Artwork edge is too close to the cutline.",
        reviewer: "Print Desk",
        status: "rejected",
      });

      await route.fulfill({
        contentType: "application/json",
        json: {
          project: {
            ...submittedProject,
            review: {
              history: [
                {
                  note: "Artwork edge is too close to the cutline.",
                  reviewedAt: "2026-06-30T14:08:00.000Z",
                  reviewer: "Print Desk",
                  status: "rejected",
                },
              ],
              status: "rejected",
            },
          },
        },
      });
    },
  );

  await page.goto("/admin");
  await page.getByRole("button", { name: new RegExp(projectId) }).click();

  await expect(
    page.locator('a[download="project.json"]'),
  ).toHaveAttribute(
    "href",
    "http://localhost:4000/projects/project-playwright-admin/project.json",
  );
  await expect(
    page.locator('a[download="manifest.json"]'),
  ).toHaveAttribute(
    "href",
    "http://localhost:4000/projects/project-playwright-admin/manifest.json",
  );
  await expect(
    page.locator('a[download="playwright-artwork.svg"]'),
  ).toHaveAttribute(
    "href",
    "http://localhost:4000/projects/project-playwright-admin/assets/playwright-artwork.svg",
  );

  await page.getByPlaceholder("Admin reviewer").fill("Print Desk");
  await page
    .getByPlaceholder("Decision note")
    .fill("Artwork edge is too close to the cutline.");
  await page.getByRole("button", { name: "Reject" }).click();

  await expect(page.getByText("Rejected").first()).toBeVisible();
  await expect(page.getByText("Decision 1")).toBeVisible();
  await expect(
    page.getByText("Artwork edge is too close to the cutline."),
  ).toBeVisible();
  await expect(page.getByText("Print Desk").first()).toBeVisible();
});
