// ---------------------------------------------------------------------------
// Tests unitarios: lib/zip.ts
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { createStoredZip, parseStoredZip, validateZipPath } from "./zip";

const decoder = new TextDecoder();

function textOf(data: Uint8Array): string {
    return decoder.decode(data);
}

describe("createStoredZip y parseStoredZip", () => {
    it("crea y lee un paquete ZIP sin compresión", () => {
        const zip = createStoredZip([
            { path: "datos.json", data: JSON.stringify({ datos: [{ Nombre: "Pelayo" }] }) },
            { path: "media/pelayo.txt", data: "imagen simulada" },
        ]);

        const entries = parseStoredZip(zip);

        expect(entries.map((entry) => entry.path)).toEqual(["datos.json", "media/pelayo.txt"]);
        expect(JSON.parse(textOf(entries[0].data))).toEqual({ datos: [{ Nombre: "Pelayo" }] });
        expect(textOf(entries[1].data)).toBe("imagen simulada");
    });

    it("rechaza rutas peligrosas", () => {
        expect(() => validateZipPath("../datos.json")).toThrow(/Ruta ZIP no válida/);
        expect(() => validateZipPath("/datos.json")).toThrow(/Ruta ZIP no válida/);
        expect(() => validateZipPath("C:/datos.json")).toThrow(/Ruta ZIP no válida/);
        expect(() => validateZipPath("media/../datos.json")).toThrow(/Ruta ZIP no válida/);
    });

    it("normaliza separadores internos de Windows sin permitir rutas absolutas", () => {
        expect(validateZipPath("media\\pelayo.jpg")).toBe("media/pelayo.jpg");
    });

    it("rechaza rutas duplicadas al crear el paquete", () => {
        expect(() =>
            createStoredZip([
                { path: "datos.json", data: "{}" },
                { path: "datos.json", data: "{}" },
            ])
        ).toThrow(/duplicada/);
    });
});
