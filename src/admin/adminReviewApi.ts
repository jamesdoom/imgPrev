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
  review: AdminProjectReview;
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
  assetFiles?: AdminReviewProjectFile[];
}

export interface AdminReviewProjectFile {
  fileName: string;
  path: string;
  sizeBytes?: number;
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

export type AdminProjectReviewStatus =
  | "submitted"
  | "approved"
  | "rejected"
  | "changes-requested";

export interface AdminProjectReview {
  status: AdminProjectReviewStatus;
  updatedAt: string;
  history: AdminProjectReviewEvent[];
}

export interface AdminProjectReviewEvent {
  status: AdminProjectReviewStatus;
  note: string;
  reviewer: string;
  reviewedAt: string;
}

export interface UpdateAdminProjectReviewInput {
  note: string;
  reviewer?: string;
  status: Exclude<AdminProjectReviewStatus, "submitted">;
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

export async function updateAdminProjectReview(
  projectId: string,
  input: UpdateAdminProjectReviewInput
): Promise<AdminReviewProjectDetail> {
  const payload = await requestJson<{ project?: AdminReviewProjectDetail }>(
    `/admin/projects/${encodeURIComponent(projectId)}/review`,
    "Could not update project review.",
    {
      body: JSON.stringify(input),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PATCH",
    }
  );

  if (!payload.project) {
    throw new Error("Project review was not returned.");
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
  return requestJson(path, fallbackMessage);
}

async function requestJson<T extends object>(
  path: string,
  fallbackMessage: string,
  init?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = init ? await fetch(url, init) : await fetch(url);
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
