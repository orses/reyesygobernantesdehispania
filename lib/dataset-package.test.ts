// ---------------------------------------------------------------------------
// Tests unitarios: lib/dataset-package.ts
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
    cleanRowsForExport,
    createDatasetPayload,
    createMediaPackagePath,
    createMediaPrintPackagePath,
    createUploadedMediaPackage,
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

const pngSignature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function writeUint32BE(target: Uint8Array, offset: number, value: number): void {
    target[offset] = (value >>> 24) & 0xff;
    target[offset + 1] = (value >>> 16) & 0xff;
    target[offset + 2] = (value >>> 8) & 0xff;
    target[offset + 3] = value & 0xff;
}

function chunk(type: string, payload: number[] = []): Uint8Array {
    const output = new Uint8Array(12 + payload.length);
    writeUint32BE(output, 0, payload.length);
    for (let index = 0; index < 4; index++) {
        output[4 + index] = type.charCodeAt(index);
    }
    output.set(payload, 8);
    return output;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
    const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
    let offset = 0;
    for (const part of parts) {
        output.set(part, offset);
        offset += part.length;
    }
    return output;
}

function minimalPng(): Uint8Array {
    return concatBytes(
        pngSignature,
        chunk("IHDR", [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]),
        chunk("IDAT", [1, 2, 3]),
        chunk("IEND")
    );
}

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

describe("createMediaPrintPackagePath", () => {
    it("crea una ruta documental separada por DPI", () => {
        expect(createMediaPrintPackagePath(uploadedAsset, 300)).toBe(
            "media-documento/300dpi/media-101-Pelayo original.png"
        );
        expect(createMediaPrintPackagePath(uploadedAsset, 600)).toBe(
            "media-documento/600dpi/media-101-Pelayo original.png"
        );
    });
});

describe("toPortableMediaAsset y createDatasetPayload", () => {
    it("elimina storageKey al preparar metadatos exportables", () => {
        const portable = toPortableMediaAsset(
            {
                ...uploadedAsset,
                printPackagePath: "media-documento/300dpi/antigua.png",
                printDpi: 300,
            },
            "media/media-101-Pelayo original.png"
        );

        expect(portable.storageKey).toBeUndefined();
        expect(portable.packagePath).toBe("media/media-101-Pelayo original.png");
        expect(portable.printPackagePath).toBeUndefined();
        expect(portable.printDpi).toBeUndefined();
    });

    it("incluye metadatos de variante documental cuando se pasan explícitamente", () => {
        const portable = toPortableMediaAsset(
            uploadedAsset,
            "media/media-101-Pelayo original.png",
            {
                printPackagePath: "media-documento/300dpi/media-101-Pelayo original.png",
                printDpi: 300,
            }
        );

        expect(portable).toMatchObject({
            packagePath: "media/media-101-Pelayo original.png",
            printPackagePath: "media-documento/300dpi/media-101-Pelayo original.png",
            printDpi: 300,
        });
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

describe("createUploadedMediaPackage", () => {
    it("empaqueta solo el original con el perfil original", () => {
        const data = minimalPng();
        const result = createUploadedMediaPackage(uploadedAsset, data, "original");

        expect(result).toMatchObject({
            skippedPrintVariant: false,
            portableAsset: {
                packagePath: "media/media-101-Pelayo original.png",
            },
        });
        expect(result.portableAsset.printPackagePath).toBeUndefined();
        expect(result.portableAsset.printDpi).toBeUndefined();
        expect(result.entries).toEqual([{ path: "media/media-101-Pelayo original.png", data }]);
    });

    it("añade una variante documental a 300 ppp sin reemplazar el original", () => {
        const data = minimalPng();
        const result = createUploadedMediaPackage(uploadedAsset, data, "300dpi");

        expect(result.skippedPrintVariant).toBe(false);
        expect(result.entries.map((entry) => entry.path)).toEqual([
            "media/media-101-Pelayo original.png",
            "media-documento/300dpi/media-101-Pelayo original.png",
        ]);
        expect(result.entries[0].data).toBe(data);
        expect(result.entries[1].data).not.toBe(data);
        expect(result.portableAsset).toMatchObject({
            packagePath: "media/media-101-Pelayo original.png",
            printPackagePath: "media-documento/300dpi/media-101-Pelayo original.png",
            printDpi: 300,
        });
    });

    it("mantiene el original y avisa si el formato no admite variante documental automática", () => {
        const asset: MediaAsset = { ...uploadedAsset, mimeType: "image/webp", fileName: "pelayo.webp" };
        const data = new Uint8Array([1, 2, 3]);
        const result = createUploadedMediaPackage(asset, data, "600dpi");

        expect(result.skippedPrintVariant).toBe(true);
        expect(result.entries).toEqual([{ path: "media/media-101-pelayo.webp", data }]);
        expect(result.portableAsset.printPackagePath).toBeUndefined();
        expect(result.portableAsset.printDpi).toBeUndefined();
    });
});
