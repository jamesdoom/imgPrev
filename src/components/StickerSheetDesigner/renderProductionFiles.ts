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
  document,
  preflightIssues,
}: {
  assetFiles: Record<string, File>;
  document: SheetDocument;
  preflightIssues: PreflightIssue[];
}): Promise<RenderProductionFilesResult> {
  const response = await fetch(`${API_BASE_URL}/render-sheet`, {
    method: "POST",
    body: buildProductionFormData({ assetFiles, document, preflightIssues }),
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
  document,
  preflightIssues,
}: {
  assetFiles: Record<string, File>;
  document: SheetDocument;
  preflightIssues: PreflightIssue[];
}): Promise<SubmitProjectForReviewResult> {
  const response = await fetch(`${API_BASE_URL}/submit-project`, {
    method: "POST",
    body: buildProductionFormData({ assetFiles, document, preflightIssues }),
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
  document,
  preflightIssues,
}: {
  assetFiles: Record<string, File>;
  document: SheetDocument;
  preflightIssues: PreflightIssue[];
}) {
  const formData = new FormData();
  const manifest = buildExportBundleManifest({
    document,
    exportedAt: new Date().toISOString(),
    preflightIssues,
  });

  formData.append("manifest", JSON.stringify(manifest));

  for (const asset of document.assets) {
    const file = assetFiles[asset.id];

    if (file) {
      formData.append("assets", file, asset.fileName);
    }
  }

  return formData;
}
