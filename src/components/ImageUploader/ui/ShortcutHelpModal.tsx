// src/components/ImageUploader/ShortcutHelpModal.tsx

import { useEffect, type ReactElement } from "react";

interface ShortcutHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShortcutHelpModal({
  isOpen,
  onClose,
}: ShortcutHelpModalProps): ReactElement | null {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white text-black rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4">Keyboard Shortcuts</h2>
        <ul className="text-sm space-y-2">
          <li>
            <strong>Ctrl + Z</strong> - Undo
          </li>
          <li>
            <strong>Ctrl + Y</strong> - Redo
          </li>
          <li>
            <strong>Delete / Backspace</strong> - Remove Image
          </li>
          <li>
            <strong>Ctrl + H</strong> - Flip Horizontally
          </li>
          <li>
            <strong>Ctrl + V</strong> - Flip Vertically
          </li>
          <li>
            <strong>Ctrl + R</strong> - Rotate 90 deg
          </li>
          <li>
            <strong>Ctrl + Shift + R</strong> - Reset Transform
          </li>
          <li>
            <strong>Esc</strong> - Deselect Image / Close Help
          </li>
          <li>
            <strong>?</strong> - Show this help menu
          </li>
        </ul>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          Close
        </button>
      </div>
    </div>
  );
}
