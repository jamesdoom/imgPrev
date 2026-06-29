export const KEYBOARD_NUDGE_IN = 0.05;
export const KEYBOARD_LARGE_NUDGE_IN = 0.25;

export type DesignerKeyboardShortcut =
  | { type: "clear-selection" }
  | { type: "delete" }
  | { type: "duplicate" }
  | { type: "flip-horizontal" }
  | { type: "flip-vertical" }
  | { type: "nudge"; xIn: number; yIn: number }
  | { type: "redo" }
  | { type: "rotate"; degrees: number }
  | { type: "undo" };

type ShortcutKeyboardEvent = Pick<
  KeyboardEvent,
  "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
>;

const TEXT_INPUT_TYPES = new Set([
  "date",
  "datetime-local",
  "email",
  "month",
  "number",
  "password",
  "search",
  "tel",
  "text",
  "time",
  "url",
  "week",
]);

export function getDesignerKeyboardShortcut(
  event: ShortcutKeyboardEvent
): DesignerKeyboardShortcut | null {
  const key = event.key.toLowerCase();
  const usesCommandKey = event.ctrlKey || event.metaKey;

  if (event.altKey) {
    return null;
  }

  if (usesCommandKey) {
    if (key === "z") {
      return event.shiftKey ? { type: "redo" } : { type: "undo" };
    }

    if (key === "y") {
      return { type: "redo" };
    }

    if (key === "d") {
      return { type: "duplicate" };
    }

    return null;
  }

  if (key === "escape") {
    return { type: "clear-selection" };
  }

  if (key === "backspace" || key === "delete") {
    return { type: "delete" };
  }

  if (key === "h") {
    return { type: "flip-horizontal" };
  }

  if (key === "v") {
    return { type: "flip-vertical" };
  }

  if (key === "[") {
    return { type: "rotate", degrees: -90 };
  }

  if (key === "]") {
    return { type: "rotate", degrees: 90 };
  }

  const nudgeDistance = event.shiftKey
    ? KEYBOARD_LARGE_NUDGE_IN
    : KEYBOARD_NUDGE_IN;

  switch (key) {
    case "arrowdown":
      return { type: "nudge", xIn: 0, yIn: nudgeDistance };
    case "arrowleft":
      return { type: "nudge", xIn: -nudgeDistance, yIn: 0 };
    case "arrowright":
      return { type: "nudge", xIn: nudgeDistance, yIn: 0 };
    case "arrowup":
      return { type: "nudge", xIn: 0, yIn: -nudgeDistance };
    default:
      return null;
  }
}

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (
    target.isContentEditable ||
    target.getAttribute("contenteditable") === "true" ||
    target.closest('[contenteditable="true"]') !== null
  ) {
    return true;
  }

  const tagName = target.tagName.toLowerCase();

  if (tagName === "textarea" || tagName === "select") {
    return true;
  }

  if (tagName !== "input") {
    return false;
  }

  const inputType = (target as HTMLInputElement).type.toLowerCase();

  return TEXT_INPUT_TYPES.has(inputType);
}
