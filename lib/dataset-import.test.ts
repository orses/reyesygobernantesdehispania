// ---------------------------------------------------------------------------
// Pruebas unitarias: frontera común de importación JSON y ZIP.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { createDatasetPayload } from "./dataset-package";
import {
    getStandaloneJsonMediaAssets,
    normalizeDatasetImport,
} from "./dataset-import";

describe("normalizeDatasetImport", () => {
    it.each([
        { version: 1, datos: [] },
        { datos: [] },
        { reyes: [] },
        [{ Nombre: "Pelayo" }],
    ])("acepta el paquete actual y los formatos legados", (input) => {
        expect(normalizeDatasetImport(input)).toMatchObject({ ok: true });
    });

    it.each([2, 0, -1, 1.5, "1", null, undefined])(
        "rechaza una versión incompatible: %j",
        (version) => {
            const result = normalizeDatasetImport({ version, datos: [] });

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error).toContain("versión");
        }
    );

    it.each([
        [{ Nombre: "Pelayo" }, null],
        { datos: [{ Nombre: "Pelayo" }, 7] },
        { reyes: [{ Nombre: "Pelayo" }, []] },
    ])("rechaza filas que no sean objetos", (input) => {
        const result = normalizeDatasetImport(input);

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toContain("fila 2");
    });

    it("rechaza mediaAssets si no es un array", () => {
        const result = normalizeDatasetImport({ version: 1, datos: [], mediaAssets: {} });

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toContain("mediaAssets");
    });

    it.each([
        null,
        { id: "", personId: "1", kind: "external-url", src: "https://example.test/a.jpg" },
        { id: "a", personId: "", kind: "external-url", src: "https://example.test/a.jpg" },
        { id: "a", personId: "1", kind: "desconocido" },
        { id: "a", personId: "1", kind: "external-url", src: "ftp://example.test/a.jpg" },
    ])("rechaza metadatos multimedia no válidos: %j", (asset) => {
        const result = normalizeDatasetImport({ version: 1, datos: [], mediaAssets: [asset] });

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toContain("medio 1");
    });

    it("rechaza identificadores multimedia duplicados", () => {
        const asset = {
            id: "retrato",
            personId: "1",
            kind: "external-url",
            src: "https://example.test/retrato.jpg",
        };
        const result = normalizeDatasetImport({
            version: 1,
            datos: [{ PersonID: "1" }],
            mediaAssets: [asset, asset],
        });

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toContain("duplicado");
    });

    it("elimina storageKey y normaliza los campos obligatorios de un medio portátil", () => {
        const result = normalizeDatasetImport({
            version: 1,
            datos: [{ PersonID: "1" }],
            mediaAssets: [{
                id: 25,
                personId: 1,
                kind: "external-url",
                src: "www.example.test/retrato.jpg",
                storageKey: "reyes_media_blob_ajeno",
            }],
        });

        expect(result).toEqual({
            ok: true,
            value: {
                rows: [{ PersonID: "1" }],
                mediaAssets: [{
                    id: "25",
                    personId: "1",
                    kind: "external-url",
                    src: "https://www.example.test/retrato.jpg",
                    rightsStatus: "unknown",
                    isPrimary: false,
                    createdAt: "1970-01-01T00:00:00.000Z",
                }],
            },
        });
    });

    it("conserva mediaAssets como undefined cuando el formato legado no los declara", () => {
        const result = normalizeDatasetImport({ datos: [{ PersonID: "1" }] });

        expect(result).toEqual({
            ok: true,
            value: { rows: [{ PersonID: "1" }] },
        });
    });

    it("acepta el payload generado por la exportación oficial", () => {
        const payload = createDatasetPayload(
            [{ PersonID: "1", Nombre: "Pelayo" }],
            [{
                id: "retrato-1",
                personId: "1",
                kind: "external-url",
                src: "https://example.test/pelayo.jpg",
                rightsStatus: "public-domain",
                isPrimary: true,
                createdAt: "2026-01-01T00:00:00.000Z",
            }],
            "2026-01-01T00:00:00.000Z",
            "Gobernantes"
        );

        expect(normalizeDatasetImport(payload)).toMatchObject({
            ok: true,
            value: {
                rows: [{ PersonID: "1", Nombre: "Pelayo" }],
                mediaAssets: [{ id: "retrato-1", personId: "1" }],
            },
        });
    });

    it("descarta en JSON los medios subidos que no pueden transportar su blob", () => {
        const uploaded = {
            id: "subido",
            personId: "1",
            kind: "uploaded-file" as const,
            src: "",
            rightsStatus: "unknown" as const,
            isPrimary: true,
            createdAt: "2026-01-01T00:00:00.000Z",
        };
        const external = {
            ...uploaded,
            id: "externo",
            kind: "external-url" as const,
            src: "https://example.test/retrato.jpg",
        };

        expect(getStandaloneJsonMediaAssets(undefined)).toBeUndefined();
        expect(getStandaloneJsonMediaAssets([])).toEqual([]);
        expect(getStandaloneJsonMediaAssets([uploaded, external])).toEqual([external]);
    });
});
