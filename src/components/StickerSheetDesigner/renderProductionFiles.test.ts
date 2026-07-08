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
      sheetSizeId: "11x17",
    }),
    assets: [
      {
        id: "asset-1",
        sourceUrl: "blob:asset-1",
        fileName: "decal.png",
        fileType: "image/png",
      },
    ],
    items: [
      {
        assetId: "asset-1",
        heightIn: 1,
        id: "item-1",
        rotationDeg: 0,
        scaleX: 1,
        scaleY: 1,
        widthIn: 1,
        xIn: 0.5,
        yIn: 0.5,
      },
    ],
  };
}

function assetFileMap() {
  return {
    "asset-1": new File(["asset"], "decal.png", { type: "image/png" }),
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
          widthPx: 3300,
          heightPx: 5100,
          previewPngBase64: "png",
          printPdfBase64: "pdf",
        }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      renderProductionFiles({
        document: documentWithAsset(),
        customer: {
          company: "Decal Shop",
          email: "buyer@example.com",
          name: "Buyer Name",
        },
        customerNote: "Please keep the blue decal near the top.",
        preflightIssues: [],
        assetFiles: {
          "asset-1": new File(["asset"], "decal.png", { type: "image/png" }),
        },
      })
    ).resolves.toMatchObject({
      widthPx: 3300,
      heightPx: 5100,
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
    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    const manifest = JSON.parse(String(body.get("manifest"))) as {
      customer: { company: string; email: string; name: string; note: string };
    };

    expect(manifest.customer.company).toBe("Decal Shop");
    expect(manifest.customer.email).toBe("buyer@example.com");
    expect(manifest.customer.name).toBe("Buyer Name");
    expect(manifest.customer.note).toBe(
      "Please keep the blue decal near the top."
    );
  });

  test("rebuilds uploaded assets from persisted data URLs", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          widthPx: 3300,
          heightPx: 5100,
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
        assetFiles: assetFileMap(),
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
        assetFiles: assetFileMap(),
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

  test("posts each placed uploaded asset when submitting a multi-image sheet", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          projectId: "project-20260623120000-multi1",
          storage: {
            files: [],
            provider: "postgres+r2",
            status: "queued",
          },
          status: "submitted",
          files: {
            projectJson: "/projects/project-20260623120000-multi1/project.json",
            previewPng: "/projects/project-20260623120000-multi1/preview.png",
            printPdf: "/projects/project-20260623120000-multi1/print.pdf",
            assets: "/projects/project-20260623120000-multi1/assets/",
          },
        }),
    });
    const document = {
      ...createSheetDocument({
        id: "project-1",
        sheetSizeId: "11x17",
      }),
      assets: ["left", "center", "right"].map((name) => ({
        id: `asset-${name}`,
        sourceUrl: `blob:asset-${name}`,
        fileName: `${name}.png`,
        fileType: "image/png",
      })),
      items: ["left", "center", "right"].map((name, index) => ({
        assetId: `asset-${name}`,
        heightIn: 1,
        id: `item-${name}`,
        rotationDeg: 0,
        scaleX: 1,
        scaleY: 1,
        widthIn: 1,
        xIn: 0.5 + index,
        yIn: 0.5,
      })),
    };

    vi.stubGlobal("fetch", fetchMock);

    await submitProjectForReview({
      document,
      preflightIssues: [],
      assetFiles: {
        "asset-left": new File(["left"], "left.png", { type: "image/png" }),
        "asset-center": new File(["center"], "center.png", {
          type: "image/png",
        }),
        "asset-right": new File(["right"], "right.png", {
          type: "image/png",
        }),
      },
    });

    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    const assetFiles = body.getAll("assets") as File[];
    const manifest = JSON.parse(String(body.get("manifest"))) as {
      document: { assets: Array<{ fileName: string }> };
    };

    expect(assetFiles.map((file) => file.name)).toEqual([
      "left.png",
      "center.png",
      "right.png",
    ]);
    expect(manifest.document.assets.map((asset) => asset.fileName)).toEqual([
      "left.png",
      "center.png",
      "right.png",
    ]);
    expect(assetFiles.map((file) => file.name)).not.toContain(
      "stale-library-artwork.png"
    );
  });

  test("omits unplaced stale library assets from print submissions", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          projectId: "project-20260623120000-placed",
          status: "submitted",
          files: {
            projectJson: "/projects/project-20260623120000-placed/project.json",
            previewPng: "/projects/project-20260623120000-placed/preview.png",
            printPdf: "/projects/project-20260623120000-placed/print.pdf",
            assets: "/projects/project-20260623120000-placed/assets/",
          },
        }),
    });
    const document = {
      ...documentWithAsset(),
      assets: [
        ...documentWithAsset().assets,
        {
          id: "asset-stale",
          sourceUrl: "data:image/png;base64,c3RhbGU=",
          fileName: "stale-library-artwork.png",
          fileType: "image/png",
        },
      ],
    };

    vi.stubGlobal("fetch", fetchMock);

    await submitProjectForReview({
      document,
      preflightIssues: [],
      assetFiles: {
        "asset-1": new File(["asset"], "decal.png", { type: "image/png" }),
      },
    });

    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    const assetFiles = body.getAll("assets") as File[];
    const manifest = JSON.parse(String(body.get("manifest"))) as {
      document: { assets: Array<{ fileName: string }> };
    };

    expect(assetFiles.map((file) => file.name)).toEqual(["decal.png"]);
    expect(manifest.document.assets.map((asset) => asset.fileName)).toEqual([
      "decal.png",
    ]);
  });

  test("rejects print submissions when placed artwork no longer has an original file", async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      submitProjectForReview({
        document: documentWithAsset(),
        preflightIssues: [],
        assetFiles: {},
      })
    ).rejects.toThrow(
      "Missing original artwork for decal.png. Re-upload this artwork before submitting or exporting a proof."
    );
    expect(fetchMock).not.toHaveBeenCalled();
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
        assetFiles: assetFileMap(),
      })
    ).rejects.toThrow("Project submission failed.");
  });

  test("throws fallback submission errors when the backend response is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error("not json")),
      })
    );

    await expect(
      submitProjectForReview({
        document: documentWithAsset(),
        preflightIssues: [],
        assetFiles: assetFileMap(),
      })
    ).rejects.toThrow("Project submission failed.");
  });

  test("rejects malformed successful submission responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "submitted",
            files: {},
          }),
      })
    );

    await expect(
      submitProjectForReview({
        document: documentWithAsset(),
        preflightIssues: [],
        assetFiles: assetFileMap(),
      })
    ).rejects.toThrow(
      "Project submission could not be confirmed. Please try again."
    );
  });
});
