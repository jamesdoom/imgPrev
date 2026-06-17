import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";
import ImageUploader from "../ImageUploader/ImageUploader";

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

test("renders the uploader workspace with disabled image actions initially", () => {
  render(<ImageUploader />);

  expect(screen.getByTestId("dropzone")).toBeInTheDocument();
  expect(screen.getByText(/PNG, JPEG, WebP/i)).toBeInTheDocument();
  expect(screen.getByText(/Max 21MB/i)).toBeInTheDocument();
  expect(screen.getByTestId("stage")).toBeInTheDocument();

  expect(screen.getByRole("button", { name: /rotate/i })).toBeDisabled();
  expect(screen.getByRole("button", { name: /remove image/i })).toBeDisabled();
  expect(screen.getByRole("button", { name: /download png/i })).toBeEnabled();
});
