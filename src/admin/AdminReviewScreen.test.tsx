import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import AdminReviewScreen from "./AdminReviewScreen";
import {
  fetchAdminProjectDetail,
  fetchAdminProjects,
  updateAdminProjectReview,
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
const updateAdminProjectReviewMock = vi.mocked(updateAdminProjectReview);

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
        sheet: { sizeId: "11x17", widthIn: 11, heightIn: 17, dpi: 300 },
        counts: { assets: 2, items: 5 },
        files: {
          projectJson: "/projects/project-20260625120000-abc123/project.json",
          previewPng: "/projects/project-20260625120000-abc123/preview.png",
          printPdf: "/projects/project-20260625120000-abc123/print.pdf",
          manifestJson: "/projects/project-20260625120000-abc123/manifest.json",
        },
        review: {
          status: "submitted",
          updatedAt: "2026-06-25T12:00:00.000Z",
          history: [],
        },
      },
    ]);
    fetchAdminProjectDetailMock.mockResolvedValue({
      projectId: "project-20260625120000-abc123",
      submittedAt: "2026-06-25T12:00:00.000Z",
      sheet: { sizeId: "11x17", widthIn: 11, heightIn: 17, dpi: 300 },
      counts: { assets: 2, items: 5 },
      files: {
        projectJson: "/projects/project-20260625120000-abc123/project.json",
        previewPng: "/projects/project-20260625120000-abc123/preview.png",
        printPdf: "/projects/project-20260625120000-abc123/print.pdf",
        manifestJson: "/projects/project-20260625120000-abc123/manifest.json",
      },
      review: {
        status: "submitted",
        updatedAt: "2026-06-25T12:00:00.000Z",
        history: [],
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
    expect(screen.getAllByText("Submitted").length).toBeGreaterThan(0);
    expect(screen.getByText("No review decisions yet.")).toBeInTheDocument();
    expect(fetchAdminProjectDetailMock).toHaveBeenCalledWith(
      "project-20260625120000-abc123"
    );
  });

  test("updates the selected project review status", async () => {
    fetchAdminProjectsMock.mockResolvedValue([
      {
        projectId: "project-20260625120000-abc123",
        submittedAt: "2026-06-25T12:00:00.000Z",
        sheet: { sizeId: "11x17", widthIn: 11, heightIn: 17, dpi: 300 },
        counts: { assets: 1, items: 1 },
        files: {},
        review: {
          status: "submitted",
          updatedAt: "2026-06-25T12:00:00.000Z",
          history: [],
        },
      },
    ]);
    fetchAdminProjectDetailMock.mockResolvedValue({
      projectId: "project-20260625120000-abc123",
      submittedAt: "2026-06-25T12:00:00.000Z",
      sheet: { sizeId: "11x17", widthIn: 11, heightIn: 17, dpi: 300 },
      counts: { assets: 1, items: 1 },
      files: {},
      review: {
        status: "submitted",
        updatedAt: "2026-06-25T12:00:00.000Z",
        history: [],
      },
      manifest: {
        document: {
          settings: { background: { type: "transparent" } },
        },
      },
    });
    updateAdminProjectReviewMock.mockResolvedValue({
      projectId: "project-20260625120000-abc123",
      submittedAt: "2026-06-25T12:00:00.000Z",
      sheet: { sizeId: "11x17", widthIn: 11, heightIn: 17, dpi: 300 },
      counts: { assets: 1, items: 1 },
      files: {},
      review: {
        status: "approved",
        updatedAt: "2026-06-25T13:00:00.000Z",
        history: [
          {
            status: "approved",
            note: "Ready for production.",
            reviewer: "admin",
            reviewedAt: "2026-06-25T13:00:00.000Z",
          },
        ],
      },
      manifest: {
        document: {
          settings: { background: { type: "transparent" } },
        },
      },
    });

    render(<AdminReviewScreen />);

    await screen.findByText("No review decisions yet.");
    await userEvent.type(
      screen.getByPlaceholderText("Decision note"),
      "Ready for production."
    );
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(updateAdminProjectReviewMock).toHaveBeenCalledWith(
        "project-20260625120000-abc123",
        {
          status: "approved",
          note: "Ready for production.",
        }
      );
    });
    expect(await screen.findByText("Ready for production.")).toBeInTheDocument();
    expect(screen.getAllByText("Approved").length).toBeGreaterThan(0);
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
