import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, test, vi } from "vitest";
import { expectNoA11yViolations } from "../test/accessibility";
import AdminReviewScreen from "./AdminReviewScreen";
import {
  fetchAdminProjectDetail,
  fetchAdminProjects,
} from "./adminReviewApi";

vi.mock("./adminReviewApi", async () => {
  const actual =
    await vi.importActual<typeof import("./adminReviewApi")>(
      "./adminReviewApi"
    );

  return {
    ...actual,
    fetchAdminProjectDetail: vi.fn(),
    fetchAdminProjects: vi.fn(),
    getAdminFileUrl: (filePath: string) => `http://localhost:4000${filePath}`,
    updateAdminProjectReview: vi.fn(),
  };
});

const fetchAdminProjectsMock = vi.mocked(fetchAdminProjects);
const fetchAdminProjectDetailMock = vi.mocked(fetchAdminProjectDetail);

beforeEach(() => {
  vi.clearAllMocks();
  fetchAdminProjectsMock.mockResolvedValue([createProjectSummary()]);
  fetchAdminProjectDetailMock.mockResolvedValue(createProjectDetail());
});

afterEach(() => {
  cleanup();
});

describe("AdminReviewScreen accessibility", () => {
  test("has no axe violations for the loaded review workspace", async () => {
    const { container } = render(<AdminReviewScreen />);

    await screen.findByText("Review decision");

    await expectNoA11yViolations(container);
  });
});

function createProjectSummary() {
  return {
    projectId: "project-20260625120000-abc123",
    submittedAt: "2026-06-25T12:00:00.000Z",
    sheet: { sizeId: "11x17", widthIn: 11, heightIn: 17, dpi: 300 },
    counts: { assets: 1, items: 2 },
    files: {
      projectJson: "/projects/project-20260625120000-abc123/project.json",
      orderJson: "/projects/project-20260625120000-abc123/order.json",
      previewPng: "/projects/project-20260625120000-abc123/preview.png",
      printPdf: "/projects/project-20260625120000-abc123/print.pdf",
      manifestJson: "/projects/project-20260625120000-abc123/manifest.json",
    },
    review: {
      status: "submitted" as const,
      updatedAt: "2026-06-25T12:00:00.000Z",
      history: [],
    },
    storage: {
      files: [
        {
          contentType: "application/pdf",
          key: "proofs/project-20260625120000-abc123/print.pdf",
          path: "print.pdf",
          sizeBytes: 1468006,
        },
        {
          contentType: "image/png",
          key: "proofs/project-20260625120000-abc123/preview.png",
          path: "preview.png",
          sizeBytes: 1468006,
        },
        {
          contentType: "application/json",
          key: "proofs/project-20260625120000-abc123/order.json",
          path: "order.json",
          sizeBytes: 1408,
        },
        {
          contentType: "application/json",
          key: "proofs/project-20260625120000-abc123/project.json",
          path: "project.json",
          sizeBytes: 570285,
        },
      ],
      provider: "postgres+r2" as const,
      status: "stored" as const,
    },
  };
}

function createProjectDetail() {
  return {
    ...createProjectSummary(),
    files: {
      ...createProjectSummary().files,
      assetFiles: [
        {
          fileName: "pixel.png",
          path: "/projects/project-20260625120000-abc123/assets/pixel.png",
          sizeBytes: 2048,
        },
      ],
    },
    manifest: {
      document: {
        settings: { background: { type: "transparent" as const } },
      },
      preflight: {
        errorCount: 0,
        warningCount: 0,
        issues: [],
      },
    },
  };
}
