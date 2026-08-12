// ---------------------------------------------------------------------------
// Pruebas unitarias e integradas: preparación de archivos de datos.
// ---------------------------------------------------------------------------

import { describe, expect, it, vi } from "vitest";
import {
    assertDatasetTextFileSize,
    prepareDatasetTextImport,
    prepareDatasetZipImport,
} from "./dataset-file-import";
import { createStoredZip, parseZip } from "./zip";

const encoder = new TextEncoder();

describe("assertDatasetTextFileSize", () => {
    it("acepta el límite exacto y rechaza un byte adicional", () => {
        expect(() => assertDatasetTextFileSize(10, 10)).not.toThrow();
        expect(() => assertDatasetTextFileSize(11, 10)).toThrow(/supera el tamaño/);
    });

    it("rechaza tamaños y límites no válidos", () => {
        expect(() => assertDatasetTextFileSize(-1, 10)).toThrow(/tamaño/);
        expect(() => assertDatasetTextFileSize(1, Number.POSITIVE_INFINITY)).toThrow(/límite/);
    });
});

describe("prepareDatasetTextImport", () => {
    it("devuelve filas y diagnóstico de dialecto para CSV", () => {
        const result = prepareDatasetTextImport("Nombre;Reino\nPelayo;Asturias", "csv");

        expect(result).toEqual({
            ok: true,
            value: {
                rows: [{ Nombre: "Pelayo", Reino: "Asturias" }],
                rawText: "Nombre;Reino\nPelayo;Asturias",
                detectedDelimiter: ";",
                detectedQuotes: false,
            },
        });
    });

    it("propaga los errores estructurales de CSV", () => {
        const result = prepareDatasetTextImport('Nombre;Reino\n"Pelayo;Asturias', "csv");

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toContain("comillas sin cerrar");
    });

    it("valida la versión del JSON y conserva su nombre interno", () => {
        const valid = prepareDatasetTextImport(JSON.stringify({
            version: 1,
            datasetName: "Monarquía asturiana",
            datos: [{ PersonID: "1", Nombre: "Pelayo" }],
        }), "json");
        const invalid = prepareDatasetTextImport(
            JSON.stringify({ version: 2, datos: [] }),
            "json"
        );

        expect(valid).toMatchObject({
            ok: true,
            value: {
                rows: [{ PersonID: "1", Nombre: "Pelayo" }],
                payloadDatasetName: "Monarquía asturiana",
            },
        });
        expect(invalid.ok).toBe(false);
        if (!invalid.ok) expect(invalid.error).toContain("versión");
    });

    it("conserva la alternativa heredada y elimina medios subidos sin blob en JSON", () => {
        const legacy = prepareDatasetTextImport('{"datos":[]}', "json");
        const portable = prepareDatasetTextImport(JSON.stringify({
            version: 1,
            datos: [{ PersonID: "1" }],
            mediaAssets: [{
                id: "subido",
                personId: "1",
                kind: "uploaded-file",
                src: "",
            }],
        }), "json");

        expect(legacy).toMatchObject({ ok: true, value: { mediaAssets: undefined } });
        expect(portable).toMatchObject({ ok: true, value: { mediaAssets: [] } });
    });
});

describe("prepareDatasetZipImport", () => {
    it("acepta datos.json cuando ocupa exactamente el límite configurado", () => {
        const data = encoder.encode('{"datos":[]}');

        const result = prepareDatasetZipImport({
            entries: [{ path: "datos.json", data }],
            createRuntimeId: () => "id",
            maxTextBytes: data.byteLength,
        });

        expect(result).toMatchObject({ ok: true, value: { rows: [] } });
    });

    it("rechaza datos.json un byte por encima del límite antes de decodificarlo", () => {
        const validJsonWithTrailingSpace = encoder.encode('{"datos":[]} ');
        const decodeSpy = vi.spyOn(TextDecoder.prototype, "decode");

        try {
            const result = prepareDatasetZipImport({
                entries: [{ path: "datos.json", data: validJsonWithTrailingSpace }],
                createRuntimeId: () => "id",
                maxTextBytes: validJsonWithTrailingSpace.byteLength - 1,
            });

            expect(result).toEqual({
                ok: false,
                error: "ZIP inválido: datos.json supera el tamaño permitido.",
            });
            expect(decodeSpy).not.toHaveBeenCalled();
        } finally {
            decodeSpy.mockRestore();
        }
    });

    it("rechaza un paquete sin datos.json o con el manifiesto duplicado", () => {
        const createRuntimeId = () => "id";
        const missing = prepareDatasetZipImport({
            entries: [{ path: "media/a.jpg", data: new Uint8Array([1]) }],
            createRuntimeId,
        });
        const duplicated = prepareDatasetZipImport({
            entries: [
                { path: "datos.json", data: encoder.encode('{"datos":[]}') },
                { path: "datos.json", data: encoder.encode('{"datos":[]}') },
            ],
            createRuntimeId,
        });

        expect(missing).toEqual({ ok: false, error: "ZIP inválido: falta datos.json." });
        expect(duplicated).toEqual({
            ok: false,
            error: "ZIP inválido: datos.json está duplicado.",
        });
    });

    it("prepara filas, metadatos y blobs desde un ZIP real sin escribir estado", async () => {
        const payload = {
            version: 1,
            datasetName: "Gobernantes",
            datos: [{ PersonID: "1", Nombre: "Pelayo" }],
            mediaAssets: [{
                id: "retrato",
                personId: "1",
                kind: "uploaded-file",
                src: "",
                packagePath: "media/pelayo.jpg",
            }],
        };
        const entries = await parseZip(createStoredZip([
            { path: "datos.json", data: JSON.stringify(payload) },
            { path: "media/pelayo.jpg", data: new Uint8Array([1, 2, 3]) },
        ]));
        let sequence = 0;

        const result = prepareDatasetZipImport({
            entries,
            createRuntimeId: (purpose) => `${purpose}-${++sequence}`,
        });

        expect(result).toMatchObject({
            ok: true,
            value: {
                rows: [{ PersonID: "1", Nombre: "Pelayo" }],
                payloadDatasetName: "Gobernantes",
                mediaAssets: [{
                    id: "retrato",
                    personId: "1",
                    kind: "uploaded-file",
                    storageKey: "reyes_media_blob_media-storage-1",
                }],
            },
        });
        if (!result.ok) return;
        expect(result.value.blobEntries).toHaveLength(1);
        expect(result.value.blobEntries?.[0][1]).toBeInstanceOf(Blob);
    });

    it("devuelve errores de JSON y referencias multimedia sin publicar datos parciales", () => {
        const malformed = prepareDatasetZipImport({
            entries: [{ path: "datos.json", data: encoder.encode("{") }],
            createRuntimeId: () => "id",
        });
        const missingMedia = prepareDatasetZipImport({
            entries: [{
                path: "datos.json",
                data: encoder.encode(JSON.stringify({
                    version: 1,
                    datos: [{ PersonID: "1" }],
                    mediaAssets: [{
                        id: "retrato",
                        personId: "1",
                        kind: "uploaded-file",
                        src: "",
                        packagePath: "media/ausente.jpg",
                    }],
                })),
            }],
            createRuntimeId: () => "id",
        });

        expect(malformed.ok).toBe(false);
        if (!malformed.ok) expect(malformed.error).toContain("JSON inválido dentro del ZIP");
        expect(missingMedia.ok).toBe(false);
        if (!missingMedia.ok) expect(missingMedia.error).toContain("falta el archivo multimedia");
    });

    it("devuelve una revisión estructurada con todas las referencias huérfanas", () => {
        const payload = {
            version: 1,
            datos: [
                {
                    PersonID: "1",
                    Nombre: "Pelayo",
                    Reino: "Reino de Asturias",
                    "Inicio del reinado (año)": 718,
                    "Final del reinado (año)": 737,
                },
                {
                    PersonID: "2",
                    Nombre: "Alfonso I",
                    Reino: "Reino de Asturias",
                    "Inicio del reinado (año)": 739,
                },
            ],
            mediaAssets: [
                {
                    id: "externo-huérfano",
                    personId: "69",
                    kind: "external-url",
                    src: "https://imagenes.test/gonzalo.jpg",
                    sourceUrl: "https://fuente.test/gonzalo",
                    title: "Gonzalo Téllez",
                },
                {
                    id: "archivo-huérfano",
                    personId: "70",
                    kind: "uploaded-file",
                    src: "",
                    fileName: "retrato.png",
                    packagePath: "media/retrato.png",
                },
            ],
        };
        const result = prepareDatasetZipImport({
            entries: [
                { path: "datos.json", data: encoder.encode(JSON.stringify(payload)) },
                { path: "media/retrato.png", data: new Uint8Array([1, 2, 3]) },
            ],
            createRuntimeId: () => "id",
        });

        expect(result).toMatchObject({
            ok: false,
            error: "ZIP inválido: 2 medios hacen referencia a PersonID inexistentes.",
            review: {
                kind: "orphan-media-person-references",
                issues: [
                    {
                        mediaIndex: 0,
                        jsonPath: "mediaAssets[0].personId",
                        mediaId: "externo-huérfano",
                        personId: "69",
                        url: "https://imagenes.test/gonzalo.jpg",
                        sourceUrl: "https://fuente.test/gonzalo",
                    },
                    {
                        mediaIndex: 1,
                        jsonPath: "mediaAssets[1].personId",
                        mediaId: "archivo-huérfano",
                        personId: "70",
                        fileName: "retrato.png",
                        packagePath: "media/retrato.png",
                    },
                ],
                candidates: [
                    {
                        personId: "1",
                        name: "Pelayo",
                        contexts: ["Reino de Asturias · 718–737"],
                    },
                    {
                        personId: "2",
                        name: "Alfonso I",
                        contexts: ["Reino de Asturias · 739–…"],
                    },
                ],
            },
        });
    });

    it("revalida y aplica un plan completo antes de preparar metadatos o blobs", () => {
        const payload = {
            version: 1,
            datos: [{ PersonID: "1", Nombre: "Pelayo" }],
            mediaAssets: [
                {
                    id: "externo-huérfano",
                    personId: "69",
                    kind: "external-url",
                    src: "https://imagenes.test/gonzalo.jpg",
                },
                {
                    id: "archivo-huérfano",
                    personId: "70",
                    kind: "uploaded-file",
                    src: "",
                    packagePath: "media/retrato.png",
                },
            ],
        };
        const entries = [
            { path: "datos.json", data: encoder.encode(JSON.stringify(payload)) },
            { path: "media/retrato.png", data: new Uint8Array([1, 2, 3]) },
        ];
        const initial = prepareDatasetZipImport({
            entries,
            createRuntimeId: () => "id",
        });
        expect(initial.ok).toBe(false);
        if (initial.ok || !initial.review) return;

        const createRuntimeId = vi.fn(() => "id");
        const repaired = prepareDatasetZipImport({
            entries,
            createRuntimeId,
            repairs: [
                {
                    issueId: initial.review.issues[0].issueId,
                    action: "reassign",
                    personId: "1",
                },
                {
                    issueId: initial.review.issues[1].issueId,
                    action: "omit",
                },
            ],
        });

        expect(repaired).toMatchObject({
            ok: true,
            value: {
                mediaAssets: [{
                    id: "externo-huérfano",
                    personId: "1",
                    kind: "external-url",
                }],
                blobEntries: [],
            },
        });
        expect(createRuntimeId).not.toHaveBeenCalled();
    });

    it("rechaza una reparación parcial sin preparar claves de almacenamiento", () => {
        const payload = {
            version: 1,
            datos: [{ PersonID: "1", Nombre: "Pelayo" }],
            mediaAssets: [
                {
                    id: "primero",
                    personId: "69",
                    kind: "external-url",
                    src: "https://imagenes.test/primero.jpg",
                },
                {
                    id: "segundo",
                    personId: "70",
                    kind: "external-url",
                    src: "https://imagenes.test/segundo.jpg",
                },
            ],
        };
        const entries = [{
            path: "datos.json",
            data: encoder.encode(JSON.stringify(payload)),
        }];
        const initial = prepareDatasetZipImport({ entries, createRuntimeId: () => "id" });
        expect(initial.ok).toBe(false);
        if (initial.ok || !initial.review) return;

        const createRuntimeId = vi.fn(() => "no-debe-usarse");
        const result = prepareDatasetZipImport({
            entries,
            createRuntimeId,
            repairs: [{ issueId: initial.review.issues[0].issueId, action: "omit" }],
        });

        expect(result).toMatchObject({
            ok: false,
            error: "ZIP inválido: Falta resolver una incidencia multimedia.",
            review: { issues: initial.review.issues },
        });
        expect(createRuntimeId).not.toHaveBeenCalled();
    });
});
