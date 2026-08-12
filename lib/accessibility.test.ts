import { describe, expect, it } from "vitest";
import {
    getHorizontalNavigationIndex,
    getVerticalNavigationIndex,
    isKeyboardActivation,
    shouldDismissDialogOnEscape,
} from "./accessibility";

describe("navegación accesible por teclado", () => {
    it("activa controles con Intro y Espacio", () => {
        expect(isKeyboardActivation("Enter")).toBe(true);
        expect(isKeyboardActivation(" ")).toBe(true);
        expect(isKeyboardActivation("Escape")).toBe(false);
    });

    it("recorre horizontalmente las pestañas y respeta Inicio y Fin", () => {
        expect(getHorizontalNavigationIndex(0, 3, "ArrowRight")).toBe(1);
        expect(getHorizontalNavigationIndex(2, 3, "ArrowRight")).toBe(0);
        expect(getHorizontalNavigationIndex(0, 3, "ArrowLeft")).toBe(2);
        expect(getHorizontalNavigationIndex(1, 3, "Home")).toBe(0);
        expect(getHorizontalNavigationIndex(1, 3, "End")).toBe(2);
        expect(getHorizontalNavigationIndex(1, 3, "ArrowDown")).toBeNull();
    });

    it("recorre verticalmente las opciones incluso sin una opción activa", () => {
        expect(getVerticalNavigationIndex(-1, 3, "ArrowDown")).toBe(0);
        expect(getVerticalNavigationIndex(-1, 3, "ArrowUp")).toBe(2);
        expect(getVerticalNavigationIndex(2, 3, "ArrowDown")).toBe(0);
        expect(getVerticalNavigationIndex(0, 3, "ArrowUp")).toBe(2);
        expect(getVerticalNavigationIndex(1, 3, "Home")).toBe(0);
        expect(getVerticalNavigationIndex(1, 3, "End")).toBe(2);
        expect(getVerticalNavigationIndex(1, 0, "ArrowDown")).toBeNull();
    });

    it("respeta un Escape ya gestionado por un control del diálogo", () => {
        expect(shouldDismissDialogOnEscape("Escape", false)).toBe(true);
        expect(shouldDismissDialogOnEscape("Escape", true)).toBe(false);
        expect(shouldDismissDialogOnEscape("Enter", false)).toBe(false);
    });
});
