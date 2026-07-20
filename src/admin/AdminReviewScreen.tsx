import { useEffect, useMemo, useState } from "react";
import {
  ArrowPathIcon,
  ArrowDownTrayIcon,
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
  type AdminReviewEmailDelivery,
  type AdminReviewProjectFiles,
  type AdminReviewProjectSummary,
  type AdminReviewProductionStorage,
} from "./adminReviewApi";
import type { SheetBackground } from "../domain/print";

type LoadState = "idle" | "loading" | "error" | "ready";
const focusRingClass =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2";

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
  const [reviewerName, setReviewerName] = useState("");
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
      setReviewerName("");
      setReviewError(null);
      return;
    }

    setDetailState("loading");
    setDetailError(null);
    setReviewNote("");
    setReviewerName("");
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
        reviewer: reviewerName.trim() || undefined,
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
            className={`inline-flex h-10 items-center justify-center gap-2 rounded border border-neutral-300 bg-white px-3 text-sm font-medium hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 ${focusRingClass}`}
            disabled={listState === "loading"}
            type="button"
            onClick={() => void loadProjects()}
          >
            <ArrowPathIcon className="h-5 w-5" />
            Refresh
          </button>
        </div>
      </header>

      <main
        aria-label="Admin review workspace"
        className="grid min-h-[calc(100vh-73px)] grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)]"
      >
        <section
          aria-labelledby="admin-submissions-heading"
          className="border-b border-neutral-300 bg-white lg:border-b-0 lg:border-r"
        >
          <div className="flex h-12 items-center border-b border-neutral-200 px-4">
            <h2 id="admin-submissions-heading" className="text-sm font-semibold">
              Submissions
            </h2>
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

        <section aria-label="Submission detail" className="min-w-0">
          <ProjectDetail
            error={detailError}
            project={selectedProject}
            reviewError={reviewError}
            reviewNote={reviewNote}
            reviewerName={reviewerName}
            savingReviewStatus={savingReviewStatus}
            state={detailState}
            onChangeReviewNote={setReviewNote}
            onChangeReviewerName={setReviewerName}
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
        detail="The submissions list could not be refreshed. Check the backend connection and try again."
        title={error ?? "Could not load submissions."}
        tone="error"
        onAction={onRetry}
      />
    );
  }

  if (projects.length === 0) {
    return (
      <StatusBlock
        detail="Submit a print order from the customer editor, then refresh this list."
        title="No submitted projects found."
      />
    );
  }

  return (
    <div className="divide-y divide-neutral-200">
      {projects.map((project) => (
        <button
          key={project.projectId}
          className={`block w-full px-4 py-3 text-left hover:bg-neutral-50 ${focusRingClass} ${
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
              value={`${countAvailableFiles(project.files)}/5`}
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
  reviewerName,
  savingReviewStatus,
  state,
  onChangeReviewNote,
  onChangeReviewerName,
  onUpdateReview,
}: {
  error: string | null;
  project: AdminReviewProjectDetail | null;
  reviewError: string | null;
  reviewNote: string;
  reviewerName: string;
  savingReviewStatus: Exclude<AdminProjectReviewStatus, "submitted"> | null;
  state: LoadState;
  onChangeReviewNote: (note: string) => void;
  onChangeReviewerName: (reviewerName: string) => void;
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
        detail="The project may have been removed, or the backend may be unavailable. Refresh the submissions list and try again."
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

      <PrintHandoffPanel metadata={metadata} project={project} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          {project.files.previewPng && (
            <div className="overflow-hidden rounded border border-neutral-300 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold">Proof preview</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Visual reference only. Print from the PDF above.
                  </p>
                </div>
                <FileActionLinks
                  downloadLabel="Download PNG"
                  fileName="preview.png"
                  filePath={project.files.previewPng}
                  openLabel="Open full size"
                />
              </div>
              <img
                alt="Submitted sheet preview"
                className="max-h-[440px] w-full bg-neutral-50 object-contain"
                src={getAdminFileUrl(project.files.previewPng)}
              />
            </div>
          )}

          <div className="rounded border border-neutral-300 bg-white">
            <SectionTitle title="Review decision" />
            <ReviewDecisionPanel
              note={reviewNote}
              reviewerName={reviewerName}
              savingStatus={savingReviewStatus}
              error={reviewError}
              onChangeNote={onChangeReviewNote}
              onChangeReviewerName={onChangeReviewerName}
              onUpdateReview={onUpdateReview}
            />
          </div>
        </div>

        <div className="rounded border border-neutral-300 bg-white">
          <SectionTitle title="Status history" />
          <ReviewHistory project={project} submittedAt={project.submittedAt} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded border border-neutral-300 bg-white">
          <SectionTitle title="Technical details" />
          <dl className="grid grid-cols-2 gap-px bg-neutral-100 text-xs text-neutral-600 sm:grid-cols-3">
            <MetadataItem label="DPI" value={project.sheet.dpi ?? "Unknown"} />
            <MetadataItem label="Background" value={metadata.background} />
            <MetadataItem label="Assets" value={project.counts.assets} />
            <MetadataItem label="Preflight issues" value={metadata.issueCount} />
            <MetadataItem
              label="Storage"
              value={formatStorageStatus(project.storage?.status)}
            />
            <MetadataItem label="Project" value={project.projectId} />
          </dl>
        </div>

        <div className="rounded border border-neutral-300 bg-white">
          <SectionTitle title="Supporting files" />
          <FileLinks files={project.files} />
        </div>
      </div>

      <ProductionStoragePanel storage={project.storage} />
      <EmailDeliveryPanel email={project.email} />

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
  reviewerName,
  savingStatus,
  onChangeNote,
  onChangeReviewerName,
  onUpdateReview,
}: {
  error: string | null;
  note: string;
  reviewerName: string;
  savingStatus: Exclude<AdminProjectReviewStatus, "submitted"> | null;
  onChangeNote: (note: string) => void;
  onChangeReviewerName: (reviewerName: string) => void;
  onUpdateReview: (
    status: Exclude<AdminProjectReviewStatus, "submitted">
  ) => void;
}) {
  const isSaving = savingStatus !== null;

  return (
    <div className="space-y-3 p-3">
      <label className="block text-xs font-semibold uppercase text-neutral-500">
        Reviewer
        <input
          className={`mt-1 h-10 w-full rounded border border-neutral-300 px-3 text-sm font-normal normal-case text-neutral-950 ${focusRingClass}`}
          maxLength={80}
          placeholder="Admin reviewer"
          type="text"
          value={reviewerName}
          onChange={(event) => onChangeReviewerName(event.target.value)}
        />
      </label>
      <label className="block text-xs font-semibold uppercase text-neutral-500">
        Reviewer note
        <textarea
          className={`mt-1 min-h-24 w-full resize-y rounded border border-neutral-300 px-3 py-2 text-sm font-normal normal-case text-neutral-950 ${focusRingClass}`}
          maxLength={1000}
          placeholder="Decision note"
          value={note}
          onChange={(event) => onChangeNote(event.target.value)}
        />
      </label>

      {error && (
        <div
          className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900"
          role="alert"
        >
          <p className="font-semibold">Could not save review decision.</p>
          <p className="mt-1 leading-5">{error}</p>
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
      className={`inline-flex h-10 items-center justify-center gap-2 rounded border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-200 disabled:text-neutral-500 ${focusRingClass} ${className}`}
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

function ReviewHistory({
  project,
  submittedAt,
}: {
  project: AdminReviewProjectDetail;
  submittedAt: string;
}) {
  const lastEvent =
    project.review.history[project.review.history.length - 1];

  if (project.review.history.length === 0) {
    return (
      <div className="space-y-3 p-3 text-sm">
        <ReviewHistorySummary
          status={project.review.status}
          submittedAt={submittedAt}
          updatedAt={project.review.updatedAt}
        />
        <div className="rounded border border-dashed border-neutral-300 bg-neutral-50 p-3 text-neutral-600">
          No review decisions yet. The submission is waiting for an approve,
          reject, or needs changes decision.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 text-sm">
      <ReviewHistorySummary
        latestReviewer={lastEvent?.reviewer}
        status={project.review.status}
        submittedAt={submittedAt}
        updatedAt={project.review.updatedAt}
      />
      <ol className="space-y-2" aria-label="Review decisions, newest first">
        {[...project.review.history].reverse().map((event, index) => (
          <li
            key={`${event.reviewedAt}-${event.status}`}
            className="rounded border border-neutral-200 border-l-4 bg-white p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <ReviewStatusBadge status={event.status} />
                {index === 0 && (
                  <span className="rounded bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800">
                    Latest
                  </span>
                )}
              </div>
              <span className="rounded bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-600">
                Decision {project.review.history.length - index}
              </span>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              {formatDateTime(event.reviewedAt)} by{" "}
              <span className="font-semibold text-neutral-700">
                {event.reviewer}
              </span>
            </p>
            {event.note ? (
              <p className="mt-2 whitespace-pre-wrap rounded bg-neutral-50 p-2 text-neutral-800">
                {event.note}
              </p>
            ) : (
              <p className="mt-2 text-neutral-500">No note provided.</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ReviewHistorySummary({
  latestReviewer,
  status,
  submittedAt,
  updatedAt,
}: {
  latestReviewer?: string;
  status: AdminProjectReviewStatus;
  submittedAt: string;
  updatedAt: string;
}) {
  return (
    <dl className="grid gap-2 rounded border border-neutral-200 bg-neutral-50 p-3 text-xs sm:grid-cols-2">
      <div>
        <dt className="font-semibold uppercase text-neutral-500">
          Current status
        </dt>
        <dd className="mt-1">
          <ReviewStatusBadge status={status} />
        </dd>
      </div>
      <ReviewHistoryMetric
        label="Submitted"
        value={formatDateTime(submittedAt)}
      />
      <ReviewHistoryMetric
        label="Last updated"
        value={formatDateTime(updatedAt)}
      />
      <ReviewHistoryMetric
        label="Latest reviewer"
        value={latestReviewer ?? "Not reviewed yet"}
      />
    </dl>
  );
}

function PrintHandoffPanel({
  metadata,
  project,
}: {
  metadata: {
    errorCount: number;
    issueCount: number;
    warningCount: number;
  };
  project: AdminReviewProjectDetail;
}) {
  const files = project.files;
  const printPdf = files.printPdf;
  const hasPrintPdf = Boolean(printPdf);
  const hasPreview = Boolean(files.previewPng);
  const hasOrderRecord = Boolean(files.orderJson);
  const isReady = hasPrintPdf && hasPreview && hasOrderRecord;

  return (
    <section
      aria-labelledby="print-handoff-heading"
      className="overflow-hidden rounded border border-teal-700 bg-white shadow-sm"
    >
      <div className="grid gap-4 border-b border-teal-100 bg-teal-50 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
            Print handoff
          </p>
          <h3 id="print-handoff-heading" className="mt-1 text-2xl font-semibold">
            What do I print?
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-700">
            Print the production PDF. The preview is only a visual reference,
            and the JSON/original artwork files are supporting records.
          </p>
        </div>
        <span
          className={`inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded border px-3 text-sm font-semibold ${
            isReady
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {isReady ? (
            <CheckCircleIcon className="h-4 w-4" />
          ) : (
            <ExclamationTriangleIcon className="h-4 w-4" />
          )}
          {isReady ? "Ready for print review" : "Needs file review"}
        </span>
      </div>
      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(280px,420px)_minmax(0,1fr)]">
        <div className="rounded border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-sm font-semibold text-neutral-600">
            Primary print file
          </p>
          <p className="mt-2 text-xl font-semibold text-neutral-950">
            Print PDF
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            This is the file to send to production. It contains{" "}
            {project.counts.sheets ?? 1} numbered sheet
            {(project.counts.sheets ?? 1) === 1 ? "" : "s"}.
          </p>
          {printPdf ? (
            <div className="mt-4 flex flex-col gap-2">
              <a
                className={`inline-flex h-14 items-center justify-center gap-2 rounded bg-teal-700 px-5 text-base font-bold text-white shadow-sm hover:bg-teal-800 ${focusRingClass}`}
                href={getAdminFileUrl(printPdf)}
                rel="noreferrer"
                target="_blank"
              >
                Open print PDF
                <ArrowTopRightOnSquareIcon className="h-6 w-6" />
              </a>
              <a
                className={`inline-flex h-10 items-center justify-center gap-2 rounded border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 ${focusRingClass}`}
                download="print.pdf"
                href={getAdminFileUrl(printPdf)}
              >
                Download a copy
                <ArrowDownTrayIcon className="h-5 w-5" />
              </a>
            </div>
          ) : (
            <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              The print PDF is missing. Review the supporting files before
              sending this order to production.
            </div>
          )}
        </div>

        <dl className="grid gap-px overflow-hidden rounded border border-neutral-200 bg-neutral-200 text-sm sm:grid-cols-2 xl:grid-cols-3">
          <HandoffMetric
            label="Sheets"
            value={`${project.counts.sheets ?? 1} × ${formatSheet(project.sheet)}`}
          />
          <HandoffMetric label="Decals" value={project.counts.items} />
          <HandoffMetric
            label="Submitted"
            value={formatDateTime(project.submittedAt)}
          />
          <HandoffMetric
            label="Review status"
            value={formatReviewStatus(project.review.status)}
          />
          <HandoffMetric
            label="Preflight"
            value={
              metadata.issueCount === 0
                ? "No issues"
                : `${metadata.errorCount} errors | ${metadata.warningCount} warnings`
            }
          />
          <HandoffMetric
            label="Support files"
            value={
              isReady ? "PDF, preview, order record" : "Review missing files"
            }
          />
        </dl>
      </div>
    </section>
  );
}

function ProductionStoragePanel({
  storage,
}: {
  storage?: AdminReviewProductionStorage;
}) {
  const files = storage?.files ?? [];
  const isStored = storage?.status === "stored";
  const requiredFiles = [
    ["PDF", "print.pdf"],
    ["Preview", "preview.png"],
    ["Order record", "order.json"],
    ["Project record", "project.json"],
  ] as const;

  return (
    <section
      aria-labelledby="production-storage-heading"
      className="rounded border border-neutral-300 bg-white"
    >
      <div className="flex flex-col gap-2 border-b border-neutral-200 px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id="production-storage-heading" className="text-sm font-semibold">
            Production storage
          </h3>
          <p className="mt-1 text-sm text-neutral-600">
            Tracks the Postgres and R2 copy of the print package.
          </p>
        </div>
        <StorageStatusBadge storage={storage} />
      </div>
      <dl className="grid gap-px bg-neutral-200 text-sm sm:grid-cols-3">
        <div className="bg-white p-3">
          <dt className="text-xs font-semibold uppercase text-neutral-500">
            Provider
          </dt>
          <dd className="mt-2 font-medium text-neutral-900">
            {storage?.provider === "postgres+r2"
              ? "Postgres + R2"
              : "Not configured"}
          </dd>
        </div>
        <div className="bg-white p-3">
          <dt className="text-xs font-semibold uppercase text-neutral-500">
            Stored files
          </dt>
          <dd className="mt-2 font-medium text-neutral-900">
            {files.length} of 4 required
          </dd>
        </div>
        <div className="bg-white p-3">
          <dt className="text-xs font-semibold uppercase text-neutral-500">
            Status
          </dt>
          <dd className="mt-2 font-medium text-neutral-900">
            {formatStorageStatus(storage?.status)}
          </dd>
        </div>
      </dl>
      <dl className="grid gap-px bg-neutral-200 text-sm sm:grid-cols-4">
        {requiredFiles.map(([label, filePath]) => (
          <StorageFileStatusItem
            key={filePath}
            file={files.find((candidate) => candidate.path === filePath)}
            label={label}
          />
        ))}
      </dl>
      {storage?.warnings?.length ? (
        <div className="border-t border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="font-semibold">Storage warnings</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {storage.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {isStored && files.length > 0 ? (
        <div className="divide-y divide-neutral-200 border-t border-neutral-200">
          {files.map((file) => (
            <div
              key={file.key}
              className="flex min-h-12 flex-col gap-2 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="min-w-0">
                <span className="block font-medium text-neutral-900">
                  {file.path}
                </span>
                <span className="block break-all text-xs text-neutral-500">
                  {file.key} | {formatFileSize(file.sizeBytes)}
                </span>
              </span>
              {file.publicUrl ? (
                <a
                  className={`inline-flex h-8 shrink-0 items-center gap-1 rounded border border-neutral-300 bg-white px-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 ${focusRingClass}`}
                  href={file.publicUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open stored file
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function EmailDeliveryPanel({
  email,
}: {
  email?: AdminReviewEmailDelivery;
}) {
  const isSent = email?.status === "sent";
  const isFailed = email?.status === "failed";
  const statusLabel =
    email?.status === "sent"
      ? "Email sent"
      : email?.status === "queued"
        ? "Email queued"
        : email?.status === "failed"
          ? "Email failed"
          : "Email not configured";

  return (
    <section
      aria-labelledby="email-delivery-heading"
      className={`rounded border ${
        isSent
          ? "border-emerald-200 bg-emerald-50"
          : isFailed
            ? "border-red-200 bg-red-50"
            : "border-amber-200 bg-amber-50"
      }`}
    >
      <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 id="email-delivery-heading" className="text-sm font-semibold">
            Print-order email
          </h3>
          <p className="mt-1 text-sm text-neutral-700">
            {email?.message ??
              "No confirmed email delivery record is available for this order."}
          </p>
          {email?.recipient && (
            <p className="mt-1 text-xs text-neutral-600">
              Recipient: {email.recipient}
              {email.sentAt ? ` · Sent ${formatDateTime(email.sentAt)}` : ""}
            </p>
          )}
          {email?.error && (
            <p className="mt-1 text-xs font-medium text-red-800">
              Delivery error: {email.error}
            </p>
          )}
        </div>
        <span className="inline-flex h-8 shrink-0 items-center gap-2 rounded border border-current px-2 text-xs font-semibold">
          {isSent ? (
            <CheckCircleIcon className="h-4 w-4" />
          ) : isFailed ? (
            <XCircleIcon className="h-4 w-4" />
          ) : (
            <ExclamationTriangleIcon className="h-4 w-4" />
          )}
          {statusLabel}
        </span>
      </div>
    </section>
  );
}

function StorageStatusBadge({
  storage,
}: {
  storage?: AdminReviewProductionStorage;
}) {
  const status = storage?.status;

  if (status === "stored") {
    return (
      <span className="inline-flex h-8 shrink-0 items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-2 text-xs font-semibold text-emerald-800">
        <CheckCircleIcon className="h-4 w-4" />
        Production files stored
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className="inline-flex h-8 shrink-0 items-center gap-2 rounded border border-red-200 bg-red-50 px-2 text-xs font-semibold text-red-800">
        <XCircleIcon className="h-4 w-4" />
        Storage failed
      </span>
    );
  }

  return (
    <span className="inline-flex h-8 shrink-0 items-center gap-2 rounded border border-amber-200 bg-amber-50 px-2 text-xs font-semibold text-amber-900">
      <ExclamationTriangleIcon className="h-4 w-4" />
      {status === "queued" ? "Storage queued" : "Storage not confirmed"}
    </span>
  );
}

function StorageFileStatusItem({
  file,
  label,
}: {
  file?: AdminReviewProductionStorage["files"][number];
  label: string;
}) {
  return (
    <div className="bg-white p-3">
      <dt className="text-xs font-semibold uppercase text-neutral-500">
        {label}
      </dt>
      <dd
        className={`mt-2 inline-flex items-center gap-1 font-medium ${
          file ? "text-emerald-800" : "text-amber-900"
        }`}
      >
        {file ? (
          <CheckCircleIcon className="h-4 w-4" />
        ) : (
          <ExclamationTriangleIcon className="h-4 w-4" />
        )}
        {file ? "Stored" : "Missing"}
      </dd>
    </div>
  );
}

function HandoffMetric({
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
      <dd className="mt-2 break-words font-semibold text-neutral-950">
        {value}
      </dd>
    </div>
  );
}

function ReviewHistoryMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="font-semibold uppercase text-neutral-500">{label}</dt>
      <dd className="mt-1 font-medium text-neutral-900">{value}</dd>
    </div>
  );
}

function FileLinks({ files }: { files: AdminReviewProjectFiles }) {
  const links = [
    ["Print PDF", "print.pdf", files.printPdf, "Download PDF"],
    ["Proof preview", "preview.png", files.previewPng, "Download PNG"],
    ["Order record", "order.json", files.orderJson, "Download order"],
    ["Project JSON", "project.json", files.projectJson, "Download project"],
    ["Manifest", "manifest.json", files.manifestJson, "Download manifest"],
  ] as const;
  const assetFiles = files.assetFiles ?? [];
  const sheetPreviews = files.sheetPreviews ?? [];

  return (
    <div>
      <div className="divide-y divide-neutral-200">
        {links.map(([label, fileName, filePath, downloadLabel]) => (
          <div
            key={label}
            className="flex min-h-12 items-center justify-between gap-3 px-3 py-2"
          >
            <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium">
              <DocumentTextIcon className="h-5 w-5 shrink-0 text-neutral-500" />
              <span className="truncate">{label}</span>
            </span>
            {filePath ? (
              <FileActionLinks
                downloadLabel={downloadLabel}
                fileName={fileName}
                filePath={filePath}
              />
            ) : (
              <span className="rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-500">
                Missing
              </span>
            )}
          </div>
        ))}
      </div>
      {sheetPreviews.length > 0 && (
        <div className="border-t border-neutral-200">
          <div className="px-3 py-2 text-xs font-semibold uppercase text-neutral-500">
            Sheet previews
          </div>
          <div className="divide-y divide-neutral-200">
            {sheetPreviews.map((previewPath, index) => (
              <div
                key={previewPath}
                className="flex min-h-12 items-center justify-between gap-3 px-3 py-2"
              >
                <span className="text-sm font-medium">Sheet {index + 1}</span>
                <FileActionLinks
                  fileName={`preview-sheet-${index + 1}.png`}
                  filePath={previewPath}
                  downloadLabel={`Download Sheet ${index + 1}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="border-t border-neutral-200">
        <div className="px-3 py-2 text-xs font-semibold uppercase text-neutral-500">
          Original artwork
        </div>
        {assetFiles.length > 0 ? (
          <div className="divide-y divide-neutral-200">
            {assetFiles.map((assetFile) => (
              <div
                key={assetFile.path}
                className="flex min-h-12 items-center justify-between gap-3 px-3 py-2"
              >
                <span className="min-w-0 text-sm">
                  <span className="block truncate font-medium">
                    {assetFile.fileName}
                  </span>
                  {typeof assetFile.sizeBytes === "number" && (
                    <span className="block text-xs text-neutral-500">
                      {formatFileSize(assetFile.sizeBytes)}
                    </span>
                  )}
                </span>
                <FileActionLinks
                  fileName={assetFile.fileName}
                  filePath={assetFile.path}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="px-3 pb-3 text-sm text-neutral-500">
            No original asset files found.
          </div>
        )}
      </div>
    </div>
  );
}

function FileActionLinks({
  downloadLabel = "Download",
  fileName,
  filePath,
  openLabel = "Open",
}: {
  downloadLabel?: string;
  fileName: string;
  filePath: string;
  openLabel?: string;
}) {
  const url = getAdminFileUrl(filePath);

  return (
    <span className="flex shrink-0 items-center gap-2">
      <a
        className={`inline-flex h-8 items-center gap-1 rounded border border-neutral-300 bg-white px-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 ${focusRingClass}`}
        href={url}
        rel="noreferrer"
        target="_blank"
      >
        {openLabel}
        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
      </a>
      <a
        className={`inline-flex h-8 items-center gap-1 rounded border border-neutral-300 bg-white px-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 ${focusRingClass}`}
        download={fileName}
        href={url}
      >
        {downloadLabel}
        <ArrowDownTrayIcon className="h-4 w-4" />
      </a>
    </span>
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
    <div className="bg-neutral-50 p-3">
      <dt className="text-xs font-semibold uppercase text-neutral-500">
        {label}
      </dt>
      <dd className="mt-1 break-words font-medium text-neutral-700">{value}</dd>
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
  detail,
  title,
  tone = "neutral",
  onAction,
}: {
  actionLabel?: string;
  detail?: string;
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
        <p className="font-medium">{title}</p>
        {detail && <p className="mt-2 leading-5">{detail}</p>}
        {actionLabel && onAction && (
          <button
            className={`mt-3 inline-flex h-9 items-center rounded border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 hover:bg-neutral-50 ${focusRingClass}`}
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
    files.orderJson,
    files.previewPng,
    files.printPdf,
    files.manifestJson,
  ].filter(Boolean).length;
}

function formatFileSize(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
    return "Unknown size";
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
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

function formatStorageStatus(
  status: AdminReviewProductionStorage["status"] | undefined
) {
  if (!status) {
    return "Not reported";
  }

  if (status === "stored") {
    return "Stored";
  }

  if (status === "queued") {
    return "Queued";
  }

  if (status === "skipped") {
    return "Skipped";
  }

  return "Failed";
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
