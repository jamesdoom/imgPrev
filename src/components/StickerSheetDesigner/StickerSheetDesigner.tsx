// src\components\StickerSheetDesigner\StickerSheetDesigner.tsx
import {
  useCallback,
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
  ArrowsRightLeftIcon,
  ArrowsUpDownIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
  DocumentDuplicateIcon,
  ExclamationTriangleIcon,
  FolderOpenIcon,
  PhotoIcon,
  SparklesIcon,
  Squares2X2Icon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import {
  autoArrangeSheetItems,
  BASELINE_SHEET_SIZES,
  DEFAULT_SHEET_VIEW_STATE,
  buildExportBundleManifest,
  buildProofGuidance,
  canExportProductionBundle,
  createSheetDocument,
  createSheetDocumentHistory,
  createSheetItemFromAsset,
  estimateSheetOrder,
  formatCurrency,
  runPreflight,
  sheetDocumentHistoryReducer,
  sheetViewStateReducer,
  STICKER_SHEET_MVP_PROFILE,
  validateUploadCandidate,
  type SheetDocumentHistoryAction,
  type SheetDocumentHistoryState,
  type SheetAsset,
  type SheetDocument,
  type SheetItem,
  type SheetSizeId,
  type PreflightIssue,
  type ProofGuidance,
  type SheetOrderEstimate,
} from "../../domain/print";
import {
  StickerSheetCanvas,
  type StickerSheetCanvasHandle,
} from "./StickerSheetCanvas";
import {
  renderProductionFiles,
  submitProjectForReview,
  type SubmitProjectForReviewResult,
} from "./renderProductionFiles";
import { getDpi } from "../ImageUploader/utils/getDpi";
import {
  getDesignerKeyboardShortcut,
  isEditableShortcutTarget,
} from "./keyboardShortcuts";
import { getWorkflowSteps, type WorkflowStep } from "./workflowProgress";

const PROJECT_ID = "local-sticker-sheet";
const LOCAL_PROJECT_STORAGE_KEY = "sticker-sheet-designer:autosave";
const ARTWORK_FILE_ACCEPT =
  ".png,.jpg,.jpeg,.webp,.svg,.pdf,image/png,image/jpeg,image/webp,image/svg+xml,application/pdf";
const MIN_ARTWORK_QUANTITY = 1;
const MAX_ARTWORK_QUANTITY = 99;
const PLACED_ITEM_STAGGER_IN = 0.12;
const PERSISTED_THUMBNAIL_MAX_PX = 320;
const FOCUS_RING_CLASS =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2";
const FOCUS_WITHIN_RING_CLASS =
  "focus-within:ring-2 focus-within:ring-teal-700 focus-within:ring-offset-2";
const INPUT_CLASS =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2";
const SUMMARY_CLASS =
  "cursor-pointer px-3 py-2 text-sm font-semibold text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700";

interface InitialDesignerState {
  document: SheetDocument;
  restoreNotice: string | null;
}

interface SavedDocumentResult {
  document: SheetDocument | null;
  restoreNotice: string | null;
}

interface ProjectJsonReadResult {
  document: SheetDocument;
  droppedAssetCount: number;
  droppedItemCount: number;
}

interface SubmittedProofReceipt {
  cloudinaryAssetPaths: string[];
  cloudinaryFolder?: string;
  cloudinaryStatus?: "mirrored" | "skipped";
  cloudinaryWarnings: string[];
  emailMessage?: string;
  emailStatus?: "not-configured" | "queued" | "sent" | "failed";
  files: {
    orderJson?: string;
    previewPng?: string;
    printPdf?: string;
    projectJson?: string;
  };
  projectId: string;
}

type SubmitProgressPhase =
  | "idle"
  | "preparing"
  | "uploading"
  | "finalizing"
  | "failed";

interface SubmitProgress {
  message: string;
  phase: SubmitProgressPhase;
}

const IDLE_SUBMIT_PROGRESS: SubmitProgress = {
  message: "",
  phase: "idle",
};

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createInitialDesignerState(): InitialDesignerState {
  const savedDocument = loadSavedDocument();

  if (savedDocument.document) {
    return {
      document: savedDocument.document,
      restoreNotice: savedDocument.restoreNotice,
    };
  }

  return {
    document: createSheetDocument({
      id: PROJECT_ID,
      sheetSizeId: "11x17",
      now: new Date().toISOString(),
    }),
    restoreNotice: savedDocument.restoreNotice,
  };
}

export default function StickerSheetDesigner() {
  const canvasRef = useRef<StickerSheetCanvasHandle>(null);
  const [initialDesignerState] = useState(createInitialDesignerState);
  const [restoreNotice, setRestoreNotice] = useState(
    initialDesignerState.restoreNotice,
  );
  const [assetFiles, setAssetFiles] = useState<Record<string, File>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] =
    useState<SubmitProgress>(IDLE_SUBMIT_PROGRESS);
  const [assetQuantities, setAssetQuantities] = useState<
    Record<string, number>
  >({});
  const [submittedProof, setSubmittedProof] =
    useState<SubmittedProofReceipt | null>(null);
  const [history, dispatchDocument] = useReducer(
    (state: SheetDocumentHistoryState, action: SheetDocumentHistoryAction) =>
      sheetDocumentHistoryReducer(state, action),
    initialDesignerState.document,
    createSheetDocumentHistory,
  );
  const [viewState, dispatchView] = useReducer(
    sheetViewStateReducer,
    DEFAULT_SHEET_VIEW_STATE,
  );
  const document = history.present;
  const selectedItem = document.items.find((item) =>
    viewState.selectedItemIds.includes(item.id),
  );
  const selectedAsset = selectedItem
    ? document.assets.find((asset) => asset.id === selectedItem.assetId)
    : undefined;
  const selectedItemCount = viewState.selectedItemIds.length;
  const hasSelection = viewState.selectedItemIds.length > 0;
  const preflightIssues = useMemo(() => runPreflight(document), [document]);
  const preflightErrorCount = preflightIssues.filter(
    (issue) => issue.severity === "error",
  ).length;
  const preflightWarningCount = preflightIssues.length - preflightErrorCount;
  const canExport = canExportProductionBundle(preflightIssues);
  const workflowSteps = getWorkflowSteps({
    assetCount: document.assets.length,
    canExport,
    decalCount: document.items.length,
    isSubmitted: submittedProof !== null,
  });
  const proofGuidance = useMemo(() => buildProofGuidance(), []);
  const orderEstimate = useMemo(
    () => estimateSheetOrder({ sheetCount: 1 }),
    [],
  );
  const canSubmitForPrint = canExport && document.items.length > 0;

  const assetCountText = useMemo(() => {
    if (document.assets.length === 1) {
      return "1 asset";
    }

    return `${document.assets.length} assets`;
  }, [document.assets.length]);

  useEffect(() => {
    saveDocumentLocally(document);
  }, [document]);

  useEffect(() => {
    setSubmittedProof(null);
    setSubmitProgress(IDLE_SUBMIT_PROGRESS);
  }, [document.updatedAt]);

  const handleFiles = async (files: FileList | null) => {
    if (!files) {
      return;
    }

    const acceptedUploads: Array<{ asset: SheetAsset; file: File; item: SheetItem }> = [];
    let placementIndex = document.items.length;

    for (const file of Array.from(files)) {
      const issues = validateUploadCandidate(file);

      if (issues.length > 0) {
        issues.forEach((issue) => toast.error(issue.message));
        continue;
      }

      const asset = await createAssetFromFile(file);
      const item = staggerPlacedItem(
        createSheetItemFromAsset({
          id: createId("item"),
          asset,
          document,
        }),
        placementIndex,
        document,
      );

      acceptedUploads.push({ asset, file, item });
      placementIndex += 1;
    }

    if (acceptedUploads.length === 0) {
      return;
    }

    acceptedUploads.forEach(({ asset }) => {
      dispatchDocument({
        type: "asset/add",
        asset,
        now: new Date().toISOString(),
      });
    });

    dispatchDocument({
      type: "items/place",
      items: acceptedUploads.map(({ item }) => item),
      now: new Date().toISOString(),
    });
    setAssetFiles((current) => ({
      ...current,
      ...Object.fromEntries(
        acceptedUploads.map(({ asset, file }) => [asset.id, file]),
      ),
    }));
    dispatchView({
      type: "selection/select-item",
      itemId: acceptedUploads[acceptedUploads.length - 1].item.id,
    });
  };

  const placeAsset = (asset: SheetAsset, quantity: number) => {
    const items = Array.from(
      { length: clampArtworkQuantity(quantity) },
      (_, index) =>
        staggerPlacedItem(
          createSheetItemFromAsset({
            id: createId("item"),
            asset,
            document,
          }),
          index,
          document,
        ),
    );

    dispatchDocument({
      type: "items/place",
      items,
      now: new Date().toISOString(),
    });
    dispatchView({
      type: "selection/select-item",
      itemId: items[0].id,
    });
  };

  const updateAssetQuantity = (assetId: string, quantity: number) => {
    setAssetQuantities((current) => ({
      ...current,
      [assetId]: clampArtworkQuantity(quantity),
    }));
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

  const flipSelectedItemHorizontal = () => {
    if (!selectedItem) {
      return;
    }

    updateSelectedItem({ scaleX: selectedItem.scaleX * -1 });
  };

  const flipSelectedItemVertical = () => {
    if (!selectedItem) {
      return;
    }

    updateSelectedItem({ scaleY: selectedItem.scaleY * -1 });
  };

  const rotateSelectedItem = (degrees: number) => {
    if (!selectedItem) {
      return;
    }

    updateSelectedItem({
      rotationDeg: normalizeRotation(selectedItem.rotationDeg + degrees),
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

  const removeAsset = (assetId: string) => {
    dispatchDocument({
      type: "asset/remove",
      assetId,
      now: new Date().toISOString(),
    });
    setAssetFiles((current) => {
      const remainingFiles = { ...current };

      delete remainingFiles[assetId];

      return remainingFiles;
    });
    setAssetQuantities((current) => {
      const remainingQuantities = { ...current };

      delete remainingQuantities[assetId];

      return remainingQuantities;
    });
    dispatchView({ type: "selection/clear" });
  };

  const autoArrangeArtwork = () => {
    if (document.assets.length === 0) {
      toast.error("Upload artwork before arranging the sheet.");
      return;
    }

    const result = autoArrangeSheetItems({
      document,
      idFactory: () => createId("item"),
    });

    dispatchDocument({
      type: "items/replace",
      items: result.items,
      now: new Date().toISOString(),
    });
    dispatchView(
      result.items[0]
        ? { type: "selection/select-item", itemId: result.items[0].id }
        : { type: "selection/clear" },
    );

    if (result.unplacedAssetIds.length > 0) {
      toast.error(
        `${result.unplacedAssetIds.length} artwork item${
          result.unplacedAssetIds.length === 1 ? "" : "s"
        } did not fit.`,
      );
      return;
    }

    toast.success("Artwork arranged on the sheet.");
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
      2,
    );

  const downloadProjectJson = () => {
    downloadTextFile("project.json", createManifestJson(), "application/json");
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

      downloadTextFile(
        "project.json",
        createManifestJson(),
        "application/json",
      );
      downloadBase64File(
        "preview.png",
        renderedFiles.previewPngBase64,
        "image/png",
      );
      downloadBase64File(
        "print.pdf",
        renderedFiles.printPdfBase64,
        "application/pdf",
      );
      toast.success("Production files downloaded");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Production export failed.",
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
    setSubmittedProof(null);
    setSubmitProgress({
      message: "Preparing artwork and print settings.",
      phase: "preparing",
    });

    try {
      await waitForSubmitProgressPaint();
      setSubmitProgress({
        message: "Uploading artwork and requesting the print PDF.",
        phase: "uploading",
      });

      const result = await submitProjectForReview({
        assetFiles,
        document,
        preflightIssues,
      });

      setSubmitProgress({
        message: "Finalizing the saved print files.",
        phase: "finalizing",
      });
      await waitForSubmitProgressPaint();
      setSubmittedProof(createSubmittedProofReceipt(result));
      setSubmitProgress(IDLE_SUBMIT_PROGRESS);
      toast.success(`Submitted for print ${result.projectId}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Project submission failed.";

      setSubmitProgress({
        message: `${message} Check your connection and try again.`,
        phase: "failed",
      });
      toast.error(
        message,
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
      const loadedProject = readProjectFromProjectJson(await file.text());

      dispatchDocument({
        type: "history/reset",
        document: loadedProject.document,
      });
      setAssetFiles({});
      setAssetQuantities({});
      setSubmittedProof(null);
      setRestoreNotice(getProjectRestoreNotice(loadedProject));
      dispatchView({ type: "selection/clear" });
      toast.success("Project JSON loaded");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load project JSON.",
      );
    }
  };

  const applyKeyboardShortcut = useCallback(
    (shortcut: ReturnType<typeof getDesignerKeyboardShortcut>) => {
      if (!shortcut) {
        return false;
      }

      const now = new Date().toISOString();

      switch (shortcut.type) {
        case "clear-selection":
          if (!hasSelection) {
            return false;
          }

          dispatchView({ type: "selection/clear" });
          return true;

        case "delete":
          if (!hasSelection) {
            return false;
          }

          viewState.selectedItemIds.forEach((itemId) => {
            dispatchDocument({
              type: "item/remove",
              itemId,
              now,
            });
          });
          dispatchView({ type: "selection/clear" });
          return true;

        case "duplicate": {
          if (!selectedItem) {
            return false;
          }

          const newItemId = createId("item");

          dispatchDocument({
            type: "item/duplicate",
            itemId: selectedItem.id,
            newItemId,
            now,
          });
          dispatchView({
            type: "selection/select-item",
            itemId: newItemId,
          });
          return true;
        }

        case "flip-horizontal":
          if (!selectedItem) {
            return false;
          }

          dispatchDocument({
            type: "item/update",
            itemId: selectedItem.id,
            patch: { scaleX: selectedItem.scaleX * -1 },
            now,
          });
          return true;

        case "flip-vertical":
          if (!selectedItem) {
            return false;
          }

          dispatchDocument({
            type: "item/update",
            itemId: selectedItem.id,
            patch: { scaleY: selectedItem.scaleY * -1 },
            now,
          });
          return true;

        case "nudge":
          if (!selectedItem) {
            return false;
          }

          dispatchDocument({
            type: "item/update",
            itemId: selectedItem.id,
            patch: {
              xIn: roundToThousandth(selectedItem.xIn + shortcut.xIn),
              yIn: roundToThousandth(selectedItem.yIn + shortcut.yIn),
            },
            now,
          });
          return true;

        case "redo":
          if (history.future.length === 0) {
            return false;
          }

          dispatchDocument({ type: "history/redo" });
          return true;

        case "rotate":
          if (!selectedItem) {
            return false;
          }

          dispatchDocument({
            type: "item/update",
            itemId: selectedItem.id,
            patch: {
              rotationDeg: normalizeRotation(
                selectedItem.rotationDeg + shortcut.degrees,
              ),
            },
            now,
          });
          return true;

        case "undo":
          if (history.past.length === 0) {
            return false;
          }

          dispatchDocument({ type: "history/undo" });
          return true;
      }
    },
    [
      hasSelection,
      history.future.length,
      history.past.length,
      selectedItem,
      viewState.selectedItemIds,
    ],
  );

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      if (isEditableShortcutTarget(event.target)) {
        return;
      }

      const shortcut = getDesignerKeyboardShortcut(event);

      if (applyKeyboardShortcut(shortcut)) {
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyboardShortcut);

    return () => {
      window.removeEventListener("keydown", handleKeyboardShortcut);
    };
  }, [applyKeyboardShortcut]);

  return (
    <div className="flex min-h-screen w-full flex-col bg-neutral-100 text-neutral-950 lg:h-screen">
      <header className="flex flex-col gap-3 border-b border-neutral-300 bg-white px-4 py-3 lg:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            <label
              className={`inline-flex h-11 cursor-pointer items-center gap-2 rounded border border-teal-700 bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 ${FOCUS_WITHIN_RING_CLASS}`}
            >
              <PhotoIcon className="h-5 w-5" />
              Upload artwork
              <input
                className="sr-only"
                type="file"
                multiple
                accept={ARTWORK_FILE_ACCEPT}
                onChange={(event) => {
                  void handleFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
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
            <div className="mx-1 hidden h-7 w-px bg-neutral-300 sm:block" />
          </div>
        </div>

        <WorkflowProgress steps={workflowSteps} />
        {restoreNotice && (
          <div
            className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
            role="status"
          >
            <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="min-w-0 flex-1 leading-5">{restoreNotice}</p>
            <button
              className="shrink-0 rounded px-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              type="button"
              onClick={() => setRestoreNotice(null)}
            >
              Dismiss
            </button>
          </div>
        )}
      </header>

      <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
        <aside
          aria-label="Sheet setup and artwork"
          className="border-b border-neutral-300 bg-white lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r"
        >
          <PanelTitle title="Sheet" />
          <div className="space-y-3 px-4 pb-4">
            <label
              className="block text-xs font-semibold uppercase text-neutral-500"
              htmlFor="sheet-size-select"
            >
              Size
            </label>
            <select
              id="sheet-size-select"
              className={`h-10 w-full rounded border border-neutral-300 bg-white px-3 text-sm ${INPUT_CLASS}`}
              title="Sheet size"
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
              <>
                <FirstRunGuide />
                <ArtworkUploadDropZone
                  onFiles={(files) => {
                    void handleFiles(files);
                  }}
                />
              </>
            ) : (
              <>
                <button
                  className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-neutral-300 bg-white text-sm font-medium hover:bg-neutral-50 ${FOCUS_RING_CLASS}`}
                  type="button"
                  onClick={autoArrangeArtwork}
                >
                  <SparklesIcon className="h-5 w-5" />
                  Auto-arrange
                </button>
                <label
                  className={`inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded border border-teal-700 bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 ${FOCUS_WITHIN_RING_CLASS}`}
                >
                  <PhotoIcon className="h-5 w-5" />
                  Upload artwork
                  <input
                    className="sr-only"
                    type="file"
                    multiple
                    accept={ARTWORK_FILE_ACCEPT}
                    onChange={(event) => {
                      void handleFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </label>
                {document.assets.map((asset) => (
                  <AssetRow
                    key={asset.id}
                    asset={asset}
                    isSelected={asset.id === viewState.selectedAssetId}
                    quantity={assetQuantities[asset.id] ?? 1}
                    onSelect={() =>
                      dispatchView({
                        type: "selection/select-asset",
                        assetId: asset.id,
                      })
                    }
                    onPlace={() =>
                      placeAsset(asset, assetQuantities[asset.id] ?? 1)
                    }
                    onQuantityChange={(quantity) =>
                      updateAssetQuantity(asset.id, quantity)
                    }
                    onRemove={() => removeAsset(asset.id)}
                    preflightIssues={preflightIssues.filter(
                      (issue) => issue.assetId === asset.id,
                    )}
                  />
                ))}
              </>
            )}
          </div>

          <div className="px-4 pb-4">
            <ProofChecklist guidance={proofGuidance} />
          </div>

          <PanelTitle title="Proof" />
          <ProductionActionsPanel
            canExport={canExport}
            canSubmitForPrint={canSubmitForPrint}
            documentItemCount={document.items.length}
            isExporting={isExporting}
            isSubmitting={isSubmitting}
            submittedProof={submittedProof}
            submitProgress={submitProgress}
            onDownloadBundle={downloadAvailableBundleFiles}
            onDownloadPreviewPng={downloadPreviewPng}
            onSubmitForReview={submitForReview}
          />
        </aside>

        <main className="min-h-[480px] min-w-0 overflow-hidden sm:min-h-[560px] lg:min-h-0">
          <StickerSheetCanvas
            ref={canvasRef}
            document={document}
            viewState={viewState}
            onSelectItem={(itemId, append) =>
              dispatchView({ type: "selection/select-item", itemId, append })
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

        <aside
          aria-label="Editor controls and order summary"
          className="border-t border-neutral-300 bg-white lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-t-0"
        >
          <details className="m-4 rounded border border-neutral-200 bg-neutral-50">
            <summary className={SUMMARY_CLASS}>
              View
            </summary>
            <div className="space-y-3 border-t border-neutral-200 p-3">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Zoom</span>
                <input
                  className={`w-36 accent-teal-700 ${INPUT_CLASS}`}
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
                description="Show measured gaps around selected decals."
                label="Spacing guides"
                checked={viewState.showSpacingGuides}
                onChange={(visible) =>
                  dispatchView({
                    type: "overlay/set-spacing-guides",
                    visible,
                  })
                }
              />
              <OverlayToggle
                description={proofGuidance.bleed.description}
                label={proofGuidance.bleed.label}
                checked={viewState.showBleed}
                onChange={(visible) =>
                  dispatchView({ type: "overlay/set-bleed", visible })
                }
              />
              <OverlayToggle
                description={proofGuidance.safeArea.description}
                label={proofGuidance.safeArea.label}
                checked={viewState.showSafeArea}
                onChange={(visible) =>
                  dispatchView({ type: "overlay/set-safe-area", visible })
                }
              />
              <OverlayToggle
                description={proofGuidance.cutlines.description}
                label={proofGuidance.cutlines.label}
                checked={viewState.showCutlines}
                onChange={(visible) =>
                  dispatchView({ type: "overlay/set-cutlines", visible })
                }
              />
              <OverlayToggle
                description='Snap moved decals to the 1/4" grid.'
                label="Snap to grid"
                checked={viewState.snapToGrid}
                onChange={(enabled) =>
                  dispatchView({ type: "snap/set-grid", enabled })
                }
              />
              <OverlayToggle
                description="Snap moved decals to other decals, sheet edges, and the safe margin."
                label="Snap to decals and sheet"
                checked={viewState.snapToItems}
                onChange={(enabled) =>
                  dispatchView({ type: "snap/set-items", enabled })
                }
              />
              <ProofGuideLegend guidance={proofGuidance} />
            </div>
          </details>

          <ProjectToolsPanel
            onDownloadProjectJson={downloadProjectJson}
            onImportProjectJson={importProjectJson}
          />

          <PanelTitle title="Selection" />
          <div className="space-y-4 px-4 pb-4">
            {selectedItem ? (
              <>
                <div className="rounded border border-neutral-200 bg-neutral-50 p-3">
                  <p className="truncate text-sm font-medium">
                    {selectedItemCount > 1
                      ? `${selectedItemCount} decals selected`
                      : (selectedAsset?.fileName ?? selectedItem.name)}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {selectedItemCount > 1
                      ? "Editing the first selected decal below"
                      : `${selectedItem.widthIn.toFixed(2)}" x ${selectedItem.heightIn.toFixed(2)}"`}
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <IconButton
                    label="Flip horizontal"
                    onClick={flipSelectedItemHorizontal}
                  >
                    <ArrowsRightLeftIcon className="h-5 w-5" />
                  </IconButton>
                  <IconButton
                    label="Flip vertical"
                    onClick={flipSelectedItemVertical}
                  >
                    <ArrowsUpDownIcon className="h-5 w-5" />
                  </IconButton>
                  <IconButton
                    label="Rotate left 90 degrees"
                    onClick={() => rotateSelectedItem(-90)}
                  >
                    <ArrowUturnLeftIcon className="h-5 w-5" />
                  </IconButton>
                  <IconButton
                    label="Rotate right 90 degrees"
                    onClick={() => rotateSelectedItem(90)}
                  >
                    <ArrowUturnRightIcon className="h-5 w-5" />
                  </IconButton>
                </div>

                <NumberField
                  label="Rotation"
                  value={selectedItem.rotationDeg}
                  onChange={(rotationDeg) =>
                    updateSelectedItem({ rotationDeg })
                  }
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
                rotation. Keyboard users can tab through artwork, view toggles,
                and proof controls.
              </div>
            )}
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

          <PanelTitle title="Order Summary" />
          <ExportPanel
            canExport={canExport}
            documentItemCount={document.items.length}
            preflightErrorCount={preflightErrorCount}
            preflightWarningCount={preflightWarningCount}
            orderEstimate={orderEstimate}
            sheetLabel={`${document.sheet.widthIn}" x ${document.sheet.heightIn}"`}
            assetCount={document.assets.length}
            submittedProof={submittedProof}
          />
        </aside>
      </div>
    </div>
  );
}

function WorkflowProgress({ steps }: { steps: WorkflowStep[] }) {
  return (
    <nav aria-label="Sticker sheet progress">
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((step, index) => (
          <li key={step.label}>
            <WorkflowProgressStep step={step} stepNumber={index + 1} />
          </li>
        ))}
      </ol>
    </nav>
  );
}

function WorkflowProgressStep({
  step,
  stepNumber,
}: {
  step: WorkflowStep;
  stepNumber: number;
}) {
  const Icon =
    step.label === "Upload"
      ? PhotoIcon
      : step.label === "Arrange"
        ? SparklesIcon
        : step.label === "Proof"
          ? CheckCircleIcon
          : CloudArrowUpIcon;
  const isComplete = step.status === "complete";
  const isCurrent = step.status === "current";
  const itemClassName = isComplete
    ? "border-teal-200 bg-teal-50 text-teal-950"
    : isCurrent
      ? "border-teal-700 bg-white text-neutral-950 shadow-sm"
      : "border-neutral-200 bg-neutral-50 text-neutral-500";
  const markerClassName = isComplete
    ? "bg-teal-700 text-white"
    : isCurrent
      ? "bg-neutral-950 text-white"
      : "bg-neutral-200 text-neutral-600";

  return (
    <div
      aria-current={isCurrent ? "step" : undefined}
      className={`flex min-h-16 items-center gap-3 rounded border px-3 py-2 ${itemClassName}`}
    >
      <span
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${markerClassName}`}
      >
        {isComplete ? (
          <CheckCircleIcon className="h-5 w-5" />
        ) : (
          <Icon className="h-5 w-5" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase text-inherit opacity-70">
          Step {stepNumber}
        </span>
        <span className="block truncate text-sm font-semibold">
          {step.label}
        </span>
        <span className="block truncate text-xs text-inherit opacity-75">
          {step.description}
        </span>
      </span>
    </div>
  );
}

function ArtworkUploadDropZone({
  onFiles,
}: {
  onFiles: (files: FileList | null) => void;
}) {
  return (
    <label
      className={`flex min-h-48 cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed border-teal-300 bg-teal-50/60 px-4 py-6 text-center hover:border-teal-600 hover:bg-teal-50 ${FOCUS_WITHIN_RING_CLASS}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onFiles(event.dataTransfer.files);
      }}
    >
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-teal-700 text-white">
        <PhotoIcon className="h-6 w-6" />
      </span>
      <span className="mt-3 text-sm font-semibold text-neutral-950">
        Upload artwork
      </span>
      <span className="mt-1 max-w-48 text-xs leading-5 text-neutral-600">
        Drag files here or choose PNG, JPG, WebP, SVG, or PDF files.
      </span>
      <span className="mt-2 max-w-56 text-xs leading-5 text-teal-900">
        Artwork is placed on the sheet automatically after upload.
      </span>
      <span className="mt-4 inline-flex h-10 items-center justify-center rounded border border-teal-700 bg-teal-700 px-4 text-sm font-semibold text-white">
        Choose files
      </span>
      <input
        className="sr-only"
        type="file"
        multiple
        accept={ARTWORK_FILE_ACCEPT}
        onChange={(event) => {
          onFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </label>
  );
}

function FirstRunGuide() {
  return (
    <div className="rounded border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
      <p className="font-semibold">Start with artwork</p>
      <ol className="mt-2 space-y-1 text-xs leading-5">
        <li>1. Upload a print-ready image, SVG, or PDF.</li>
        <li>2. Confirm the automatic placement on the sheet.</li>
        <li>3. Review preflight and order summary before submitting.</li>
      </ol>
    </div>
  );
}

function clampArtworkQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) {
    return MIN_ARTWORK_QUANTITY;
  }

  return Math.min(
    MAX_ARTWORK_QUANTITY,
    Math.max(MIN_ARTWORK_QUANTITY, Math.round(quantity)),
  );
}

function staggerPlacedItem(
  item: SheetItem,
  index: number,
  document: SheetDocument,
): SheetItem {
  if (index === 0) {
    return item;
  }

  const offsetIn = index * PLACED_ITEM_STAGGER_IN;
  const maxXIn = Math.max(0, document.sheet.widthIn - item.widthIn);
  const maxYIn = Math.max(0, document.sheet.heightIn - item.heightIn);

  return {
    ...item,
    xIn: roundToHundredth(Math.min(maxXIn, item.xIn + offsetIn)),
    yIn: roundToHundredth(Math.min(maxYIn, item.yIn + offsetIn)),
  };
}

function roundToHundredth(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundToThousandth(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function normalizeRotation(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function ProductionActionsPanel({
  canExport,
  canSubmitForPrint,
  documentItemCount,
  isExporting,
  isSubmitting,
  submittedProof,
  submitProgress,
  onDownloadBundle,
  onDownloadPreviewPng,
  onSubmitForReview,
}: {
  canExport: boolean;
  canSubmitForPrint: boolean;
  documentItemCount: number;
  isExporting: boolean;
  isSubmitting: boolean;
  submittedProof: SubmittedProofReceipt | null;
  submitProgress: SubmitProgress;
  onDownloadBundle: () => void;
  onDownloadPreviewPng: () => void;
  onSubmitForReview: () => void;
}) {
  const disabledReason = getProductionActionDisabledReason({
    canExport,
    documentItemCount,
  });
  const proofPngDisabledReason =
    documentItemCount === 0 ? "Add artwork to enable proof downloads." : null;
  const submitDisabledReason = disabledReason;
  const exportStatusId = "production-actions-status";
  const submitProgressId = "production-submit-progress";
  const submitFailureId = "production-submit-failure";
  const submitButtonLabel = getSubmitButtonLabel({
    isSubmitting,
    submitProgress,
  });

  return (
    <div className="space-y-2 px-4 pb-4">
      {(disabledReason || proofPngDisabledReason || submitDisabledReason) && (
        <p
          className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900"
          id={exportStatusId}
        >
          {submitDisabledReason ?? disabledReason ?? proofPngDisabledReason}
        </p>
      )}
      <button
        className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-neutral-300 bg-white text-sm font-medium hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING_CLASS}`}
        aria-describedby={proofPngDisabledReason ? exportStatusId : undefined}
        disabled={documentItemCount === 0}
        title={proofPngDisabledReason ?? undefined}
        type="button"
        onClick={onDownloadPreviewPng}
      >
        <ArrowDownTrayIcon className="h-5 w-5" />
        Proof PNG
      </button>
      <button
        className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-teal-700 bg-teal-700 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-200 disabled:text-neutral-500 ${FOCUS_RING_CLASS}`}
        aria-describedby={disabledReason ? exportStatusId : undefined}
        disabled={!canExport || documentItemCount === 0 || isExporting}
        title={disabledReason ?? undefined}
        type="button"
        onClick={onDownloadBundle}
      >
        <ArrowDownTrayIcon className="h-5 w-5" />
        {isExporting ? "Rendering..." : "Export Files"}
      </button>
      <button
        className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-emerald-700 bg-emerald-700 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-200 disabled:text-neutral-500 ${FOCUS_RING_CLASS}`}
        aria-describedby={
          submitDisabledReason
            ? exportStatusId
            : isSubmitting
              ? submitProgressId
              : submitProgress.phase === "failed"
                ? submitFailureId
                : undefined
        }
        disabled={!canSubmitForPrint || isSubmitting}
        title={submitDisabledReason ?? undefined}
        type="button"
        onClick={onSubmitForReview}
      >
        <CloudArrowUpIcon className="h-5 w-5" />
        {submitButtonLabel}
      </button>
      {isSubmitting && (
        <div
          className="rounded border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950"
          id={submitProgressId}
          role="status"
        >
          <p className="font-semibold">Submitting for print</p>
          <p className="mt-1 leading-5">{submitProgress.message}</p>
        </div>
      )}
      {!isSubmitting && submitProgress.phase === "failed" && (
        <div
          className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-900"
          id={submitFailureId}
          role="alert"
        >
          <p className="font-semibold">Submission did not complete.</p>
          <p className="mt-1 leading-5">{submitProgress.message}</p>
          <p className="mt-2 leading-5">
            Your layout is still here. Use Submit for Print to try again.
          </p>
        </div>
      )}
      {submittedProof && (
        <div className="space-y-2 rounded border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          <p className="font-semibold">
            Submitted for print as {submittedProof.projectId}
          </p>
          <div className="rounded border border-emerald-200 bg-white/70 p-2">
            <p className="font-semibold text-emerald-900">Saved for print</p>
            <dl className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
              <ReceiptFileStatus
                available={!!submittedProof.files.printPdf}
                label="Print PDF"
              />
              <ReceiptFileStatus
                available={!!submittedProof.files.previewPng}
                label="Proof preview"
              />
              <ReceiptFileStatus
                available={!!submittedProof.files.orderJson}
                label="Order record"
              />
            </dl>
          </div>
          {submittedProof.emailStatus === "not-configured" && (
            <p className="leading-5 text-amber-900">
              Email delivery is not configured yet; the PDF and order files were
              saved for review.
            </p>
          )}
          {submittedProof.emailMessage && submittedProof.emailStatus !== "not-configured" && (
            <p className="leading-5">{submittedProof.emailMessage}</p>
          )}
          {submittedProof.cloudinaryWarnings.length > 0 && (
            <p className="leading-5 text-amber-900">
              Storage warning: {submittedProof.cloudinaryWarnings.join(" ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function getProductionActionDisabledReason({
  canExport,
  documentItemCount,
}: {
  canExport: boolean;
  documentItemCount: number;
}): string | null {
  if (documentItemCount === 0) {
    return "Add artwork to enable proof downloads, exports, and print submission.";
  }

  if (!canExport) {
    return "Resolve preflight errors before exporting or submitting a proof.";
  }

  return null;
}

function getSubmitButtonLabel({
  isSubmitting,
  submitProgress,
}: {
  isSubmitting: boolean;
  submitProgress: SubmitProgress;
}): string {
  if (!isSubmitting) {
    return "Submit for Print";
  }

  switch (submitProgress.phase) {
    case "preparing":
      return "Preparing...";
    case "uploading":
      return "Uploading...";
    case "finalizing":
      return "Finalizing...";
    default:
      return "Submitting...";
  }
}

function waitForSubmitProgressPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function ExportPanel({
  assetCount,
  canExport,
  documentItemCount,
  preflightErrorCount,
  preflightWarningCount,
  orderEstimate,
  sheetLabel,
  submittedProof,
}: {
  assetCount: number;
  canExport: boolean;
  documentItemCount: number;
  preflightErrorCount: number;
  preflightWarningCount: number;
  orderEstimate: SheetOrderEstimate;
  sheetLabel: string;
  submittedProof: SubmittedProofReceipt | null;
}) {
  return (
    <div className="space-y-2 px-4 pb-4">
      <div className="rounded border border-neutral-200 bg-neutral-50 p-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <ProofMetric label="Sheet" value={sheetLabel} />
          <ProofMetric label="Artwork" value={assetCount} />
          <ProofMetric label="Decals" value={documentItemCount} />
          <ProofMetric
            label="Preflight"
            value={
              preflightErrorCount === 0 && preflightWarningCount === 0
                ? "Ready"
                : `${preflightErrorCount} errors | ${preflightWarningCount} warnings`
            }
          />
        </div>
      </div>
      <OrderSummaryPanel
        canExport={canExport}
        documentItemCount={documentItemCount}
        estimate={orderEstimate}
        preflightErrorCount={preflightErrorCount}
        submittedProof={submittedProof}
      />
    </div>
  );
}

function ProjectToolsPanel({
  onDownloadProjectJson,
  onImportProjectJson,
}: {
  onDownloadProjectJson: () => void;
  onImportProjectJson: (file: File | undefined) => void;
}) {
  return (
    <details className="mx-4 mb-4 rounded border border-neutral-200 bg-neutral-50">
      <summary className={SUMMARY_CLASS}>
        Project tools
      </summary>
      <div className="space-y-2 border-t border-neutral-200 p-2">
        <label
          className={`inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded border border-neutral-300 bg-white text-sm font-medium hover:bg-neutral-50 ${FOCUS_WITHIN_RING_CLASS}`}
        >
          <FolderOpenIcon className="h-5 w-5" />
          Open project JSON
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
          className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-neutral-300 bg-white text-sm font-medium hover:bg-neutral-50 ${FOCUS_RING_CLASS}`}
          type="button"
          onClick={onDownloadProjectJson}
        >
          <ArrowDownTrayIcon className="h-5 w-5" />
          Download project JSON
        </button>
      </div>
    </details>
  );
}

function OrderSummaryPanel({
  canExport,
  documentItemCount,
  estimate,
  preflightErrorCount,
  submittedProof,
}: {
  canExport: boolean;
  documentItemCount: number;
  estimate: SheetOrderEstimate;
  preflightErrorCount: number;
  submittedProof: SubmittedProofReceipt | null;
}) {
  const perSheetCents = estimate.subtotalCents / estimate.sheetCount;
  const readiness = getSubmitProofReadiness({
    canExport,
    documentItemCount,
    preflightErrorCount,
    submittedProof,
  });

  return (
    <div className="rounded border border-neutral-200 bg-white p-3 text-sm text-neutral-700">
      <div className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-xs font-semibold uppercase text-neutral-500">
            Estimated total
          </span>
          <span className="mt-1 block text-xl font-semibold text-neutral-950">
            {formatCurrency(estimate.estimatedOrderCents)}
          </span>
        </span>
        <span
          className={`rounded border px-2 py-1 text-xs font-semibold ${readiness.className}`}
        >
          {readiness.label}
        </span>
      </div>

      <dl className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200 text-xs">
        <OrderSummaryRow
          label="Sheet count"
          value={`${estimate.sheetCount} sheet${
            estimate.sheetCount === 1 ? "" : "s"
          }`}
        />
        <OrderSummaryRow
          label="Price"
          value={`${formatCurrency(perSheetCents)} per sheet`}
        />
        <OrderSummaryRow
          label="Sheet subtotal"
          value={formatCurrency(estimate.subtotalCents)}
        />
        <OrderSummaryRow
          label="Minimum order"
          value={formatCurrency(estimate.minimumOrderCents)}
        />
        <OrderSummaryRow
          label="Free shipping threshold"
          value={formatCurrency(estimate.freeShippingThresholdCents)}
        />
      </dl>

      <div className={`mt-3 rounded border p-3 text-xs ${readiness.className}`}>
        <p className="font-semibold">Submit for print</p>
        <p className="mt-1 leading-5">{readiness.description}</p>
        {!estimate.freeShippingEligible && (
          <p className="mt-2 leading-5">
            {formatCurrency(estimate.remainingForFreeShippingCents)} from free
            shipping.
          </p>
        )}
      </div>
    </div>
  );
}

function OrderSummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right font-medium text-neutral-900">{value}</dd>
    </div>
  );
}

function getSubmitProofReadiness({
  canExport,
  documentItemCount,
  preflightErrorCount,
  submittedProof,
}: {
  canExport: boolean;
  documentItemCount: number;
  preflightErrorCount: number;
  submittedProof: SubmittedProofReceipt | null;
}): {
  className: string;
  description: string;
  label: string;
} {
  if (submittedProof) {
    return {
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      description: `Submitted for print as ${submittedProof.projectId}.`,
      label: "Submitted",
    };
  }

  if (documentItemCount === 0) {
    return {
      className: "border-amber-200 bg-amber-50 text-amber-900",
      description: "Upload and place artwork before submitting for print.",
      label: "Needs artwork",
    };
  }

  if (!canExport) {
    return {
      className: "border-red-200 bg-red-50 text-red-800",
      description: `Resolve ${preflightErrorCount} preflight error${
        preflightErrorCount === 1 ? "" : "s"
      } before submitting.`,
      label: "Not ready",
    };
  }

  return {
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    description: "Ready to submit once the preview looks correct.",
    label: "Ready",
  };
}

function createSubmittedProofReceipt(
  result: SubmitProjectForReviewResult,
): SubmittedProofReceipt {
  return {
    projectId: result.projectId,
    cloudinaryFolder: result.cloudinary?.folder,
    cloudinaryStatus: result.cloudinary?.status,
    cloudinaryAssetPaths:
      result.cloudinary?.files
        .map((file) => file.path)
        .filter((filePath) => filePath.startsWith("assets/"))
        .sort((first, second) => first.localeCompare(second)) ?? [],
    cloudinaryWarnings: result.cloudinary?.warnings ?? [],
    emailMessage: result.email?.message,
    emailStatus: result.email?.status,
    files: {
      orderJson: result.files.orderJson,
      previewPng: result.files.previewPng,
      printPdf: result.files.printPdf,
      projectJson: result.files.projectJson,
    },
  };
}

function ReceiptFileStatus({
  available,
  label,
}: {
  available: boolean;
  label: string;
}) {
  return (
    <>
      <dt className="text-emerald-900">{label}</dt>
      <dd className="font-semibold text-emerald-950">
        {available ? "Saved" : "Missing"}
      </dd>
    </>
  );
}

function ProofGuideLegend({ guidance }: { guidance: ProofGuidance }) {
  return (
    <div className="rounded border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
      <p className="font-semibold text-neutral-800">Preview guide colors</p>
      <div className="mt-2 space-y-2">
        <GuideLegendItem
          className="border-orange-500"
          label={guidance.bleed.label}
        />
        <GuideLegendItem
          className="border-blue-600"
          label={guidance.safeArea.label}
        />
        <GuideLegendItem
          className="border-teal-700 border-dashed"
          label={guidance.cutlines.label}
        />
      </div>
    </div>
  );
}

function GuideLegendItem({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <span className={`h-0 w-8 border-t-2 ${className}`} />
      <span>{label}</span>
    </span>
  );
}

function ProofChecklist({ guidance }: { guidance: ProofGuidance }) {
  return (
    <div className="rounded border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950">
      <p className="font-semibold">Proof checklist</p>
      <ul className="mt-2 space-y-1">
        <li>{guidance.bleed.checklist}</li>
        <li>{guidance.safeArea.checklist}</li>
        <li>{guidance.cutlines.checklist}</li>
      </ul>
    </div>
  );
}

function ProofMetric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <span>
      <span className="block text-xs font-semibold uppercase text-neutral-500">
        {label}
      </span>
      <span className="mt-1 block font-medium text-neutral-950">{value}</span>
    </span>
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
          className={`w-full rounded border p-3 text-left text-sm ${FOCUS_RING_CLASS} ${
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
      className={`inline-flex h-10 w-10 items-center justify-center rounded border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING_CLASS}`}
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
      className={`h-9 rounded border px-3 text-sm font-medium ${FOCUS_RING_CLASS} ${
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
  onQuantityChange,
  onRemove,
  onSelect,
  preflightIssues,
  quantity,
}: {
  asset: SheetAsset;
  isSelected: boolean;
  onPlace: () => void;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  onSelect: () => void;
  preflightIssues: PreflightIssue[];
  quantity: number;
}) {
  const readiness = getArtworkReadiness(asset, preflightIssues);

  return (
    <div
      className={`grid w-full grid-cols-[48px_minmax(0,1fr)] gap-3 rounded border p-2 text-left ${
        isSelected
          ? "border-teal-700 bg-teal-50"
          : "border-neutral-200 bg-white"
      }`}
    >
      <button
        className="col-span-2 grid grid-cols-[48px_minmax(0,1fr)] gap-3 rounded text-left hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
        type="button"
        onClick={onSelect}
      >
        <AssetThumbnail asset={asset} />
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">
              {asset.fileName}
            </span>
            <ArtworkReadinessBadge readiness={readiness} />
          </span>
          <span className="block text-xs text-neutral-500">
            {asset.widthPx && asset.heightPx
              ? `${asset.widthPx} x ${asset.heightPx}px`
              : asset.fileType}
          </span>
          <span className="mt-1 block text-xs text-neutral-500">
            {readiness.detail}
          </span>
        </span>
      </button>
      <span className="col-span-2 grid grid-cols-[minmax(0,1fr)_auto_auto] items-end gap-2">
        <label className="block text-xs font-semibold uppercase text-neutral-500">
          Qty
          <input
            aria-label={`Quantity for ${asset.fileName}`}
            className="mt-1 h-9 w-full min-w-0 rounded border border-neutral-300 bg-white px-2 text-sm font-normal normal-case text-neutral-950"
            max={MAX_ARTWORK_QUANTITY}
            min={MIN_ARTWORK_QUANTITY}
            step="1"
            type="number"
            value={quantity}
            onChange={(event) => onQuantityChange(Number(event.target.value))}
          />
        </label>
        <button
          className="inline-flex h-9 items-center rounded border border-neutral-300 bg-white px-3 text-xs font-semibold hover:bg-neutral-50"
          type="button"
          onClick={() => {
            onPlace();
          }}
        >
          Place {quantity}
        </button>
        <button
          className="inline-flex h-9 items-center rounded border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-50"
          type="button"
          onClick={() => {
            onRemove();
          }}
        >
          Remove
        </button>
      </span>
    </div>
  );
}

type ArtworkReadiness = {
  detail: string;
  label: string;
  tone: "ready" | "warning" | "error";
};

function getArtworkReadiness(
  asset: SheetAsset,
  preflightIssues: PreflightIssue[],
): ArtworkReadiness {
  if (preflightIssues.some((issue) => issue.severity === "error")) {
    return {
      detail: preflightIssues[0]?.message ?? "Needs attention before export.",
      label: "Needs attention",
      tone: "error",
    };
  }

  if (preflightIssues.length > 0) {
    return {
      detail: preflightIssues[0].message,
      label: "Warning",
      tone: "warning",
    };
  }

  if (asset.dpi) {
    return {
      detail: `${asset.dpi} DPI artwork`,
      label: "Ready",
      tone: "ready",
    };
  }

  if (asset.fileType === "image/svg+xml") {
    return {
      detail: "Vector artwork; DPI metadata is not required",
      label: "Ready",
      tone: "ready",
    };
  }

  if (asset.widthPx && asset.heightPx) {
    return {
      detail: `DPI metadata unavailable; using ${STICKER_SHEET_MVP_PROFILE.requiredDpi} DPI for sizing`,
      label: "Ready",
      tone: "ready",
    };
  }

  return {
    detail: "Dimensions unavailable; proofing will recheck this file",
    label: "Check",
    tone: "warning",
  };
}

function ArtworkReadinessBadge({ readiness }: { readiness: ArtworkReadiness }) {
  const className =
    readiness.tone === "ready"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : readiness.tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-red-200 bg-red-50 text-red-800";

  return (
    <span
      className={`shrink-0 rounded border px-2 py-0.5 text-[11px] font-semibold ${className}`}
    >
      {readiness.label}
    </span>
  );
}

function AssetThumbnail({ asset }: { asset: SheetAsset }) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const thumbnailUrl = asset.previewUrl ?? asset.sourceUrl;

  if (!previewFailed && (asset.previewUrl || asset.fileType.startsWith("image/"))) {
    return (
      <img
        alt=""
        className="h-12 w-12 rounded border border-neutral-200 object-contain"
        src={thumbnailUrl}
        title={`Preview for ${asset.fileName}`}
        onError={() => setPreviewFailed(true)}
      />
    );
  }

  if (previewFailed) {
    return (
      <ThumbnailFallback
        label="No preview"
        title={`Preview unavailable for ${asset.fileName}`}
      />
    );
  }

  return (
    <ThumbnailFallback
      label={getFileExtension(asset.fileName, asset.fileType).toUpperCase()}
      title={`File thumbnail for ${asset.fileName}`}
    />
  );
}

function ThumbnailFallback({ label, title }: { label: string; title: string }) {
  return (
    <span
      className="inline-flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded border border-neutral-200 bg-neutral-100 px-1 text-center"
      title={title}
    >
      <Squares2X2Icon className="h-5 w-5 text-neutral-500" />
      <span className="max-w-full truncate text-[9px] font-semibold uppercase leading-none text-neutral-500">
        {label}
      </span>
    </span>
  );
}

function OverlayToggle({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description?: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const inputId = `overlay-toggle-${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;
  const descriptionId = description ? `${inputId}-description` : undefined;

  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="min-w-0">
        <label className="block font-medium text-neutral-800" htmlFor={inputId}>
          {label}
        </label>
        {description && (
          <span
            className="mt-1 block text-xs leading-5 text-neutral-500"
            id={descriptionId}
          >
            {description}
          </span>
        )}
      </span>
      <input
        aria-describedby={descriptionId}
        className={`mt-1 h-4 w-4 shrink-0 accent-teal-700 ${INPUT_CLASS}`}
        checked={checked}
        id={inputId}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
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
        className={`mt-1 h-9 w-full rounded border border-neutral-300 px-2 text-sm font-normal normal-case text-neutral-950 ${INPUT_CLASS}`}
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
  const isImage = file.type.startsWith("image/");
  const sourceUrl = isImage
    ? await readFileAsDataUrl(file)
    : URL.createObjectURL(file);
  const dimensions = isImage ? await loadImageDimensions(sourceUrl) : {};
  const dpi = isImage ? await readImageDpi(file) : null;
  const previewUrl = isImage
    ? await createImageThumbnailDataUrl(sourceUrl)
    : createFileThumbnailDataUrl(file.name, file.type);

  return {
    id: createId("asset"),
    sourceUrl,
    previewUrl,
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
    uploadedAt: new Date().toISOString(),
    ...(dpi ? { dpi } : {}),
    ...dimensions,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function readImageDpi(file: File): Promise<number | null> {
  try {
    return await getDpi(file);
  } catch {
    return null;
  }
}

async function loadImageDimensions(
  sourceUrl: string,
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

async function createImageThumbnailDataUrl(sourceUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image();

    image.onload = () => {
      const scale = Math.min(
        1,
        PERSISTED_THUMBNAIL_MAX_PX / Math.max(image.naturalWidth, image.naturalHeight),
      );
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        resolve(sourceUrl);
        return;
      }

      canvas.width = width;
      canvas.height = height;
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => resolve(sourceUrl);
    image.src = sourceUrl;
  });
}

function createFileThumbnailDataUrl(fileName: string, fileType: string): string {
  const extension = getFileExtension(fileName, fileType);
  const safeExtension = escapeSvgText(extension.toUpperCase());
  const safeFileName = escapeSvgText(fileName);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><rect width="320" height="240" rx="18" fill="#f4f4f5"/><rect x="86" y="38" width="148" height="164" rx="12" fill="#ffffff" stroke="#d4d4d8" stroke-width="4"/><path d="M198 38v42h36" fill="#e0f2fe"/><path d="M198 38v42h36" fill="none" stroke="#93c5fd" stroke-width="4"/><rect x="108" y="128" width="104" height="32" rx="16" fill="#0f766e"/><text x="160" y="150" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#ffffff">${safeExtension}</text><text x="160" y="190" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#52525b">${safeFileName}</text></svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function getFileExtension(fileName: string, fileType: string): string {
  const extension = fileName.split(".").pop();

  if (extension && extension !== fileName) {
    return extension.slice(0, 5);
  }

  return fileType.split("/").pop()?.slice(0, 5) || "file";
}

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadTextFile(
  fileName: string,
  contents: string,
  mimeType: string,
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
  mimeType: string,
) {
  const bytes = Uint8Array.from(atob(base64), (character) =>
    character.charCodeAt(0),
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
    try {
      localStorage.setItem(
        LOCAL_PROJECT_STORAGE_KEY,
        JSON.stringify(createPreviewOnlySavedDocument(document)),
      );
    } catch {
      // Autosave is best-effort; export JSON remains the durable fallback.
    }
  }
}

function createPreviewOnlySavedDocument(document: SheetDocument): SheetDocument {
  return {
    ...document,
    assets: document.assets.map((asset) => {
      const durablePreviewUrl =
        asset.previewUrl && isDurableAssetUrl(asset.previewUrl)
          ? asset.previewUrl
          : undefined;

      if (!durablePreviewUrl) {
        return asset;
      }

      return {
        ...asset,
        sourceUrl: shouldPreferPreviewForAutosave(asset.sourceUrl)
          ? durablePreviewUrl
          : asset.sourceUrl,
        previewUrl: durablePreviewUrl,
      };
    }),
  };
}

function shouldPreferPreviewForAutosave(sourceUrl: string): boolean {
  return sourceUrl.startsWith("blob:") || sourceUrl.startsWith("data:");
}

function loadSavedDocument(): SavedDocumentResult {
  try {
    const savedDocument = localStorage.getItem(LOCAL_PROJECT_STORAGE_KEY);

    if (!savedDocument) {
      return { document: null, restoreNotice: null };
    }

    const loadedProject = readProjectFromProjectJson(savedDocument);

    return {
      document: loadedProject.document,
      restoreNotice: getProjectRestoreNotice(loadedProject),
    };
  } catch {
    try {
      localStorage.removeItem(LOCAL_PROJECT_STORAGE_KEY);
    } catch {
      // If storage is unavailable, starting fresh is still the safest fallback.
    }

    return {
      document: null,
      restoreNotice:
        "Saved project data was stale or unreadable, so we started a fresh sheet.",
    };
  }
}

function readProjectFromProjectJson(contents: string): ProjectJsonReadResult {
  const parsed = JSON.parse(contents) as unknown;
  const candidate =
    parsed && typeof parsed === "object" && "document" in parsed
      ? (parsed as { document: unknown }).document
      : parsed;

  if (!isSheetDocument(candidate)) {
    throw new Error("Project JSON does not contain a valid sheet document.");
  }

  const durableAssetIds = new Set(
    candidate.assets
      .filter((asset) => hasDurableAssetUrl(asset))
      .map((asset) => asset.id),
  );

  const activeSheetSize = BASELINE_SHEET_SIZES[0];
  const assets = candidate.assets.filter((asset) => durableAssetIds.has(asset.id));
  const items = candidate.items.filter((item) => durableAssetIds.has(item.assetId));

  return {
    document: {
      ...candidate,
      productionProfileId: STICKER_SHEET_MVP_PROFILE.id,
      sheet: {
        sizeId: activeSheetSize.id,
        widthIn: activeSheetSize.widthIn,
        heightIn: activeSheetSize.heightIn,
        dpi: STICKER_SHEET_MVP_PROFILE.requiredDpi,
      },
      assets,
      items,
      updatedAt: new Date().toISOString(),
    },
    droppedAssetCount: candidate.assets.length - assets.length,
    droppedItemCount: candidate.items.length - items.length,
  };
}

function getProjectRestoreNotice(result: ProjectJsonReadResult): string | null {
  if (result.droppedAssetCount > 0 || result.droppedItemCount > 0) {
    return "Some saved artwork could not be restored because browser-only previews expired. Re-upload any missing files before submitting a proof.";
  }

  return null;
}

function hasDurableAssetUrl(asset: SheetAsset): boolean {
  const previewUrl = asset.previewUrl ?? asset.sourceUrl;

  return isDurableAssetUrl(asset.sourceUrl) || isDurableAssetUrl(previewUrl);
}

function isDurableAssetUrl(url: string): boolean {
  return !url.startsWith("blob:");
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
