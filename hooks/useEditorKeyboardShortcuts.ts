import React from "react";
import { handleEditorKeyboardShortcut } from "../lib/editor-keyboard-shortcuts";

interface UseEditorKeyboardShortcutsOptions {
  enabled: boolean;
  canSave: boolean;
  onCancel: () => void;
  onSave: () => void;
}

/**
 * Conecta los atajos globales mientras el editor está abierto.
 */
export function useEditorKeyboardShortcuts({
  enabled,
  canSave,
  onCancel,
  onSave,
}: UseEditorKeyboardShortcutsOptions): void {
  React.useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      handleEditorKeyboardShortcut(event, {
        canSave,
        onCancel,
        onSave,
      });
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [canSave, enabled, onCancel, onSave]);
}
