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
          orderJson: "/projects/project-20260625120000-abc123/order.json",
          previewPng: "/projects/project-20260625120000-abc123/preview.png",
          printPdf: "/projects/project-20260625120000-abc123/print.pdf",
          manifestJson: "/projects/project-20260625120000-abc123/manifest.json",
        },
        review: {
          status: "submitted",
          updatedAt: "2026-06-25T12:00:00.000Z",
          history: [],
        },
        storage: createStoredProductionStorage(),
      },
    ]);
    fetchAdminProjectDetailMock.mockResolvedValue({
      projectId: "project-20260625120000-abc123",
      submittedAt: "2026-06-25T12:00:00.000Z",
      sheet: { sizeId: "11x17", widthIn: 11, heightIn: 17, dpi: 300 },
      counts: { assets: 2, items: 5 },
      files: {
        projectJson: "/projects/project-20260625120000-abc123/project.json",
        orderJson: "/projects/project-20260625120000-abc123/order.json",
        previewPng: "/projects/project-20260625120000-abc123/preview.png",
        printPdf: "/projects/project-20260625120000-abc123/print.pdf",
        manifestJson: "/projects/project-20260625120000-abc123/manifest.json",
        assetFiles: [
          {
            fileName: "pixel.png",
            path: "/projects/project-20260625120000-abc123/assets/pixel.png",
            sizeBytes: 2048,
          },
        ],
      },
      review: {
        status: "submitted",
        updatedAt: "2026-06-25T12:00:00.000Z",
        history: [],
      },
      storage: createStoredProductionStorage(),
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
    expect(screen.getByRole("heading", { name: "Print handoff" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Use the PDF as the print file. The preview and JSON record support production review."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Ready for print review")).toBeInTheDocument();
    expect(screen.getByText("PDF file")).toBeInTheDocument();
    expect(screen.getByText("Preview image")).toBeInTheDocument();
    expect(screen.getByText("Order JSON")).toBeInTheDocument();
    expect(screen.getByText("Original files")).toBeInTheDocument();
    expect(screen.getByText("1 file")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Production storage" })
    ).toBeInTheDocument();
    expect(screen.getByText("Production files stored")).toBeInTheDocument();
    expect(screen.getByText("Postgres + R2")).toBeInTheDocument();
    expect(screen.getByText("4 of 4 required")).toBeInTheDocument();
    expect(screen.getByText("proofs/project-20260625120000-abc123/print.pdf | 1.4 MB")).toBeInTheDocument();
    expect(screen.getAllByText("Stored").length).toBeGreaterThanOrEqual(5);
    expect(screen.getAllByText("Submitted").length).toBeGreaterThan(0);
    expect(screen.getByText("Current status")).toBeInTheDocument();
    expect(screen.getByText("Latest reviewer")).toBeInTheDocument();
    expect(screen.getByText("Not reviewed yet")).toBeInTheDocument();
    expect(screen.getByText(/No review decisions yet/)).toBeInTheDocument();
    expect(screen.getByText("Original artwork")).toBeInTheDocument();
    expect(screen.getByText("pixel.png")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Download PNG/ })[0]).toHaveAttribute(
      "download",
      "preview.png"
    );
    expect(screen.getAllByText("Order record").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: /Download order/ })).toHaveAttribute(
      "download",
      "order.json"
    );
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

    await screen.findByText(/No review decisions yet/);
    await userEvent.type(
      screen.getByPlaceholderText("Admin reviewer"),
      "Production lead"
    );
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
          reviewer: "Production lead",
        }
      );
    });
    expect(await screen.findByText("Ready for production.")).toBeInTheDocument();
    expect(screen.getAllByText("Approved").length).toBeGreaterThan(0);
    expect(screen.getByText("Decision 1")).toBeInTheDocument();
    expect(screen.getAllByText("Reviewer").length).toBeGreaterThan(0);
    expect(screen.getByText("Latest reviewer")).toBeInTheDocument();
    expect(screen.getAllByText("admin").length).toBeGreaterThan(0);
  });

  test("shows actionable review update errors and keeps entered notes", async () => {
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
    updateAdminProjectReviewMock.mockRejectedValue(
      new Error("Review note is too long. The backend returned HTTP 400.")
    );

    render(<AdminReviewScreen />);

    await screen.findByText(/No review decisions yet/);
    await userEvent.type(screen.getByPlaceholderText("Admin reviewer"), "QA");
    await userEvent.type(
      screen.getByPlaceholderText("Decision note"),
      "Please shorten this note."
    );
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(
      await screen.findByText("Could not save review decision.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Review note is too long. The backend returned HTTP 400.")
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Admin reviewer")).toHaveValue("QA");
    expect(screen.getByPlaceholderText("Decision note")).toHaveValue(
      "Please shorten this note."
    );
  });

  test("shows empty and retry states", async () => {
    fetchAdminProjectsMock.mockResolvedValueOnce([]);

    render(<AdminReviewScreen />);

    expect(
      await screen.findByText("No submitted projects found.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Submit a print order from the customer editor, then refresh this list."
      )
    ).toBeInTheDocument();

    fetchAdminProjectsMock.mockRejectedValueOnce(new Error("Backend offline."));
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(screen.getByText("Backend offline.")).toBeInTheDocument();
    });
  });
});

function createStoredProductionStorage() {
  return {
    files: [
      {
        contentType: "application/pdf",
        key: "proofs/project-20260625120000-abc123/print.pdf",
        path: "print.pdf",
        sizeBytes: 1_468_006,
      },
      {
        contentType: "image/png",
        key: "proofs/project-20260625120000-abc123/preview.png",
        path: "preview.png",
        sizeBytes: 1_468_006,
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
        sizeBytes: 570_285,
      },
    ],
    provider: "postgres+r2" as const,
    status: "stored" as const,
  };
}
