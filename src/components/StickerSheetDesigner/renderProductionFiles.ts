import { API_BASE_URL } from "../../config/appEnv";
import {
  buildExportBundleManifest,
  type ExportBundleCustomer,
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
  storage?: {
    files: Array<{
      contentType: string;
      key: string;
      path: string;
      publicUrl?: string;
      sizeBytes: number;
    }>;
    provider: "postgres+r2";
    status: "queued" | "stored" | "skipped" | "failed";
    warnings?: string[];
  };
  files: {
    projectJson: string;
    orderJson?: string;
    previewPng: string;
    printPdf: string;
    manifestJson?: string;
    assets: string;
  };
  email?: {
    status: "not-configured" | "queued" | "sent" | "failed";
    message?: string;
  };
}

export async function renderProductionFiles({
  assetFiles,
  customer,
  customerNote,
  document,
  preflightIssues,
}: {
  assetFiles: Record<string, File>;
  customer?: ExportBundleCustomer;
  customerNote?: string;
  document: SheetDocument;
  preflightIssues: PreflightIssue[];
}): Promise<RenderProductionFilesResult> {
  const response = await fetch(`${API_BASE_URL}/render-sheet`, {
    method: "POST",
    body: buildProductionFormData({
      assetFiles,
      customer,
      customerNote,
      document,
      preflightIssues,
    }),
  });
  const payload = (await readResponseJson(response)) as
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
  customer,
  customerNote,
  document,
  preflightIssues,
}: {
  assetFiles: Record<string, File>;
  customer?: ExportBundleCustomer;
  customerNote?: string;
  document: SheetDocument;
  preflightIssues: PreflightIssue[];
}): Promise<SubmitProjectForReviewResult> {
  const response = await fetch(`${API_BASE_URL}/submit-project`, {
    method: "POST",
    body: buildProductionFormData({
      assetFiles,
      customer,
      customerNote,
      document,
      preflightIssues,
    }),
  });
  const payload = (await readResponseJson(response)) as
    | SubmitProjectForReviewResult
    | { error?: string };

  if (!response.ok) {
    throw new Error(
      "error" in payload && payload.error
        ? payload.error
        : "Project submission failed."
    );
  }

  if (!isSubmitProjectForReviewResult(payload)) {
    throw new Error(
      "Project submission could not be confirmed. Please try again.",
    );
  }

  return payload;
}

async function readResponseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function isSubmitProjectForReviewResult(
  payload: SubmitProjectForReviewResult | { error?: string },
): payload is SubmitProjectForReviewResult {
  return (
    typeof (payload as SubmitProjectForReviewResult).projectId === "string" &&
    (payload as SubmitProjectForReviewResult).projectId.length > 0 &&
    (payload as SubmitProjectForReviewResult).status === "submitted" &&
    typeof (payload as SubmitProjectForReviewResult).files?.assets ===
      "string" &&
    typeof (payload as SubmitProjectForReviewResult).files?.previewPng ===
      "string" &&
    typeof (payload as SubmitProjectForReviewResult).files?.printPdf ===
      "string" &&
    typeof (payload as SubmitProjectForReviewResult).files?.projectJson ===
      "string"
  );
}

function buildProductionFormData({
  assetFiles,
  customer,
  customerNote,
  document,
  preflightIssues,
}: {
  assetFiles: Record<string, File>;
  customer?: ExportBundleCustomer;
  customerNote?: string;
  document: SheetDocument;
  preflightIssues: PreflightIssue[];
}) {
  const formData = new FormData();
  const productionDocument = createProductionDocument(document);
  const manifest = buildExportBundleManifest({
    customer,
    customerNote,
    document: productionDocument,
    exportedAt: new Date().toISOString(),
    preflightIssues,
  });

  formData.append("manifest", JSON.stringify(manifest));

  for (const asset of productionDocument.assets) {
    const file = getProductionAssetFile(assetFiles, asset);

    if (!file) {
      throw new Error(
        `Missing original artwork for ${asset.fileName}. Re-upload this artwork before submitting or exporting a proof.`
      );
    }

    formData.append("assets", file, asset.fileName);
  }

  return formData;
}

function createProductionDocument(document: SheetDocument): SheetDocument {
  const placedAssetIds = new Set(document.items.map((item) => item.assetId));

  return {
    ...document,
    assets: document.assets.filter((asset) => placedAssetIds.has(asset.id)),
  };
}

function getProductionAssetFile(
  assetFiles: Record<string, File>,
  asset: SheetDocument["assets"][number]
): File | null {
  return (
    assetFiles[asset.id] ??
    dataUrlToFile(asset.sourceUrl, asset.fileName, asset.fileType)
  );
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
