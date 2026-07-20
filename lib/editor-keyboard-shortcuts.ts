export type EditorKeyboardShortcut = "cancel" | "save";

export interface EditorKeyboardEvent {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
  preventDefault: () => void;
}

export interface EditorKeyboardShortcutActions {
  canSave: boolean;
  onCancel: () => void;
  onSave: () => void;
}

/**
 * Resuelve los atajos propios del editor sin depender del navegador ni de React.
 */
export function resolveEditorKeyboardShortcut(
  event: Omit<EditorKeyboardEvent, "preventDefault">
): EditorKeyboardShortcut | null {
  if (event.isComposing) return null;

  if (event.key === "Escape") return "cancel";

  const isSaveShortcut =
    event.key.toLowerCase() === "g" &&
    event.ctrlKey === true &&
    event.metaKey !== true &&
    event.altKey !== true &&
    event.shiftKey !== true;

  return isSaveShortcut ? "save" : null;
}

/**
 * Ejecuta un atajo reconocido y evita que el navegador intercepte la pulsación.
 */
export function handleEditorKeyboardShortcut(
  event: EditorKeyboardEvent,
  actions: EditorKeyboardShortcutActions
): boolean {
  const shortcut = resolveEditorKeyboardShortcut(event);
  if (!shortcut) return false;

  event.preventDefault();

  if (shortcut === "cancel") {
    actions.onCancel();
  } else if (actions.canSave) {
    actions.onSave();
  }

  return true;
}
