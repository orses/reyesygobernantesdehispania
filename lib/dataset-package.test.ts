// ---------------------------------------------------------------------------
// Tests unitarios: lib/dataset-package.ts
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
    cleanRowsForExport,
    createDatasetPayload,
    createMediaPackagePath,
    getExportFileName,
    safePackageFileName,
    toPortableMediaAsset,
} from "./dataset-package";
import type { MediaAsset, RawRow } from "./types";

const uploadedAsset: MediaAsset = {
    id: "media-101",
    personId: "101",
    kind: "uploaded-file",
    src: "",
    storageKey: "reyes_media_blob_media-101",
    title: "Retrato de Pelayo",
    fileName: "Pelayo original.png",
    mimeType: "image/png",
    rightsStatus: "unknown",
    isPrimary: true,
    createdAt: "2026-01-01T00:00:00.000Z",
};

describe("cleanRowsForExport", () => {
    it("elimina campos internos calculados", () => {
        const rows: RawRow[] = [
            {
                Nombre: "Pelayo",
                _rowId: "row-1",
                _duracionCalc: 19,
                _duracionFuente: "inicio/fin",
            },
        ];

        expect(cleanRowsForExport(rows)).toEqual([{ Nombre: "Pelayo" }]);
    });
});

describe("getExportFileName", () => {
    it("sustituye extensiones conocidas y conserva el nombre base", () => {
        expect(getExportFileName("datos.csv", "json")).toBe("datos.json");
        expect(getExportFileName("datos.json", "zip")).toBe("datos.zip");
        expect(getExportFileName("", "csv")).toBe("datos.csv");
    });
});

describe("safePackageFileName", () => {
    it("limpia caracteres incompatibles con rutas ZIP portables", () => {
        expect(safePackageFileName(" Pelayo:/original?.png ", "imagen")).toBe("Pelayo--original-.png");
        expect(safePackageFileName("...", "imagen")).toBe("imagen");
    });
});

describe("createMediaPackagePath", () => {
    it("crea una ruta interna bajo media con extensión preservada", () => {
        expect(createMediaPackagePath(uploadedAsset)).toBe("media/media-101-Pelayo original.png");
    });

    it("usa la extensión del tipo MIME si el nombre no la trae", () => {
        expect(createMediaPackagePath({ ...uploadedAsset, fileName: "pelayo", mimeType: "image/webp" })).toBe(
            "media/media-101-pelayo.webp"
        );
    });
});

describe("toPortableMediaAsset y createDatasetPayload", () => {
    it("elimina storageKey al preparar metadatos exportables", () => {
        const portable = toPortableMediaAsset(uploadedAsset, "media/media-101-Pelayo original.png");

        expect(portable.storageKey).toBeUndefined();
        expect(portable.packagePath).toBe("media/media-101-Pelayo original.png");
    });

    it("genera un payload JSON portable", () => {
        const payload = createDatasetPayload([{ Nombre: "Pelayo", _rowId: "row-1" }], [uploadedAsset], "2026-01-01T00:00:00.000Z");

        expect(payload).toMatchObject({
            version: 1,
            exportedAt: "2026-01-01T00:00:00.000Z",
            datos: [{ Nombre: "Pelayo" }],
        });
        expect(payload.mediaAssets[0].storageKey).toBeUndefined();
    });
});
