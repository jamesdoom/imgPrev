import { useHotkeys } from "react-hotkeys-hook";

interface UseImageHotkeysOptions {
  onDelete: () => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  onHelp: () => void;
  onResetTransforms: () => void;
  onRotate: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDeselect: () => void;
}

function isTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

export function useImageHotkeys({
  onDelete,
  onDeselect,
  onFlipHorizontal,
  onFlipVertical,
  onHelp,
  onRedo,
  onResetTransforms,
  onRotate,
  onUndo,
}: UseImageHotkeysOptions) {
  useHotkeys("ctrl+z, cmd+z", onUndo, { preventDefault: true }, [onUndo]);
  useHotkeys("ctrl+y, cmd+shift+y", onRedo, { preventDefault: true }, [
    onRedo,
  ]);
  useHotkeys("delete, backspace", onDelete, {}, [onDelete]);
  useHotkeys("esc", onDeselect, {}, [onDeselect]);
  useHotkeys(
    "?",
    (e) => {
      if (!isTextInput(e.target)) {
        e.preventDefault();
        onHelp();
      }
    },
    {},
    [onHelp]
  );
  useHotkeys("ctrl+h", onFlipHorizontal, { preventDefault: true }, [
    onFlipHorizontal,
  ]);
  useHotkeys("ctrl+v", onFlipVertical, { preventDefault: true }, [
    onFlipVertical,
  ]);
  useHotkeys("ctrl+r", onRotate, { preventDefault: true }, [onRotate]);
  useHotkeys("ctrl+shift+r", onResetTransforms, { preventDefault: true }, [
    onResetTransforms,
  ]);
}
