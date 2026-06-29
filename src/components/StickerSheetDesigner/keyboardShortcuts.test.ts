import { describe, expect, it } from "vitest";
import {
  getDesignerKeyboardShortcut,
  isEditableShortcutTarget,
} from "./keyboardShortcuts";

describe("getDesignerKeyboardShortcut", () => {
  it("maps standard edit commands", () => {
    expect(shortcut({ key: "z", ctrlKey: true })).toEqual({ type: "undo" });
    expect(shortcut({ key: "z", metaKey: true, shiftKey: true })).toEqual({
      type: "redo",
    });
    expect(shortcut({ key: "y", ctrlKey: true })).toEqual({ type: "redo" });
    expect(shortcut({ key: "d", metaKey: true })).toEqual({
      type: "duplicate",
    });
    expect(shortcut({ key: "Delete" })).toEqual({ type: "delete" });
    expect(shortcut({ key: "Backspace" })).toEqual({ type: "delete" });
    expect(shortcut({ key: "Escape" })).toEqual({
      type: "clear-selection",
    });
  });

  it("maps selected artwork transform shortcuts", () => {
    expect(shortcut({ key: "h" })).toEqual({ type: "flip-horizontal" });
    expect(shortcut({ key: "v" })).toEqual({ type: "flip-vertical" });
    expect(shortcut({ key: "[" })).toEqual({ type: "rotate", degrees: -90 });
    expect(shortcut({ key: "]" })).toEqual({ type: "rotate", degrees: 90 });
  });

  it("maps arrow nudges with regular and large steps", () => {
    expect(shortcut({ key: "ArrowLeft" })).toEqual({
      type: "nudge",
      xIn: -0.05,
      yIn: 0,
    });
    expect(shortcut({ key: "ArrowDown", shiftKey: true })).toEqual({
      type: "nudge",
      xIn: 0,
      yIn: 0.25,
    });
  });

  it("ignores alt and unsupported modifier combinations", () => {
    expect(shortcut({ key: "h", altKey: true })).toBeNull();
    expect(shortcut({ key: "ArrowLeft", ctrlKey: true })).toBeNull();
    expect(shortcut({ key: "p", metaKey: true })).toBeNull();
  });
});

describe("isEditableShortcutTarget", () => {
  it("guards text entry targets", () => {
    expect(isEditableShortcutTarget(document.createElement("textarea"))).toBe(
      true,
    );
    expect(isEditableShortcutTarget(document.createElement("select"))).toBe(
      true,
    );
    expect(isEditableShortcutTarget(document.createElement("input"))).toBe(
      true,
    );

    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");

    expect(isEditableShortcutTarget(editable)).toBe(true);
  });

  it("allows non-text controls and neutral targets", () => {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";

    expect(isEditableShortcutTarget(checkbox)).toBe(false);
    expect(isEditableShortcutTarget(document.createElement("button"))).toBe(
      false,
    );
    expect(isEditableShortcutTarget(null)).toBe(false);
  });
});

function shortcut(
  input: Partial<Parameters<typeof getDesignerKeyboardShortcut>[0]>,
) {
  return getDesignerKeyboardShortcut({
    altKey: false,
    ctrlKey: false,
    key: "",
    metaKey: false,
    shiftKey: false,
    ...input,
  });
}
