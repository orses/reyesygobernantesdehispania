import { describe, expect, it } from "vitest";
import {
  hasBlockingModal,
  isOpenPersonEditorShortcut,
} from "./person-editor-keyboard-shortcut";

describe("atajo de teclado del editor del rey", () => {
  it.each(["e", "E"])("reconoce Alt+%s", (key) => {
    expect(isOpenPersonEditorShortcut({ key, altKey: true })).toBe(true);
  });

  it.each([
    { key: "e" },
    { key: "e", altKey: true, ctrlKey: true },
    { key: "e", altKey: true, metaKey: true },
    { key: "e", altKey: true, shiftKey: true },
    { key: "e", altKey: true, isComposing: true },
    { key: "g", altKey: true },
  ])("ignora una combinación distinta: %o", (event) => {
    expect(isOpenPersonEditorShortcut(event)).toBe(false);
  });

  it("detecta un visor modal aunque su estado sea local a otro componente", () => {
    const modal = {};
    const documentLike = {
      querySelector: (selectors: string) => {
        expect(selectors).toContain('[aria-modal="true"]');
        return modal;
      },
    };

    expect(hasBlockingModal(documentLike)).toBe(true);
    expect(hasBlockingModal({ querySelector: () => null })).toBe(false);
  });
});
