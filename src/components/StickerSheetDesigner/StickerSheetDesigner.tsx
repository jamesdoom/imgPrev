import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowDownTrayIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
  DocumentDuplicateIcon,
  ExclamationTriangleIcon,
  FolderOpenIcon,
  PhotoIcon,
  Squares2X2Icon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import {
  BASELINE_SHEET_SIZES,
  DEFAULT_SHEET_VIEW_STATE,
  buildExportBundleManifest,
  canExportProductionBundle,
  createSheetDocument,
  createSheetDocumentHistory,
  createSheetItemFromAsset,
  runPreflight,
  sheetDocumentHistoryReducer,
  sheetViewStateReducer,
  validateUploadCandidate,
  type SheetDocumentHistoryAction,
  type SheetDocumentHistoryState,
  type SheetAsset,
  type SheetDocument,
  type SheetItem,
  type SheetSizeId,
  type PreflightIssue,
} from "../../domain/print";
import {
  StickerSheetCanvas,
  type StickerSheetCanvasHandle,
} from "./StickerSheetCanvas";
import {
  renderProductionFiles,
  submitProjectForReview,
} from "./renderProductionFiles";

const PROJECT_ID = "local-sticker-sheet";
const LOCAL_PROJECT_STORAGE_KEY = "sticker-sheet-designer:autosave";

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createInitialDocument() {
  const savedDocument = loadSavedDocument();

  if (savedDocument) {
    return savedDocument;
  }

  return createSheetDocument({
    id: PROJECT_ID,
    sheetSizeId: "4x6",
    now: new Date().toISOString(),
  });
}

export default function StickerSheetDesigner() {
  const canvasRef = useRef<StickerSheetCanvasHandle>(null);
  const [assetFiles, setAssetFiles] = useState<Record<string, File>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedProjectId, setSubmittedProjectId] = useState<string | null>(
    null
  );
  const [history, dispatchDocument] = useReducer(
    (
      state: SheetDocumentHistoryState,
      action: SheetDocumentHistoryAction
    ) => sheetDocumentHistoryReducer(state, action),
    createInitialDocument(),
    createSheetDocumentHistory
  );
  const [viewState, dispatchView] = useReducer(
    sheetViewStateReducer,
    DEFAULT_SHEET_VIEW_STATE
  );
  const document = history.present;
  const selectedItem = document.items.find((item) =>
    viewState.selectedItemIds.includes(item.id)
  );
  const selectedAsset = selectedItem
    ? document.assets.find((asset) => asset.id === selectedItem.assetId)
    : undefined;
  const hasSelection = viewState.selectedItemIds.length > 0;
  const preflightIssues = useMemo(() => runPreflight(document), [document]);
  const preflightErrorCount = preflightIssues.filter(
    (issue) => issue.severity === "error"
  ).length;
  const preflightWarningCount =
    preflightIssues.length - preflightErrorCount;
  const canExport = canExportProductionBundle(preflightIssues);

  const assetCountText = useMemo(() => {
    if (document.assets.length === 1) {
      return "1 asset";
    }

    return `${document.assets.length} assets`;
  }, [document.assets.length]);

  useEffect(() => {
    saveDocumentLocally(document);
  }, [document]);

  const handleFiles = async (files: FileList | null) => {
    if (!files) {
      return;
    }

    for (const file of Array.from(files)) {
      const issues = validateUploadCandidate(file);

      if (issues.length > 0) {
        issues.forEach((issue) => toast.error(issue.message));
        continue;
      }

      const asset = await createAssetFromFile(file);
      dispatchDocument({
        type: "asset/add",
        asset,
        now: new Date().toISOString(),
      });
      setAssetFiles((current) => ({
        ...current,
        [asset.id]: file,
      }));
      dispatchView({
        type: "selection/select-asset",
        assetId: asset.id,
      });
    }
  };

  const placeAsset = (asset: SheetAsset) => {
    const item = createSheetItemFromAsset({
      id: createId("item"),
      asset,
      document,
    });

    dispatchDocument({
      type: "item/place",
      item,
      now: new Date().toISOString(),
    });
    dispatchView({
      type: "selection/select-item",
      itemId: item.id,
    });
  };

  const duplicateSelectedItem = () => {
    if (!selectedItem) {
      return;
    }

    const newItemId = createId("item");

    dispatchDocument({
      type: "item/duplicate",
      itemId: selectedItem.id,
      newItemId,
      now: new Date().toISOString(),
    });
    dispatchView({
      type: "selection/select-item",
      itemId: newItemId,
    });
  };

  const removeSelectedItems = () => {
    viewState.selectedItemIds.forEach((itemId) => {
      dispatchDocument({
        type: "item/remove",
        itemId,
        now: new Date().toISOString(),
      });
    });
    dispatchView({ type: "selection/clear" });
  };

  const updateSelectedItem = (patch: Partial<Omit<SheetItem, "id">>) => {
    if (!selectedItem) {
      return;
    }

    dispatchDocument({
      type: "item/update",
      itemId: selectedItem.id,
      patch,
      now: new Date().toISOString(),
    });
  };

  const createManifestJson = () =>
    JSON.stringify(
      buildExportBundleManifest({
        document,
        exportedAt: new Date().toISOString(),
        preflightIssues,
      }),
      null,
      2
    );

  const downloadProjectJson = () => {
    downloadTextFile(
      "project.json",
      createManifestJson(),
      "application/json"
    );
    toast.success("Project JSON downloaded");
  };

  const downloadPreviewPng = () => {
    const dataUrl = canvasRef.current?.exportPreviewPng();

    if (!dataUrl) {
      toast.error("Preview export is not ready yet.");
      return;
    }

    downloadDataUrl("preview.png", dataUrl);
    toast.success("Proof PNG downloaded");
  };

  const downloadAvailableBundleFiles = async () => {
    if (!canExport) {
      toast.error("Resolve preflight errors before exporting.");
      return;
    }

    setIsExporting(true);

    try {
      const renderedFiles = await renderProductionFiles({
        assetFiles,
        document,
        preflightIssues,
      });

      downloadTextFile("project.json", createManifestJson(), "application/json");
      downloadBase64File(
        "preview.png",
        renderedFiles.previewPngBase64,
        "image/png"
      );
      downloadBase64File(
        "print.pdf",
        renderedFiles.printPdfBase64,
        "application/pdf"
      );
      toast.success("Production files downloaded");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Production export failed."
      );
    } finally {
      setIsExporting(false);
    }
  };

  const submitForReview = async () => {
    if (!canExport) {
      toast.error("Resolve preflight errors before submitting.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await submitProjectForReview({
        assetFiles,
        document,
        preflightIssues,
      });

      setSubmittedProjectId(result.projectId);
      toast.success(`Submitted ${result.projectId}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Project submission failed."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const importProjectJson = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    try {
      const loadedDocument = readDocumentFromProjectJson(await file.text());

      dispatchDocument({
        type: "history/reset",
        document: loadedDocument,
      });
      setAssetFiles({});
      setSubmittedProjectId(null);
      dispatchView({ type: "selection/clear" });
      toast.success("Project JSON loaded");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load project JSON."
      );
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-neutral-100 text-neutral-950 lg:h-screen">
      <header className="flex flex-col gap-3 border-b border-neutral-300 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:min-h-16 lg:px-5 lg:py-0">
        <div>
          <h1 className="text-lg font-semibold tracking-normal">
            Custom decal sheet
          </h1>
          <p className="text-xs text-neutral-500">
            {document.sheet.widthIn}" x {document.sheet.heightIn}" at{" "}
            {document.sheet.dpi} DPI | {assetCountText} | Autosaved
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PreflightBadge
            errorCount={preflightErrorCount}
            warningCount={preflightWarningCount}
          />
          <IconButton
            label="Undo"
            disabled={history.past.length === 0}
            onClick={() => dispatchDocument({ type: "history/undo" })}
          >
            <ArrowUturnLeftIcon className="h-5 w-5" />
          </IconButton>
          <IconButton
            label="Redo"
            disabled={history.future.length === 0}
            onClick={() => dispatchDocument({ type: "history/redo" })}
          >
            <ArrowUturnRightIcon className="h-5 w-5" />
          </IconButton>
          <div className="mx-1 h-7 w-px bg-neutral-300" />
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded border border-neutral-300 bg-white px-3 text-sm font-medium hover:bg-neutral-50">
            <PhotoIcon className="h-5 w-5" />
            Upload
            <input
              className="sr-only"
              type="file"
              multiple
              accept=".png,.jpg,.jpeg,.webp,.svg,.pdf,image/png,image/jpeg,image/webp,image/svg+xml,application/pdf"
              onChange={(event) => {
                void handleFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
        <aside className="border-b border-neutral-300 bg-white lg:min-h-0 lg:border-b-0 lg:border-r">
          <PanelTitle title="Sheet" />
          <div className="space-y-3 px-4 pb-4">
            <label className="block text-xs font-semibold uppercase text-neutral-500">
              Size
            </label>
            <select
              className="h-10 w-full rounded border border-neutral-300 bg-white px-3 text-sm"
              value={document.sheet.sizeId}
              onChange={(event) =>
                dispatchDocument({
                  type: "sheet/set-size",
                  sheetSizeId: event.target.value as SheetSizeId,
                  now: new Date().toISOString(),
                })
              }
            >
              {BASELINE_SHEET_SIZES.map((sheetSize) => (
                <option key={sheetSize.id} value={sheetSize.id}>
                  {sheetSize.label}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <ToggleButton
                active={document.settings.background.type === "transparent"}
                label="Transparent"
                onClick={() =>
                  dispatchDocument({
                    type: "settings/set-background",
                    background: { type: "transparent" },
                    now: new Date().toISOString(),
                  })
                }
              />
              <ToggleButton
                active={document.settings.background.type === "solid"}
                label="White"
                onClick={() =>
                  dispatchDocument({
                    type: "settings/set-background",
                    background: { type: "solid", color: "#ffffff" },
                    now: new Date().toISOString(),
                  })
                }
              />
            </div>
          </div>

          <PanelTitle title="Artwork" />
          <div className="flex min-h-0 flex-col gap-3 px-4 pb-4">
            {document.assets.length === 0 ? (
              <div className="rounded border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
                Upload PNG, JPG, WebP, SVG, or PDF artwork to start placing
                decals.
              </div>
            ) : (
              document.assets.map((asset) => (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  isSelected={asset.id === viewState.selectedAssetId}
                  onSelect={() =>
                    dispatchView({
                      type: "selection/select-asset",
                      assetId: asset.id,
                    })
                  }
                  onPlace={() => placeAsset(asset)}
                />
              ))
            )}
          </div>
        </aside>

        <main className="min-h-[480px] min-w-0 lg:min-h-0">
          <StickerSheetCanvas
            ref={canvasRef}
            document={document}
            viewState={viewState}
            onSelectItem={(itemId) =>
              dispatchView({ type: "selection/select-item", itemId })
            }
            onClearSelection={() => dispatchView({ type: "selection/clear" })}
            onUpdateItem={(itemId, patch) =>
              dispatchDocument({
                type: "item/update",
                itemId,
                patch,
                now: new Date().toISOString(),
              })
            }
          />
        </main>

        <aside className="border-t border-neutral-300 bg-white lg:min-h-0 lg:border-l lg:border-t-0">
          <PanelTitle title="View" />
          <div className="space-y-3 px-4 pb-4">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Zoom</span>
              <input
                className="w-36 accent-teal-700"
                type="range"
                min="0.4"
                max="1.5"
                step="0.1"
                value={viewState.zoom}
                onChange={(event) =>
                  dispatchView({
                    type: "viewport/set-zoom",
                    zoom: Number(event.target.value),
                  })
                }
              />
            </label>

            <OverlayToggle
              label="Grid"
              checked={viewState.showGrid}
              onChange={(visible) =>
                dispatchView({ type: "overlay/set-grid", visible })
              }
            />
            <OverlayToggle
              label="Bleed"
              checked={viewState.showBleed}
              onChange={(visible) =>
                dispatchView({ type: "overlay/set-bleed", visible })
              }
            />
            <OverlayToggle
              label="Safe area"
              checked={viewState.showSafeArea}
              onChange={(visible) =>
                dispatchView({ type: "overlay/set-safe-area", visible })
              }
            />
            <OverlayToggle
              label="Cutlines"
              checked={viewState.showCutlines}
              onChange={(visible) =>
                dispatchView({ type: "overlay/set-cutlines", visible })
              }
            />
          </div>

          <PanelTitle title="Preflight" />
          <PreflightPanel
            issues={preflightIssues}
            onSelectIssue={(issue) => {
              if (issue.itemId) {
                dispatchView({
                  type: "selection/select-item",
                  itemId: issue.itemId,
                });
                return;
              }

              if (issue.assetId) {
                dispatchView({
                  type: "selection/select-asset",
                  assetId: issue.assetId,
                });
              }
            }}
          />

          <PanelTitle title="Export" />
          <ExportPanel
            canExport={canExport}
            documentItemCount={document.items.length}
            isExporting={isExporting}
            isSubmitting={isSubmitting}
            submittedProjectId={submittedProjectId}
            onDownloadBundle={downloadAvailableBundleFiles}
            onDownloadPreviewPng={downloadPreviewPng}
            onDownloadProjectJson={downloadProjectJson}
            onImportProjectJson={importProjectJson}
            onSubmitForReview={submitForReview}
          />

          <PanelTitle title="Selection" />
          <div className="space-y-4 px-4 pb-4">
            {selectedItem ? (
              <>
                <div className="rounded border border-neutral-200 bg-neutral-50 p-3">
                  <p className="truncate text-sm font-medium">
                    {selectedAsset?.fileName ?? selectedItem.name}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {selectedItem.widthIn.toFixed(2)}" x{" "}
                    {selectedItem.heightIn.toFixed(2)}"
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label="X"
                    value={selectedItem.xIn}
                    onChange={(xIn) => updateSelectedItem({ xIn })}
                  />
                  <NumberField
                    label="Y"
                    value={selectedItem.yIn}
                    onChange={(yIn) => updateSelectedItem({ yIn })}
                  />
                  <NumberField
                    label="W"
                    min={0.1}
                    value={selectedItem.widthIn}
                    onChange={(widthIn) => updateSelectedItem({ widthIn })}
                  />
                  <NumberField
                    label="H"
                    min={0.1}
                    value={selectedItem.heightIn}
                    onChange={(heightIn) => updateSelectedItem({ heightIn })}
                  />
                </div>

                <NumberField
                  label="Rotation"
                  value={selectedItem.rotationDeg}
                  onChange={(rotationDeg) => updateSelectedItem({ rotationDeg })}
                />

                <div className="flex gap-2">
                  <button
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded border border-neutral-300 text-sm font-medium hover:bg-neutral-50"
                    type="button"
                    onClick={duplicateSelectedItem}
                  >
                    <DocumentDuplicateIcon className="h-5 w-5" />
                    Duplicate
                  </button>
                  <IconButton
                    label="Delete selected"
                    disabled={!hasSelection}
                    onClick={removeSelectedItems}
                  >
                    <TrashIcon className="h-5 w-5" />
                  </IconButton>
                </div>
              </>
            ) : (
              <div className="rounded border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
                Select a decal on the sheet to edit its size, position, and
                rotation.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ExportPanel({
  canExport,
  documentItemCount,
  isExporting,
  isSubmitting,
  submittedProjectId,
  onDownloadBundle,
  onDownloadPreviewPng,
  onDownloadProjectJson,
  onImportProjectJson,
  onSubmitForReview,
}: {
  canExport: boolean;
  documentItemCount: number;
  isExporting: boolean;
  isSubmitting: boolean;
  submittedProjectId: string | null;
  onDownloadBundle: () => void;
  onDownloadPreviewPng: () => void;
  onDownloadProjectJson: () => void;
  onImportProjectJson: (file: File | undefined) => void;
  onSubmitForReview: () => void;
}) {
  return (
    <div className="space-y-2 px-4 pb-4">
      <label className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded border border-neutral-300 bg-white text-sm font-medium hover:bg-neutral-50">
        <FolderOpenIcon className="h-5 w-5" />
        Load JSON
        <input
          className="sr-only"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            void onImportProjectJson(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>
      <button
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-neutral-300 bg-white text-sm font-medium hover:bg-neutral-50"
        type="button"
        onClick={onDownloadProjectJson}
      >
        <ArrowDownTrayIcon className="h-5 w-5" />
        Project JSON
      </button>
      <button
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-neutral-300 bg-white text-sm font-medium hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={documentItemCount === 0}
        type="button"
        onClick={onDownloadPreviewPng}
      >
        <ArrowDownTrayIcon className="h-5 w-5" />
        Proof PNG
      </button>
      <button
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-teal-700 bg-teal-700 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-200 disabled:text-neutral-500"
        disabled={!canExport || documentItemCount === 0 || isExporting}
        type="button"
        onClick={onDownloadBundle}
      >
        <ArrowDownTrayIcon className="h-5 w-5" />
        {isExporting ? "Rendering..." : "Export Files"}
      </button>
      <button
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-emerald-700 bg-emerald-700 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-200 disabled:text-neutral-500"
        disabled={!canExport || documentItemCount === 0 || isSubmitting}
        type="button"
        onClick={onSubmitForReview}
      >
        <CloudArrowUpIcon className="h-5 w-5" />
        {isSubmitting ? "Submitting..." : "Submit Review"}
      </button>
      {submittedProjectId && (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          Submitted as {submittedProjectId}
        </div>
      )}
    </div>
  );
}

function PreflightBadge({
  errorCount,
  warningCount,
}: {
  errorCount: number;
  warningCount: number;
}) {
  if (errorCount === 0 && warningCount === 0) {
    return (
      <span className="inline-flex h-10 items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-800">
        <CheckCircleIcon className="h-5 w-5" />
        Print ready
      </span>
    );
  }

  return (
    <span className="inline-flex h-10 items-center gap-2 rounded border border-amber-300 bg-amber-50 px-3 text-sm font-medium text-amber-900">
      <ExclamationTriangleIcon className="h-5 w-5" />
      {errorCount} errors | {warningCount} warnings
    </span>
  );
}

function PreflightPanel({
  issues,
  onSelectIssue,
}: {
  issues: PreflightIssue[];
  onSelectIssue: (issue: PreflightIssue) => void;
}) {
  if (issues.length === 0) {
    return (
      <div className="px-4 pb-4">
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          No print issues found.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-4 pb-4">
      {issues.map((issue) => (
        <button
          key={issue.id}
          className={`w-full rounded border p-3 text-left text-sm ${
            issue.severity === "error"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
          type="button"
          onClick={() => onSelectIssue(issue)}
        >
          <span className="block text-xs font-semibold uppercase">
            {issue.severity}
          </span>
          <span className="mt-1 block leading-snug">{issue.message}</span>
        </button>
      ))}
    </div>
  );
}

function PanelTitle({ title }: { title: string }) {
  return (
    <div className="flex h-12 items-center border-b border-neutral-200 px-4">
      <h2 className="text-sm font-semibold">{title}</h2>
    </div>
  );
}

function IconButton({
  children,
  disabled,
  label,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
      disabled={disabled}
      title={label}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ToggleButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`h-9 rounded border px-3 text-sm font-medium ${
        active
          ? "border-teal-700 bg-teal-50 text-teal-900"
          : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
      }`}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function AssetRow({
  asset,
  isSelected,
  onPlace,
  onSelect,
}: {
  asset: SheetAsset;
  isSelected: boolean;
  onPlace: () => void;
  onSelect: () => void;
}) {
  return (
    <div
      className={`grid w-full grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 rounded border p-2 text-left ${
        isSelected
          ? "border-teal-700 bg-teal-50"
          : "border-neutral-200 bg-white hover:bg-neutral-50"
      }`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <AssetThumbnail asset={asset} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">
          {asset.fileName}
        </span>
        <span className="block text-xs text-neutral-500">
          {asset.widthPx && asset.heightPx
            ? `${asset.widthPx} x ${asset.heightPx}px`
          : asset.fileType}
        </span>
      </span>
      <button
        className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold hover:bg-neutral-50"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onPlace();
        }}
      >
        Place
      </button>
    </div>
  );
}

function AssetThumbnail({ asset }: { asset: SheetAsset }) {
  if (asset.fileType.startsWith("image/")) {
    return (
      <img
        alt=""
        className="h-12 w-12 rounded border border-neutral-200 object-contain"
        src={asset.previewUrl ?? asset.sourceUrl}
      />
    );
  }

  return (
    <span className="inline-flex h-12 w-12 items-center justify-center rounded border border-neutral-200 bg-neutral-100">
      <Squares2X2Icon className="h-5 w-5 text-neutral-500" />
    </span>
  );
}

function OverlayToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <input
        className="h-4 w-4 accent-teal-700"
        checked={checked}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function NumberField({
  label,
  min,
  onChange,
  value,
}: {
  label: string;
  min?: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label className="block text-xs font-semibold uppercase text-neutral-500">
      {label}
      <input
        className="mt-1 h-9 w-full rounded border border-neutral-300 px-2 text-sm font-normal normal-case text-neutral-950"
        min={min}
        step="0.01"
        type="number"
        value={Number(value.toFixed(3))}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

async function createAssetFromFile(file: File): Promise<SheetAsset> {
  const sourceUrl = URL.createObjectURL(file);
  const dimensions = file.type.startsWith("image/")
    ? await loadImageDimensions(sourceUrl)
    : {};

  return {
    id: createId("asset"),
    sourceUrl,
    previewUrl: sourceUrl,
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
    uploadedAt: new Date().toISOString(),
    ...dimensions,
  };
}

async function loadImageDimensions(
  sourceUrl: string
): Promise<Pick<SheetAsset, "widthPx" | "heightPx">> {
  return new Promise((resolve) => {
    const image = new Image();

    image.onload = () => {
      resolve({
        widthPx: image.naturalWidth,
        heightPx: image.naturalHeight,
      });
    };
    image.onerror = () => resolve({});
    image.src = sourceUrl;
  });
}

function downloadTextFile(
  fileName: string,
  contents: string,
  mimeType: string
) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);

  downloadUrl(fileName, url);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadDataUrl(fileName: string, dataUrl: string) {
  downloadUrl(fileName, dataUrl);
}

function downloadBase64File(
  fileName: string,
  base64: string,
  mimeType: string
) {
  const bytes = Uint8Array.from(atob(base64), (character) =>
    character.charCodeAt(0)
  );
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);

  downloadUrl(fileName, url);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadUrl(fileName: string, url: string) {
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function saveDocumentLocally(document: SheetDocument) {
  try {
    localStorage.setItem(LOCAL_PROJECT_STORAGE_KEY, JSON.stringify(document));
  } catch {
    // Autosave is best-effort; export JSON remains the durable fallback.
  }
}

function loadSavedDocument(): SheetDocument | null {
  try {
    const savedDocument = localStorage.getItem(LOCAL_PROJECT_STORAGE_KEY);

    if (!savedDocument) {
      return null;
    }

    return readDocumentFromProjectJson(savedDocument);
  } catch {
    return null;
  }
}

function readDocumentFromProjectJson(contents: string): SheetDocument {
  const parsed = JSON.parse(contents) as unknown;
  const candidate =
    parsed && typeof parsed === "object" && "document" in parsed
      ? (parsed as { document: unknown }).document
      : parsed;

  if (!isSheetDocument(candidate)) {
    throw new Error("Project JSON does not contain a valid sheet document.");
  }

  return {
    ...candidate,
    updatedAt: new Date().toISOString(),
  };
}

function isSheetDocument(value: unknown): value is SheetDocument {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as SheetDocument;

  return (
    candidate.version === 1 &&
    typeof candidate.id === "string" &&
    !!candidate.sheet &&
    typeof candidate.sheet.widthIn === "number" &&
    typeof candidate.sheet.heightIn === "number" &&
    typeof candidate.sheet.dpi === "number" &&
    Array.isArray(candidate.assets) &&
    Array.isArray(candidate.items) &&
    !!candidate.settings
  );
}
