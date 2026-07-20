import { describe, expect, it, vi } from "vitest";
import {
  handleEditorKeyboardShortcut,
  resolveEditorKeyboardShortcut,
  type EditorKeyboardEvent,
} from "./editor-keyboard-shortcuts";

function keyboardEvent(
  overrides: Partial<EditorKeyboardEvent> = {}
): EditorKeyboardEvent {
  return {
    key: "",
    preventDefault: vi.fn(),
    ...overrides,
  };
}

describe("atajos de teclado del editor", () => {
  it("cierra el editor al pulsar Escape", () => {
    const event = keyboardEvent({ key: "Escape" });
    const onCancel = vi.fn();
    const onSave = vi.fn();

    expect(
      handleEditorKeyboardShortcut(event, {
        canSave: true,
        onCancel,
        onSave,
      })
    ).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("guarda al pulsar Ctrl+G y conserva el editor abierto", () => {
    const event = keyboardEvent({ key: "g", ctrlKey: true });
    const onCancel = vi.fn();
    const onSave = vi.fn();

    handleEditorKeyboardShortcut(event, {
      canSave: true,
      onCancel,
      onSave,
    });

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("bloquea el guardado cuando el contenido JSON no es válido", () => {
    const event = keyboardEvent({ key: "G", ctrlKey: true });
    const onSave = vi.fn();

    expect(
      handleEditorKeyboardShortcut(event, {
        canSave: false,
        onCancel: vi.fn(),
        onSave,
      })
    ).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("no intercepta otras pulsaciones", () => {
    const event = keyboardEvent({ key: "Enter" });
    const onCancel = vi.fn();
    const onSave = vi.fn();

    expect(
      handleEditorKeyboardShortcut(event, {
        canSave: true,
        onCancel,
        onSave,
      })
    ).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it.each([
    { key: "g" },
    { key: "g", ctrlKey: true, shiftKey: true },
    { key: "g", ctrlKey: true, altKey: true },
    { key: "g", metaKey: true },
    { key: "Escape", isComposing: true },
  ])("ignora una combinación ajena al editor: %o", (event) => {
    expect(resolveEditorKeyboardShortcut(event)).toBeNull();
  });
});
