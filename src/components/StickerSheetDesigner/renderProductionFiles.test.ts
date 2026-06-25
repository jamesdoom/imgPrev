import { afterEach, describe, expect, test, vi } from "vitest";
import { createSheetDocument } from "../../domain/print";
import {
  renderProductionFiles,
  submitProjectForReview,
} from "./renderProductionFiles";

function documentWithAsset() {
  return {
    ...createSheetDocument({
      id: "project-1",
      sheetSizeId: "4x6",
    }),
    assets: [
      {
        id: "asset-1",
        sourceUrl: "blob:asset-1",
        fileName: "decal.png",
        fileType: "image/png",
      },
    ],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("renderProductionFiles", () => {
  test("posts the manifest and original assets to the backend renderer", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          widthPx: 1200,
          heightPx: 1800,
          previewPngBase64: "png",
          printPdfBase64: "pdf",
        }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      renderProductionFiles({
        document: documentWithAsset(),
        preflightIssues: [],
        assetFiles: {
          "asset-1": new File(["asset"], "decal.png", { type: "image/png" }),
        },
      })
    ).resolves.toMatchObject({
      widthPx: 1200,
      heightPx: 1800,
      previewPngBase64: "png",
      printPdfBase64: "pdf",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/render-sheet",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      })
    );
  });

  test("rebuilds uploaded assets from persisted data URLs", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          widthPx: 1200,
          heightPx: 1800,
          previewPngBase64: "png",
          printPdfBase64: "pdf",
        }),
    });
    const document = {
      ...documentWithAsset(),
      assets: [
        {
          id: "asset-1",
          sourceUrl: "data:image/png;base64,YXNzZXQ=",
          previewUrl: "data:image/png;base64,YXNzZXQ=",
          fileName: "decal.png",
          fileType: "image/png",
        },
      ],
    };

    vi.stubGlobal("fetch", fetchMock);

    await renderProductionFiles({
      document,
      preflightIssues: [],
      assetFiles: {},
    });

    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    const rebuiltAsset = body.getAll("assets")[0];

    expect(rebuiltAsset).toBeInstanceOf(File);
    expect((rebuiltAsset as File).name).toBe("decal.png");
    expect((rebuiltAsset as File).type).toBe("image/png");
  });

  test("throws backend renderer errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Missing uploaded asset file." }),
      })
    );

    await expect(
      renderProductionFiles({
        document: documentWithAsset(),
        preflightIssues: [],
        assetFiles: {},
      })
    ).rejects.toThrow("Missing uploaded asset file.");
  });

  test("posts projects to the backend review queue", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          projectId: "project-20260623120000-abc123",
          status: "submitted",
          files: {
            projectJson: "/projects/project-20260623120000-abc123/project.json",
            previewPng: "/projects/project-20260623120000-abc123/preview.png",
            printPdf: "/projects/project-20260623120000-abc123/print.pdf",
            assets: "/projects/project-20260623120000-abc123/assets/",
          },
        }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      submitProjectForReview({
        document: documentWithAsset(),
        preflightIssues: [],
        assetFiles: {
          "asset-1": new File(["asset"], "decal.png", { type: "image/png" }),
        },
      })
    ).resolves.toMatchObject({
      projectId: "project-20260623120000-abc123",
      status: "submitted",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/submit-project",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      })
    );
  });

  test("throws backend submission errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Project submission failed." }),
      })
    );

    await expect(
      submitProjectForReview({
        document: documentWithAsset(),
        preflightIssues: [],
        assetFiles: {},
      })
    ).rejects.toThrow("Project submission failed.");
  });
});
