import { API_BASE_URL } from "../../config/appEnv";
import {
  buildExportBundleManifest,
  type PreflightIssue,
  type SheetDocument,
} from "../../domain/print";

export interface RenderProductionFilesResult {
  widthPx: number;
  heightPx: number;
  previewPngBase64: string;
  printPdfBase64: string;
}

export interface SubmitProjectForReviewResult {
  projectId: string;
  status: "submitted";
  files: {
    projectJson: string;
    previewPng: string;
    printPdf: string;
    manifestJson?: string;
    assets: string;
  };
}

export async function renderProductionFiles({
  assetFiles,
  customerNote,
  document,
  preflightIssues,
}: {
  assetFiles: Record<string, File>;
  customerNote?: string;
  document: SheetDocument;
  preflightIssues: PreflightIssue[];
}): Promise<RenderProductionFilesResult> {
  const response = await fetch(`${API_BASE_URL}/render-sheet`, {
    method: "POST",
    body: buildProductionFormData({
      assetFiles,
      customerNote,
      document,
      preflightIssues,
    }),
  });
  const payload = (await response.json()) as
    | RenderProductionFilesResult
    | { error?: string };

  if (!response.ok) {
    throw new Error(
      "error" in payload && payload.error
        ? payload.error
        : "Production render failed."
    );
  }

  return payload as RenderProductionFilesResult;
}

export async function submitProjectForReview({
  assetFiles,
  customerNote,
  document,
  preflightIssues,
}: {
  assetFiles: Record<string, File>;
  customerNote?: string;
  document: SheetDocument;
  preflightIssues: PreflightIssue[];
}): Promise<SubmitProjectForReviewResult> {
  const response = await fetch(`${API_BASE_URL}/submit-project`, {
    method: "POST",
    body: buildProductionFormData({
      assetFiles,
      customerNote,
      document,
      preflightIssues,
    }),
  });
  const payload = (await response.json()) as
    | SubmitProjectForReviewResult
    | { error?: string };

  if (!response.ok) {
    throw new Error(
      "error" in payload && payload.error
        ? payload.error
        : "Project submission failed."
    );
  }

  return payload as SubmitProjectForReviewResult;
}

function buildProductionFormData({
  assetFiles,
  customerNote,
  document,
  preflightIssues,
}: {
  assetFiles: Record<string, File>;
  customerNote?: string;
  document: SheetDocument;
  preflightIssues: PreflightIssue[];
}) {
  const formData = new FormData();
  const manifest = buildExportBundleManifest({
    customerNote,
    document,
    exportedAt: new Date().toISOString(),
    preflightIssues,
  });

  formData.append("manifest", JSON.stringify(manifest));

  for (const asset of document.assets) {
    const file =
      assetFiles[asset.id] ??
      dataUrlToFile(asset.sourceUrl, asset.fileName, asset.fileType);

    if (file) {
      formData.append("assets", file, asset.fileName);
    }
  }

  return formData;
}

function dataUrlToFile(
  dataUrl: string,
  fileName: string,
  fileType: string
): File | null {
  if (!dataUrl.startsWith("data:")) {
    return null;
  }

  const [header, base64] = dataUrl.split(",");

  if (!base64 || !header.includes(";base64")) {
    return null;
  }

  const mimeType = header.slice(5, header.indexOf(";")) || fileType;
  const bytes = Uint8Array.from(atob(base64), (character) =>
    character.charCodeAt(0)
  );

  return new File([bytes], fileName, { type: mimeType || fileType });
}
