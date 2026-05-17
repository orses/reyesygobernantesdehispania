// ---------------------------------------------------------------------------
// Helpers puros para exportar paquetes portables de datos y medios.
// ---------------------------------------------------------------------------

import type { MediaAsset, RawRow } from "./types";
import { validateZipPath } from "./zip";

export const DATASET_PACKAGE_VERSION = 1;

export interface DatasetPackagePayload {
    version: typeof DATASET_PACKAGE_VERSION;
    exportedAt: string;
    datos: Record<string, unknown>[];
    mediaAssets: MediaAsset[];
}

const MIME_EXTENSIONS: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
};

export function cleanRowsForExport(rows: RawRow[]): Record<string, unknown>[] {
    return rows.map((row) => {
        const { _duracionCalc, _duracionFuente, _rowId, ...rest } = row;
        return rest;
    });
}

export function getExportFileName(datasetName: string, extension: "json" | "csv" | "zip"): string {
    const base = String(datasetName || "datos")
        .trim()
        .replace(/\.(json|csv|zip)$/i, "")
        .trim() || "datos";

    return `${base}.${extension}`;
}

export function safePackageFileName(value: unknown, fallback: string): string {
    const cleaned = String(value ?? "")
        .trim()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[<>:"/\\|?*]/g, "-")
        .split("")
        .map((character) => (character.charCodeAt(0) < 32 ? "-" : character))
        .join("")
        .replace(/\s+/g, " ")
        .replace(/^\.+|\.+$/g, "")
        .slice(0, 120)
        .trim();

    return cleaned || fallback;
}

function extensionFromFileName(fileName: string | undefined): string {
    const match = String(fileName ?? "").match(/\.[a-z0-9]{2,8}$/i);
    return match ? match[0].toLowerCase() : "";
}

function extensionFromMimeType(mimeType: string | undefined): string {
    return MIME_EXTENSIONS[String(mimeType ?? "").toLowerCase()] ?? "";
}

export function createMediaPackagePath(asset: MediaAsset): string {
    const safeId = safePackageFileName(asset.id, "media");
    const safeName = safePackageFileName(asset.fileName || asset.title || asset.id, "imagen");
    const hasExtension = /\.[a-z0-9]{2,8}$/i.test(safeName);
    const extension = hasExtension
        ? ""
        : extensionFromFileName(asset.fileName) || extensionFromMimeType(asset.mimeType) || ".bin";

    return validateZipPath(`media/${safeId}-${safeName}${extension}`);
}

export function toPortableMediaAsset(asset: MediaAsset, packagePath?: string): MediaAsset {
    const { storageKey: _storageKey, packagePath: _packagePath, ...portable } = asset;
    return packagePath ? { ...portable, packagePath } : portable;
}

export function createDatasetPayload(
    rows: RawRow[],
    mediaAssets: MediaAsset[],
    exportedAt = new Date().toISOString()
): DatasetPackagePayload {
    return {
        version: DATASET_PACKAGE_VERSION,
        exportedAt,
        datos: cleanRowsForExport(rows),
        mediaAssets: mediaAssets.map((asset) => toPortableMediaAsset(asset)),
    };
}
