import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forwardRef, useImperativeHandle } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { expectNoA11yViolations } from "../../test/accessibility";
import type { SheetDocument } from "../../domain/print";
import StickerSheetDesigner from "./StickerSheetDesigner";

vi.mock("./StickerSheetCanvas", () => ({
  StickerSheetCanvas: forwardRef(function MockStickerSheetCanvas(
    {
      document,
      onClearSelection,
      onSelectItem,
    }: {
      document: SheetDocument;
      onClearSelection: () => void;
      onSelectItem: (itemId: string) => void;
    },
    ref,
  ) {
    useImperativeHandle(ref, () => ({
      exportPreviewPng: () => "data:image/png;base64,cHJldmlldw==",
    }));

    return (
      <section aria-label="Sticker sheet canvas">
        <button
          type="button"
          onClick={() => onSelectItem(document.items[0]?.id ?? "")}
        >
          Select first decal
        </button>
        <button type="button" onClick={onClearSelection}>
          Clear canvas selection
        </button>
        <p>{document.items.length} decals on canvas</p>
      </section>
    );
  }),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const AUTOSAVE_KEY = "sticker-sheet-designer:autosave";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("StickerSheetDesigner accessibility", () => {
  test("has no axe violations for customer layout and editor controls", async () => {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(createSavedDocument()));

    const { container } = render(<StickerSheetDesigner />);

    expect(screen.getByRole("heading", { name: "Custom decal sheet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Auto-arrange" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Grid" })).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", {
        description: "Show measured gaps around selected decals.",
        name: "Spacing guides",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", {
        description: 'Snap moved decals to the 1/4" grid.',
        name: "Snap to grid",
      }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Select first decal" }));
    expect(screen.getByLabelText("Rotation")).toBeInTheDocument();

    await expectNoA11yViolations(container);
  });

  test("explains disabled production actions before artwork is placed", async () => {
    render(<StickerSheetDesigner />);

    const disabledReason =
      "Add artwork to enable proof downloads, exports, and proof submission.";

    expect(screen.getByText(disabledReason)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Proof PNG" })).toHaveAccessibleDescription(
      disabledReason,
    );
    expect(screen.getByRole("button", { name: "Export Files" })).toHaveAccessibleDescription(
      disabledReason,
    );
    expect(
      screen.getByRole("button", { name: "Submit Proof Request" }),
    ).toHaveAccessibleDescription(disabledReason);
  });
});

function createSavedDocument(): SheetDocument {
  const imageDataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

  return {
    id: "project-a11y",
    version: 1,
    productionProfileId: "sticker-sheet-mvp",
    sheet: {
      sizeId: "11x17",
      widthIn: 11,
      heightIn: 17,
      dpi: 300,
    },
    assets: [
      {
        id: "asset-1",
        sourceUrl: imageDataUrl,
        previewUrl: imageDataUrl,
        fileName: "sample.png",
        fileType: "image/png",
        widthPx: 300,
        heightPx: 300,
        dpi: 300,
      },
    ],
    items: [
      {
        id: "item-1",
        assetId: "asset-1",
        name: "sample.png",
        xIn: 0.25,
        yIn: 0.25,
        widthIn: 1,
        heightIn: 1,
        rotationDeg: 0,
        scaleX: 1,
        scaleY: 1,
      },
    ],
    settings: {
      background: {
        type: "transparent",
      },
    },
    createdAt: "2026-06-30T10:00:00.000Z",
    updatedAt: "2026-06-30T10:00:00.000Z",
  };
}
