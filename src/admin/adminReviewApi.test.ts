import { afterEach, describe, expect, test, vi } from "vitest";
import {
  fetchAdminProjectDetail,
  fetchAdminProjects,
  getAdminFileUrl,
} from "./adminReviewApi";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("adminReviewApi", () => {
  test("loads submitted project summaries", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          projects: [
            {
              projectId: "project-20260625120000-abc123",
              submittedAt: "2026-06-25T12:00:00.000Z",
              sheet: { widthIn: 4, heightIn: 6, dpi: 300 },
              counts: { assets: 2, items: 5 },
              files: { projectJson: "/projects/project-1/project.json" },
            },
          ],
        }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAdminProjects()).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/admin/projects"
    );
  });

  test("loads project details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            project: {
              projectId: "project-20260625120000-abc123",
              submittedAt: "2026-06-25T12:00:00.000Z",
              sheet: { widthIn: 4, heightIn: 6, dpi: 300 },
              counts: { assets: 1, items: 1 },
              files: {},
              manifest: {
                document: {
                  settings: { background: { type: "transparent" } },
                },
              },
            },
          }),
      })
    );

    await expect(
      fetchAdminProjectDetail("project-20260625120000-abc123")
    ).resolves.toMatchObject({
      projectId: "project-20260625120000-abc123",
      manifest: {
        document: {
          settings: { background: { type: "transparent" } },
        },
      },
    });
  });

  test("throws backend errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Project not found." }),
      })
    );

    await expect(
      fetchAdminProjectDetail("project-20260625120000-missing")
    ).rejects.toThrow("Project not found.");
  });

  test("builds absolute file URLs from backend paths", () => {
    expect(getAdminFileUrl("/projects/project-1/print.pdf")).toBe(
      "http://localhost:4000/projects/project-1/print.pdf"
    );
    expect(getAdminFileUrl("https://example.test/preview.png")).toBe(
      "https://example.test/preview.png"
    );
  });
});
