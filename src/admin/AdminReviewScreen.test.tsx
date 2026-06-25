import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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
  };
});

const fetchAdminProjectsMock = vi.mocked(fetchAdminProjects);
const fetchAdminProjectDetailMock = vi.mocked(fetchAdminProjectDetail);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("AdminReviewScreen", () => {
  test("loads submissions and selected project details", async () => {
    fetchAdminProjectsMock.mockResolvedValue([
      {
        projectId: "project-20260625120000-abc123",
        submittedAt: "2026-06-25T12:00:00.000Z",
        sheet: { sizeId: "4x6", widthIn: 4, heightIn: 6, dpi: 300 },
        counts: { assets: 2, items: 5 },
        files: {
          projectJson: "/projects/project-20260625120000-abc123/project.json",
          previewPng: "/projects/project-20260625120000-abc123/preview.png",
          printPdf: "/projects/project-20260625120000-abc123/print.pdf",
          manifestJson: "/projects/project-20260625120000-abc123/manifest.json",
        },
      },
    ]);
    fetchAdminProjectDetailMock.mockResolvedValue({
      projectId: "project-20260625120000-abc123",
      submittedAt: "2026-06-25T12:00:00.000Z",
      sheet: { sizeId: "4x6", widthIn: 4, heightIn: 6, dpi: 300 },
      counts: { assets: 2, items: 5 },
      files: {
        projectJson: "/projects/project-20260625120000-abc123/project.json",
        previewPng: "/projects/project-20260625120000-abc123/preview.png",
        printPdf: "/projects/project-20260625120000-abc123/print.pdf",
        manifestJson: "/projects/project-20260625120000-abc123/manifest.json",
      },
      manifest: {
        document: {
          settings: { background: { type: "solid", color: "#ffffff" } },
        },
        preflight: {
          errorCount: 0,
          warningCount: 1,
          issues: [
            {
              id: "issue-1",
              severity: "warning",
              code: "dpi-below-warning",
              message: "Artwork is below the preferred DPI.",
            },
          ],
        },
      },
    });

    render(<AdminReviewScreen />);

    expect(await screen.findByText("Admin review")).toBeInTheDocument();
    expect(await screen.findByText("Solid #ffffff")).toBeInTheDocument();
    expect(
      await screen.findAllByText("project-20260625120000-abc123")
    ).toHaveLength(2);
    expect(
      screen.getByText("Artwork is below the preferred DPI.")
    ).toBeInTheDocument();
    expect(fetchAdminProjectDetailMock).toHaveBeenCalledWith(
      "project-20260625120000-abc123"
    );
  });

  test("shows empty and retry states", async () => {
    fetchAdminProjectsMock.mockResolvedValueOnce([]);

    render(<AdminReviewScreen />);

    expect(
      await screen.findByText("No submitted projects found.")
    ).toBeInTheDocument();

    fetchAdminProjectsMock.mockRejectedValueOnce(new Error("Backend offline."));
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(screen.getByText("Backend offline.")).toBeInTheDocument();
    });
  });
});
