import { describe, expect, it } from "vitest";
import {
  getMediaViewerNavigationState,
  getMediaViewerNavigationTargetId,
  isMediaViewerEditableTarget,
  resolveMediaViewerNavigationAction,
} from "./media-viewer-navigation";

const items = [{ id: "image-1" }, { id: "image-2" }, { id: "image-3" }];

describe("navegación del visor multimedia", () => {
  it.each([
    ["ArrowLeft", "previous"],
    ["ArrowRight", "next"],
    ["Home", "first"],
    ["End", "last"],
  ] as const)("resuelve la tecla %s como %s", (key, action) => {
    expect(resolveMediaViewerNavigationAction({ key })).toBe(action);
  });

  it.each([
    { key: "Escape" },
    { key: "ArrowRight", ctrlKey: true },
    { key: "ArrowLeft", metaKey: true },
    { key: "Home", altKey: true },
    { key: "End", shiftKey: true },
    { key: "ArrowRight", isComposing: true },
  ])("ignora una pulsación ajena a la navegación: %o", (event) => {
    expect(resolveMediaViewerNavigationAction(event)).toBeNull();
  });

  it("calcula la posición y los límites de la imagen actual", () => {
    expect(getMediaViewerNavigationState(items, "image-2")).toEqual({
      currentIndex: 1,
      total: 3,
      canGoPrevious: true,
      canGoNext: true,
    });
    expect(getMediaViewerNavigationState(items, "image-1").canGoPrevious).toBe(false);
    expect(getMediaViewerNavigationState(items, "image-3").canGoNext).toBe(false);
  });

  it("avanza, retrocede y salta a los extremos sin navegación circular", () => {
    expect(getMediaViewerNavigationTargetId(items, "image-2", "previous")).toBe("image-1");
    expect(getMediaViewerNavigationTargetId(items, "image-2", "next")).toBe("image-3");
    expect(getMediaViewerNavigationTargetId(items, "image-2", "first")).toBe("image-1");
    expect(getMediaViewerNavigationTargetId(items, "image-2", "last")).toBe("image-3");
    expect(getMediaViewerNavigationTargetId(items, "image-1", "previous")).toBeNull();
    expect(getMediaViewerNavigationTargetId(items, "image-3", "next")).toBeNull();
  });

  it("tolera secuencias vacías y selecciones que ya no existen", () => {
    expect(getMediaViewerNavigationTargetId([], "image-1", "next")).toBeNull();
    expect(getMediaViewerNavigationTargetId(items, "missing", "next")).toBeNull();
    expect(getMediaViewerNavigationState(items, "missing")).toEqual({
      currentIndex: -1,
      total: 3,
      canGoPrevious: false,
      canGoNext: false,
    });
    expect(getMediaViewerNavigationState(items, null).currentIndex).toBe(-1);
  });

  it("permite Inicio y Fin para recuperar una selección inconsistente", () => {
    expect(getMediaViewerNavigationTargetId(items, "missing", "first")).toBe("image-1");
    expect(getMediaViewerNavigationTargetId(items, null, "last")).toBe("image-3");
  });

  it("detecta controles editables sin depender del DOM", () => {
    expect(isMediaViewerEditableTarget({ tagName: "input" })).toBe(true);
    expect(isMediaViewerEditableTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isMediaViewerEditableTarget({ tagName: "select" })).toBe(true);
    expect(isMediaViewerEditableTarget({ isContentEditable: true })).toBe(true);
    expect(isMediaViewerEditableTarget({ tagName: "DIV" })).toBe(false);
    expect(isMediaViewerEditableTarget({})).toBe(false);
    expect(isMediaViewerEditableTarget(null)).toBe(false);
  });
});
