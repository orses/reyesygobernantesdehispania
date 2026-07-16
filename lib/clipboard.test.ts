import { afterEach, describe, expect, it, vi } from "vitest";
import { copyTextToClipboard } from "./clipboard";

describe("copyTextToClipboard", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("copia el contenido exacto, incluidos espacios y saltos de línea", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", { clipboard: { writeText } });
        const value = "  # Título\n\nTexto final  ";

        await expect(copyTextToClipboard(value)).resolves.toBe(true);
        expect(writeText).toHaveBeenCalledWith(value);
    });

    it("no intenta copiar una cadena vacía", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", { clipboard: { writeText } });

        await expect(copyTextToClipboard("")).resolves.toBe(false);
        expect(writeText).not.toHaveBeenCalled();
    });

    it("usa un área de texto temporal cuando la API del portapapeles no está disponible", async () => {
        const textarea = {
            value: "",
            style: { position: "", left: "" },
            setAttribute: vi.fn(),
            select: vi.fn(),
        };
        const appendChild = vi.fn();
        const removeChild = vi.fn();
        const execCommand = vi.fn().mockReturnValue(true);
        vi.stubGlobal("navigator", {});
        vi.stubGlobal("document", {
            createElement: vi.fn().mockReturnValue(textarea),
            body: { appendChild, removeChild },
            execCommand,
        });

        await expect(copyTextToClipboard("Línea 1\nLínea 2")).resolves.toBe(true);
        expect(textarea.value).toBe("Línea 1\nLínea 2");
        expect(textarea.select).toHaveBeenCalledOnce();
        expect(execCommand).toHaveBeenCalledWith("copy");
        expect(appendChild).toHaveBeenCalledWith(textarea);
        expect(removeChild).toHaveBeenCalledWith(textarea);
    });

    it("informa de que no pudo copiar si no existe un documento", async () => {
        vi.stubGlobal("navigator", {});
        vi.stubGlobal("document", undefined);

        await expect(copyTextToClipboard("Texto")).resolves.toBe(false);
    });
});
