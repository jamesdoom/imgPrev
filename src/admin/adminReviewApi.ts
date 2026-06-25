import { API_BASE_URL } from "../config/appEnv";
import type {
  PreflightIssue,
  SheetBackground,
  SheetDocument,
  SheetDocumentSheet,
} from "../domain/print";

export interface AdminReviewProjectSummary {
  projectId: string;
  submittedAt: string;
  sheet: Partial<SheetDocumentSheet>;
  counts: {
    assets: number;
    items: number;
  };
  files: AdminReviewProjectFiles;
}

export interface AdminReviewProjectDetail extends AdminReviewProjectSummary {
  manifest: AdminReviewManifest;
}

export interface AdminReviewProjectFiles {
  projectJson?: string;
  previewPng?: string;
  printPdf?: string;
  manifestJson?: string;
  assets?: string;
}

export interface AdminReviewManifest {
  document?: Partial<SheetDocument> & {
    settings?: {
      background?: SheetBackground;
    };
  };
  preflight?: {
    errorCount?: number;
    warningCount?: number;
    issues?: PreflightIssue[];
  };
}

export async function fetchAdminProjects(): Promise<
  AdminReviewProjectSummary[]
> {
  const payload = await getJson<{ projects?: AdminReviewProjectSummary[] }>(
    "/admin/projects",
    "Could not load submitted projects."
  );

  return Array.isArray(payload.projects) ? payload.projects : [];
}

export async function fetchAdminProjectDetail(
  projectId: string
): Promise<AdminReviewProjectDetail> {
  const payload = await getJson<{ project?: AdminReviewProjectDetail }>(
    `/admin/projects/${encodeURIComponent(projectId)}`,
    "Could not load project details."
  );

  if (!payload.project) {
    throw new Error("Project details were not returned.");
  }

  return payload.project;
}

export function getAdminFileUrl(filePath: string): string {
  if (/^https?:\/\//.test(filePath)) {
    return filePath;
  }

  return `${API_BASE_URL}${filePath}`;
}

async function getJson<T extends object>(
  path: string,
  fallbackMessage: string
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const payload = (await response.json().catch(() => ({}))) as
    | T
    | { error?: string };

  if (!response.ok) {
    throw new Error(
      "error" in payload && payload.error ? payload.error : fallbackMessage
    );
  }

  return payload as T;
}
