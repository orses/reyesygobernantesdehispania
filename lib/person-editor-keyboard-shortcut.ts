export interface PersonEditorKeyboardEvent {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
}

export interface PersonEditorModalDocument {
  querySelector(selectors: string): unknown;
}

/**
 * Indica si la pulsación corresponde al atajo para abrir el editor del rey.
 */
export function isOpenPersonEditorShortcut(
  event: PersonEditorKeyboardEvent
): boolean {
  return (
    event.isComposing !== true &&
    event.key.toLowerCase() === "e" &&
    event.altKey === true &&
    event.ctrlKey !== true &&
    event.metaKey !== true &&
    event.shiftKey !== true
  );
}

/**
 * Evita abrir el editor bajo otro diálogo, incluidos los visores que mantienen
 * su estado fuera del componente principal.
 */
export function hasBlockingModal(documentLike: PersonEditorModalDocument): boolean {
  return documentLike.querySelector('[role="dialog"][aria-modal="true"], dialog[open]') !== null;
}
