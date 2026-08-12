// ---------------------------------------------------------------------------
// Pruebas unitarias e integradas: preparación de la exportación ZIP.
// ---------------------------------------------------------------------------

import { describe, expect, it, vi } from "vitest";
import {
    datasetZipExportBlob,
    datasetZipExportWarning,
    prepareDatasetZipExport,
} from "./dataset-export";
import type { MediaAsset } from "./types";
import { parseZip } from "./zip";

const uploadedAsset = (
    id: string,
    storageKey?: string,
    personId = "1"
): MediaAsset => ({
    id,
    personId,
    kind: "uploaded-file",
    src: "",
    storageKey,
    fileName: `${id}.png`,
    mimeType: "image/png",
    rightsStatus: "unknown",
    isPrimary: true,
    createdAt: "2026-01-01T00:00:00.000Z",
});

describe("prepareDatasetZipExport", () => {
    it("lee todos los blobs mediante un único lote y crea un paquete reimportable", async () => {
        const first = uploadedAsset("primero", "reyes_media_blob_primero");
        const second = uploadedAsset("segundo", "reyes_media_blob_segundo");
        const readMediaBlobs = vi.fn(async (storageKeys: readonly string[]) =>
            storageKeys.map((storageKey) => new Blob(
                [storageKey === first.storageKey
                    ? new Uint8Array([1, 2, 3])
                    : new Uint8Array([4, 5])],
                { type: "image/png" }
            ))
        );

        const result = await prepareDatasetZipExport({
            rows: [{ PersonID: "1", Nombre: "Pelayo", _rowId: "fila-1" }],
            mediaAssets: [first, second],
            datasetName: "Gobernantes",
            exportedAt: new Date(2026, 5, 3, 18, 42),
            readMediaBlobs,
        });

        expect(readMediaBlobs).toHaveBeenCalledOnce();
        expect(readMediaBlobs).toHaveBeenCalledWith([
            "reyes_media_blob_primero",
            "reyes_media_blob_segundo",
        ]);
        expect(result).toMatchObject({
            fileName: "Gobernantes 20260603 - 1842.zip",
            missingUploadedFiles: 0,
            orphanedMediaAssets: 0,
            skippedPrintVariants: 0,
        });

        const entries = await parseZip(result.data);
        expect(entries.map((entry) => entry.path)).toEqual([
            "datos.json",
            "media/primero-primero.png",
            "media/segundo-segundo.png",
        ]);
        const manifestText = new TextDecoder().decode(entries[0].data);
        expect(manifestText).not.toContain("\n  ");
        expect(JSON.parse(manifestText)).toMatchObject({
            version: 1,
            datasetName: "Gobernantes",
            datos: [{ PersonID: "1", Nombre: "Pelayo", _rowId: "fila-1" }],
        });
    });

    it("informa de claves ausentes o no gestionadas sin hacer lecturas individuales", async () => {
        const readMediaBlobs = vi.fn(async () => [undefined]);

        const result = await prepareDatasetZipExport({
            rows: [{ PersonID: "1" }],
            mediaAssets: [
                uploadedAsset("ausente", "reyes_media_blob_ausente"),
                uploadedAsset("no-gestionado", "otra_clave"),
            ],
            datasetName: "Gobernantes",
            readMediaBlobs,
        });

        expect(readMediaBlobs).toHaveBeenCalledOnce();
        expect(result.missingUploadedFiles).toBe(2);
        expect(datasetZipExportWarning(result)).toContain("2 archivo(s)");
        expect((await parseZip(result.data)).map((entry) => entry.path)).toEqual([
            "datos.json",
        ]);
    });

    it("no consulta el almacén cuando no hay archivos subidos", async () => {
        const readMediaBlobs = vi.fn(async () => []);

        const result = await prepareDatasetZipExport({
            rows: [{ PersonID: "1" }],
            mediaAssets: [{
                id: "externo",
                personId: "1",
                kind: "external-url",
                src: "https://example.test/pelayo.jpg",
                rightsStatus: "public-domain",
                isPrimary: true,
                createdAt: "2026-01-01T00:00:00.000Z",
            }],
            datasetName: "Gobernantes",
            readMediaBlobs,
        });

        expect(readMediaBlobs).not.toHaveBeenCalled();
        expect(datasetZipExportWarning(result)).toBeNull();
        expect(datasetZipExportBlob(result)).toBeInstanceOf(Blob);
        expect(datasetZipExportBlob(result).type).toBe("application/zip");
    });

    it("omite todos los medios huérfanos antes de leer blobs o crear el paquete", async () => {
        const active = uploadedAsset(
            "activo",
            "reyes_media_blob_activo",
            "1"
        );
        const orphanedUpload = uploadedAsset(
            "subido-huérfano",
            "reyes_media_blob_huerfano",
            "69"
        );
        const orphanedExternal: MediaAsset = {
            id: "externo-huérfano",
            personId: "69",
            kind: "external-url",
            src: "https://example.test/gonzalo-tellez.jpg",
            rightsStatus: "unknown",
            isPrimary: true,
            createdAt: "1970-01-01T00:00:00.000Z",
        };
        const readMediaBlobs = vi.fn(async () => [
            new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
        ]);

        const result = await prepareDatasetZipExport({
            rows: [{ PersonID: "1", Nombre: "Pelayo" }],
            mediaAssets: [active, orphanedUpload, orphanedExternal],
            datasetName: "Gobernantes",
            readMediaBlobs,
        });

        expect(readMediaBlobs).toHaveBeenCalledOnce();
        expect(readMediaBlobs).toHaveBeenCalledWith(["reyes_media_blob_activo"]);
        expect(result).toMatchObject({
            missingUploadedFiles: 0,
            orphanedMediaAssets: 2,
        });
        expect(datasetZipExportWarning(result)).toContain(
            "medios huérfanos omitidos: 2"
        );

        const entries = await parseZip(result.data);
        expect(entries.map((entry) => entry.path)).toEqual([
            "datos.json",
            "media/activo-activo.png",
        ]);
        const manifest = JSON.parse(new TextDecoder().decode(entries[0].data));
        expect(manifest.mediaAssets).toHaveLength(1);
        expect(manifest.mediaAssets[0]).toMatchObject({
            id: "activo",
            personId: "1",
        });
    });

    it("no lee IndexedDB cuando todos los archivos subidos son huérfanos", async () => {
        const readMediaBlobs = vi.fn(async () => []);

        const result = await prepareDatasetZipExport({
            rows: [{ PersonID: "1" }],
            mediaAssets: [uploadedAsset(
                "huérfano",
                "reyes_media_blob_huerfano",
                "69"
            )],
            datasetName: "Gobernantes",
            readMediaBlobs,
        });

        expect(readMediaBlobs).not.toHaveBeenCalled();
        expect(result.orphanedMediaAssets).toBe(1);
        expect((await parseZip(result.data)).map((entry) => entry.path)).toEqual([
            "datos.json",
        ]);
    });

    it("rechaza lectores por lotes que devuelven una cardinalidad incoherente", async () => {
        await expect(prepareDatasetZipExport({
            rows: [{ PersonID: "1" }],
            mediaAssets: [uploadedAsset("uno", "reyes_media_blob_uno")],
            datasetName: "Gobernantes",
            readMediaBlobs: async () => [],
        })).rejects.toThrow(/un resultado por cada clave/);
    });
});
