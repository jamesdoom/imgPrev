import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { expectNoA11yViolations } from "../../test/accessibility";
import ImageUploader from "./ImageUploader";

vi.mock("react-hotkeys-hook", () => ({
  useHotkeys: vi.fn(),
}));

vi.mock("react-konva", () => ({
  Stage: ({ children }: { children?: ReactNode }) => (
    <div data-testid="stage">{children}</div>
  ),
  Layer: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Image: () => <div data-testid="konva-image" />,
  Transformer: () => <div data-testid="transformer" />,
  Line: () => <div data-testid="grid-line" />,
  Rect: () => <div data-testid="crop-rect" />,
}));

afterEach(() => {
  cleanup();
});

describe("ImageUploader accessibility", () => {
  test("has no axe violations for upload workspace and editor controls", async () => {
    const { container } = render(<ImageUploader />);

    expect(
      screen.getByRole("toolbar", { name: "Editor actions" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download PNG" })).toBeEnabled();
    expect(screen.getByTestId("dropzone")).toBeInTheDocument();

    await expectNoA11yViolations(container);
  });
});
