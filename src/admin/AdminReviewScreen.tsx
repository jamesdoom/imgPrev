import { useEffect, useMemo, useState } from "react";
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import {
  fetchAdminProjectDetail,
  fetchAdminProjects,
  getAdminFileUrl,
  updateAdminProjectReview,
  type AdminProjectReviewStatus,
  type AdminReviewProjectDetail,
  type AdminReviewProjectFiles,
  type AdminReviewProjectSummary,
} from "./adminReviewApi";
import type { SheetBackground } from "../domain/print";

type LoadState = "idle" | "loading" | "error" | "ready";

export default function AdminReviewScreen() {
  const [projects, setProjects] = useState<AdminReviewProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [selectedProject, setSelectedProject] =
    useState<AdminReviewProjectDetail | null>(null);
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [savingReviewStatus, setSavingReviewStatus] = useState<
    Exclude<AdminProjectReviewStatus, "submitted"> | null
  >(null);

  const loadProjects = async () => {
    setListState("loading");
    setListError(null);

    try {
      const nextProjects = await fetchAdminProjects();

      setProjects(nextProjects);
      setListState("ready");
      setSelectedProjectId((currentProjectId) => {
        if (
          currentProjectId &&
          nextProjects.some((project) => project.projectId === currentProjectId)
        ) {
          return currentProjectId;
        }

        return nextProjects[0]?.projectId ?? null;
      });
    } catch (error) {
      setListState("error");
      setListError(
        error instanceof Error ? error.message : "Could not load submissions."
      );
    }
  };

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    let didCancel = false;

    if (!selectedProjectId) {
      setSelectedProject(null);
      setDetailState("idle");
      setReviewNote("");
      setReviewError(null);
      return;
    }

    setDetailState("loading");
    setDetailError(null);
    setReviewNote("");
    setReviewError(null);

    void fetchAdminProjectDetail(selectedProjectId)
      .then((project) => {
        if (!didCancel) {
          setSelectedProject(project);
          setDetailState("ready");
        }
      })
      .catch((error) => {
        if (!didCancel) {
          setSelectedProject(null);
          setDetailState("error");
          setDetailError(
            error instanceof Error
              ? error.message
              : "Could not load project details."
          );
        }
      });

    return () => {
      didCancel = true;
    };
  }, [selectedProjectId]);

  const handleReviewUpdate = async (
    status: Exclude<AdminProjectReviewStatus, "submitted">
  ) => {
    if (!selectedProjectId) {
      return;
    }

    setSavingReviewStatus(status);
    setReviewError(null);

    try {
      const updatedProject = await updateAdminProjectReview(selectedProjectId, {
        status,
        note: reviewNote,
      });

      setSelectedProject(updatedProject);
      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.projectId === updatedProject.projectId
            ? updatedProject
            : project
        )
      );
      setReviewNote("");
    } catch (error) {
      setReviewError(
        error instanceof Error
          ? error.message
          : "Could not update project review."
      );
    } finally {
      setSavingReviewStatus(null);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-950">
      <header className="border-b border-neutral-300 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-normal">
              Admin review
            </h1>
            <p className="text-xs text-neutral-500">
              {projects.length} submitted{" "}
              {projects.length === 1 ? "project" : "projects"}
            </p>
          </div>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded border border-neutral-300 bg-white px-3 text-sm font-medium hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={listState === "loading"}
            type="button"
            onClick={() => void loadProjects()}
          >
            <ArrowPathIcon className="h-5 w-5" />
            Refresh
          </button>
        </div>
      </header>

      <main className="grid min-h-[calc(100vh-73px)] grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)]">
        <section className="border-b border-neutral-300 bg-white lg:border-b-0 lg:border-r">
          <div className="flex h-12 items-center border-b border-neutral-200 px-4">
            <h2 className="text-sm font-semibold">Submissions</h2>
          </div>
          <SubmissionList
            error={listError}
            projects={projects}
            selectedProjectId={selectedProjectId}
            state={listState}
            onSelect={setSelectedProjectId}
            onRetry={() => void loadProjects()}
          />
        </section>

        <section className="min-w-0">
          <ProjectDetail
            error={detailError}
            project={selectedProject}
            reviewError={reviewError}
            reviewNote={reviewNote}
            savingReviewStatus={savingReviewStatus}
            state={detailState}
            onChangeReviewNote={setReviewNote}
            onUpdateReview={handleReviewUpdate}
          />
        </section>
      </main>
    </div>
  );
}

function SubmissionList({
  error,
  projects,
  selectedProjectId,
  state,
  onRetry,
  onSelect,
}: {
  error: string | null;
  projects: AdminReviewProjectSummary[];
  selectedProjectId: string | null;
  state: LoadState;
  onRetry: () => void;
  onSelect: (projectId: string) => void;
}) {
  if (state === "loading" && projects.length === 0) {
    return <StatusBlock title="Loading submissions..." />;
  }

  if (state === "error") {
    return (
      <StatusBlock
        actionLabel="Retry"
        title={error ?? "Could not load submissions."}
        tone="error"
        onAction={onRetry}
      />
    );
  }

  if (projects.length === 0) {
    return <StatusBlock title="No submitted projects found." />;
  }

  return (
    <div className="divide-y divide-neutral-200">
      {projects.map((project) => (
        <button
          key={project.projectId}
          className={`block w-full px-4 py-3 text-left hover:bg-neutral-50 ${
            project.projectId === selectedProjectId
              ? "bg-teal-50 ring-1 ring-inset ring-teal-700"
              : "bg-white"
          }`}
          type="button"
          onClick={() => onSelect(project.projectId)}
        >
          <span className="block truncate text-sm font-semibold">
            {project.projectId}
          </span>
          <span className="mt-1 block text-xs text-neutral-500">
            {formatDateTime(project.submittedAt)}
          </span>
          <span className="mt-2 block">
            <ReviewStatusBadge status={project.review.status} />
          </span>
          <span className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-700 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <Metric label="Sheet" value={formatSheet(project.sheet)} />
            <Metric label="Assets" value={project.counts.assets} />
            <Metric label="Decals" value={project.counts.items} />
            <Metric
              label="Files"
              value={`${countAvailableFiles(project.files)}/4`}
            />
          </span>
        </button>
      ))}
    </div>
  );
}

function ProjectDetail({
  error,
  project,
  reviewError,
  reviewNote,
  savingReviewStatus,
  state,
  onChangeReviewNote,
  onUpdateReview,
}: {
  error: string | null;
  project: AdminReviewProjectDetail | null;
  reviewError: string | null;
  reviewNote: string;
  savingReviewStatus: Exclude<AdminProjectReviewStatus, "submitted"> | null;
  state: LoadState;
  onChangeReviewNote: (note: string) => void;
  onUpdateReview: (
    status: Exclude<AdminProjectReviewStatus, "submitted">
  ) => void;
}) {
  const metadata = useMemo(() => {
    if (!project) {
      return null;
    }

    const background = project.manifest.document?.settings?.background;
    const preflight = project.manifest.preflight;
    const errorCount = preflight?.errorCount ?? 0;
    const warningCount = preflight?.warningCount ?? 0;

    return {
      background: formatBackground(background),
      issueCount: errorCount + warningCount,
      errorCount,
      warningCount,
    };
  }, [project]);

  if (state === "idle") {
    return <StatusBlock title="Select a submitted project." />;
  }

  if (state === "loading") {
    return <StatusBlock title="Loading project details..." />;
  }

  if (state === "error") {
    return (
      <StatusBlock
        title={error ?? "Could not load project details."}
        tone="error"
      />
    );
  }

  if (!project || !metadata) {
    return <StatusBlock title="Project details are unavailable." tone="error" />;
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 border-b border-neutral-300 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">
            {project.projectId}
          </h2>
          <p className="text-sm text-neutral-500">
            Submitted {formatDateTime(project.submittedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReviewStatusBadge status={project.review.status} />
          <PreflightBadge
            errorCount={metadata.errorCount}
            issueCount={metadata.issueCount}
            warningCount={metadata.warningCount}
          />
        </div>
      </div>

      {project.files.previewPng && (
        <div className="overflow-hidden rounded border border-neutral-300 bg-white">
          <img
            alt="Submitted sheet preview"
            className="max-h-[440px] w-full bg-neutral-50 object-contain"
            src={getAdminFileUrl(project.files.previewPng)}
          />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded border border-neutral-300 bg-white">
          <SectionTitle title="Production metadata" />
          <dl className="grid grid-cols-2 gap-px bg-neutral-200 text-sm sm:grid-cols-3">
            <MetadataItem label="Sheet" value={formatSheet(project.sheet)} />
            <MetadataItem label="DPI" value={project.sheet.dpi ?? "Unknown"} />
            <MetadataItem label="Background" value={metadata.background} />
            <MetadataItem
              label="Review"
              value={formatReviewStatus(project.review.status)}
            />
            <MetadataItem label="Preflight issues" value={metadata.issueCount} />
            <MetadataItem label="Assets" value={project.counts.assets} />
            <MetadataItem label="Decals" value={project.counts.items} />
          </dl>
        </div>

        <div className="rounded border border-neutral-300 bg-white">
          <SectionTitle title="Export files" />
          <FileLinks files={project.files} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded border border-neutral-300 bg-white">
          <SectionTitle title="Review decision" />
          <ReviewDecisionPanel
            note={reviewNote}
            savingStatus={savingReviewStatus}
            error={reviewError}
            onChangeNote={onChangeReviewNote}
            onUpdateReview={onUpdateReview}
          />
        </div>

        <div className="rounded border border-neutral-300 bg-white">
          <SectionTitle title="Review history" />
          <ReviewHistory project={project} />
        </div>
      </div>

      {project.manifest.preflight?.issues?.length ? (
        <div className="rounded border border-neutral-300 bg-white">
          <SectionTitle title="Preflight issues" />
          <div className="divide-y divide-neutral-200">
            {project.manifest.preflight.issues.map((issue) => (
              <div key={issue.id} className="p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      issue.severity === "error"
                        ? "bg-red-600"
                        : "bg-amber-500"
                    }`}
                  />
                  <span className="font-semibold capitalize">
                    {issue.severity}
                  </span>
                  <span className="text-xs text-neutral-500">{issue.code}</span>
                </div>
                <p className="mt-1 text-neutral-700">{issue.message}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReviewDecisionPanel({
  error,
  note,
  savingStatus,
  onChangeNote,
  onUpdateReview,
}: {
  error: string | null;
  note: string;
  savingStatus: Exclude<AdminProjectReviewStatus, "submitted"> | null;
  onChangeNote: (note: string) => void;
  onUpdateReview: (
    status: Exclude<AdminProjectReviewStatus, "submitted">
  ) => void;
}) {
  const isSaving = savingStatus !== null;

  return (
    <div className="space-y-3 p-3">
      <label className="block text-xs font-semibold uppercase text-neutral-500">
        Note
        <textarea
          className="mt-1 min-h-24 w-full resize-y rounded border border-neutral-300 px-3 py-2 text-sm font-normal normal-case text-neutral-950"
          maxLength={1000}
          placeholder="Decision note"
          value={note}
          onChange={(event) => onChangeNote(event.target.value)}
        />
      </label>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        <ReviewActionButton
          disabled={isSaving}
          label={savingStatus === "approved" ? "Saving..." : "Approve"}
          tone="approve"
          onClick={() => onUpdateReview("approved")}
        />
        <ReviewActionButton
          disabled={isSaving}
          label={
            savingStatus === "changes-requested"
              ? "Saving..."
              : "Needs changes"
          }
          tone="changes"
          onClick={() => onUpdateReview("changes-requested")}
        />
        <ReviewActionButton
          disabled={isSaving}
          label={savingStatus === "rejected" ? "Saving..." : "Reject"}
          tone="reject"
          onClick={() => onUpdateReview("rejected")}
        />
      </div>
    </div>
  );
}

function ReviewActionButton({
  disabled,
  label,
  tone,
  onClick,
}: {
  disabled: boolean;
  label: string;
  tone: "approve" | "changes" | "reject";
  onClick: () => void;
}) {
  const iconClassName = "h-5 w-5";
  const className =
    tone === "approve"
      ? "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800"
      : tone === "changes"
        ? "border-amber-500 bg-amber-50 text-amber-950 hover:bg-amber-100"
        : "border-red-700 bg-red-700 text-white hover:bg-red-800";

  return (
    <button
      className={`inline-flex h-10 items-center justify-center gap-2 rounded border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-200 disabled:text-neutral-500 ${className}`}
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      {tone === "approve" ? (
        <CheckCircleIcon className={iconClassName} />
      ) : tone === "changes" ? (
        <ExclamationTriangleIcon className={iconClassName} />
      ) : (
        <XCircleIcon className={iconClassName} />
      )}
      {label}
    </button>
  );
}

function ReviewHistory({ project }: { project: AdminReviewProjectDetail }) {
  if (project.review.history.length === 0) {
    return (
      <div className="p-3 text-sm text-neutral-500">
        No review decisions yet.
      </div>
    );
  }

  return (
    <div className="divide-y divide-neutral-200">
      {project.review.history.map((event) => (
        <div key={`${event.reviewedAt}-${event.status}`} className="p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <ReviewStatusBadge status={event.status} />
            <span className="text-xs text-neutral-500">
              {formatDateTime(event.reviewedAt)}
            </span>
          </div>
          {event.note && <p className="mt-2 text-neutral-800">{event.note}</p>}
          <p className="mt-1 text-xs text-neutral-500">{event.reviewer}</p>
        </div>
      ))}
    </div>
  );
}

function FileLinks({ files }: { files: AdminReviewProjectFiles }) {
  const links = [
    ["project.json", files.projectJson],
    ["preview.png", files.previewPng],
    ["print.pdf", files.printPdf],
    ["manifest.json", files.manifestJson],
  ] as const;

  return (
    <div className="divide-y divide-neutral-200">
      {links.map(([label, filePath]) => (
        <div
          key={label}
          className="flex min-h-12 items-center justify-between gap-3 px-3 py-2"
        >
          <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium">
            <DocumentTextIcon className="h-5 w-5 shrink-0 text-neutral-500" />
            <span className="truncate">{label}</span>
          </span>
          {filePath ? (
            <a
              className="inline-flex h-8 items-center gap-1 rounded border border-neutral-300 bg-white px-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
              href={getAdminFileUrl(filePath)}
              rel="noreferrer"
              target="_blank"
            >
              Open
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </a>
          ) : (
            <span className="rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-500">
              Missing
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function PreflightBadge({
  errorCount,
  issueCount,
  warningCount,
}: {
  errorCount: number;
  issueCount: number;
  warningCount: number;
}) {
  if (issueCount === 0) {
    return (
      <span className="inline-flex h-9 items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-800">
        <CheckCircleIcon className="h-5 w-5" />
        No issues
      </span>
    );
  }

  return (
    <span className="inline-flex h-9 items-center gap-2 rounded border border-amber-300 bg-amber-50 px-3 text-sm font-medium text-amber-900">
      <ExclamationTriangleIcon className="h-5 w-5" />
      {errorCount} errors | {warningCount} warnings
    </span>
  );
}

function ReviewStatusBadge({ status }: { status: AdminProjectReviewStatus }) {
  const label = formatReviewStatus(status);

  if (status === "approved") {
    return (
      <span className="inline-flex h-8 items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-2 text-xs font-semibold text-emerald-800">
        <CheckCircleIcon className="h-4 w-4" />
        {label}
      </span>
    );
  }

  if (status === "rejected") {
    return (
      <span className="inline-flex h-8 items-center gap-2 rounded border border-red-200 bg-red-50 px-2 text-xs font-semibold text-red-800">
        <XCircleIcon className="h-4 w-4" />
        {label}
      </span>
    );
  }

  if (status === "changes-requested") {
    return (
      <span className="inline-flex h-8 items-center gap-2 rounded border border-amber-200 bg-amber-50 px-2 text-xs font-semibold text-amber-900">
        <ExclamationTriangleIcon className="h-4 w-4" />
        {label}
      </span>
    );
  }

  return (
    <span className="inline-flex h-8 items-center rounded border border-neutral-200 bg-neutral-50 px-2 text-xs font-semibold text-neutral-700">
      {label}
    </span>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex h-12 items-center border-b border-neutral-200 px-3">
      <h3 className="text-sm font-semibold">{title}</h3>
    </div>
  );
}

function MetadataItem({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="bg-white p-3">
      <dt className="text-xs font-semibold uppercase text-neutral-500">
        {label}
      </dt>
      <dd className="mt-1 break-words font-medium text-neutral-950">{value}</dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <span>
      <span className="block font-semibold text-neutral-950">{value}</span>
      <span className="block uppercase text-neutral-500">{label}</span>
    </span>
  );
}

function StatusBlock({
  actionLabel,
  title,
  tone = "neutral",
  onAction,
}: {
  actionLabel?: string;
  title: string;
  tone?: "neutral" | "error";
  onAction?: () => void;
}) {
  return (
    <div className="p-4">
      <div
        className={`rounded border p-4 text-sm ${
          tone === "error"
            ? "border-red-200 bg-red-50 text-red-900"
            : "border-dashed border-neutral-300 bg-white text-neutral-500"
        }`}
      >
        <p>{title}</p>
        {actionLabel && onAction && (
          <button
            className="mt-3 inline-flex h-9 items-center rounded border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
            type="button"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function countAvailableFiles(files: AdminReviewProjectFiles): number {
  return [
    files.projectJson,
    files.previewPng,
    files.printPdf,
    files.manifestJson,
  ].filter(Boolean).length;
}

function formatSheet(sheet: Partial<{ widthIn: number; heightIn: number }>) {
  if (typeof sheet.widthIn !== "number" || typeof sheet.heightIn !== "number") {
    return "Unknown";
  }

  return `${sheet.widthIn}" x ${sheet.heightIn}"`;
}

function formatDateTime(value: string) {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatReviewStatus(status: AdminProjectReviewStatus) {
  if (status === "changes-requested") {
    return "Needs changes";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatBackground(background: SheetBackground | undefined) {
  if (!background || typeof background !== "object") {
    return "Unknown";
  }

  if ("type" in background && background.type === "solid") {
    const color =
      "color" in background && typeof background.color === "string"
        ? background.color
        : "unknown";

    return `Solid ${color}`;
  }

  if ("type" in background && background.type === "transparent") {
    return "Transparent";
  }

  return "Unknown";
}
