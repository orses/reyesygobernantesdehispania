export type MediaViewerNavigationAction = "previous" | "next" | "first" | "last";

export interface MediaViewerNavigationItem {
  id: string;
}

export interface MediaViewerNavigationState {
  currentIndex: number;
  total: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
}

interface MediaViewerNavigationKeyboardEvent {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
}

/**
 * Traduce una pulsación sin modificadores a una acción de navegación del visor.
 */
export function resolveMediaViewerNavigationAction(
  event: MediaViewerNavigationKeyboardEvent
): MediaViewerNavigationAction | null {
  if (
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey
  ) {
    return null;
  }

  switch (event.key) {
    case "ArrowLeft":
      return "previous";
    case "ArrowRight":
      return "next";
    case "Home":
      return "first";
    case "End":
      return "last";
    default:
      return null;
  }
}

/**
 * Describe la posición actual y los movimientos disponibles en la secuencia.
 */
export function getMediaViewerNavigationState(
  items: readonly MediaViewerNavigationItem[],
  currentId: string | null
): MediaViewerNavigationState {
  const currentIndex = currentId
    ? items.findIndex((item) => item.id === currentId)
    : -1;

  return {
    currentIndex,
    total: items.length,
    canGoPrevious: currentIndex > 0,
    canGoNext: currentIndex >= 0 && currentIndex < items.length - 1,
  };
}

/**
 * Obtiene el identificador de destino o `null` cuando no existe ese movimiento.
 */
export function getMediaViewerNavigationTargetId(
  items: readonly MediaViewerNavigationItem[],
  currentId: string | null,
  action: MediaViewerNavigationAction
): string | null {
  if (!items.length) return null;

  if (action === "first") return items[0].id;
  if (action === "last") return items[items.length - 1].id;

  const { currentIndex } = getMediaViewerNavigationState(items, currentId);
  if (action === "previous" && currentIndex > 0) {
    return items[currentIndex - 1].id;
  }
  if (action === "next" && currentIndex >= 0 && currentIndex < items.length - 1) {
    return items[currentIndex + 1].id;
  }

  return null;
}

/**
 * Evita que los atajos interfieran con la edición de controles del visor.
 */
export function isMediaViewerEditableTarget(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;

  const candidate = target as { tagName?: unknown; isContentEditable?: unknown };
  if (candidate.isContentEditable === true) return true;

  const tagName = typeof candidate.tagName === "string"
    ? candidate.tagName.toUpperCase()
    : "";
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}
