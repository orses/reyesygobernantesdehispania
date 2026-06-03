// ---------------------------------------------------------------------------
// Helpers puros para exportar paquetes portables de datos y medios.
// ---------------------------------------------------------------------------

import type { MediaAsset, RawRow } from "./types";
import {
    dpiForPrintResolutionProfile,
    setPrintResolutionDpi,
    type ImagePrintResolutionProfile,
} from "./print-resolution";
import { validateZipPath } from "./zip";

export const DATASET_PACKAGE_VERSION = 1;

export interface DatasetPackagePayload {
    version: typeof DATASET_PACKAGE_VERSION;
    datasetName: string;
    exportedAt: string;
    datos: Record<string, unknown>[];
    mediaAssets: MediaAsset[];
}

export interface MediaPackageEntry {
    path: string;
    data: Uint8Array;
}

export interface UploadedMediaPackageResult {
    portableAsset: MediaAsset;
    entries: MediaPackageEntry[];
    skippedPrintVariant: boolean;
}

const MIME_EXTENSIONS: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
};

const FALLBACK_DATASET_NAME = "datos";
const GENERIC_IMPORT_BASE_NAMES = new Set([
    "backup",
    "copia",
    "completa",
    "completo",
    "data",
    "dataset",
    "datos",
    "export",
    "exportacion",
    "exportación",
    "respaldo",
    "zip completo",
]);

interface ResolveImportedDatasetNameInput {
    currentDatasetName?: string | null;
    fileName?: string | null;
    payloadDatasetName?: unknown;
}

export function cleanRowsForExport(rows: RawRow[]): Record<string, unknown>[] {
    return rows.map((row) => {
        const { _duracionCalc, _duracionFuente, _rowId, ...rest } = row;
        return rest;
    });
}

function stripKnownExportExtension(value: string): string {
    return value.replace(/\.(json|csv|zip)$/i, "").trim();
}

function stripBrowserDuplicateSuffix(value: string): string {
    return value.replace(/\s+\(\d+\)$/u, "").trim();
}

function stripTimestampSuffix(value: string): string {
    return value
        .replace(
            /(?:[\s_-]+)(?:19|20)\d{2}[01]\d[0-3]\d(?:\s*[-_]\s*(?:\d{1,4}))?$/u,
            ""
        )
        .replace(
            /(?:[\s_-]+)(?:19|20)\d{2}[-.][01]\d[-.][0-3]\d(?:\s*[-_]\s*(?:\d{1,4}))?$/u,
            ""
        )
        .trim();
}

function cleanDatasetFileNameCharacters(value: string): string {
    return value
        .replace(/[<>:"/\\|?*]/g, "-")
        .split("")
        .map((character) => (character.charCodeAt(0) < 32 ? "-" : character))
        .join("")
        .replace(/\s+/g, " ")
        .replace(/^\.+|\.+$/g, "")
        .trim();
}

function isGenericImportBaseName(value: string): boolean {
    const normalized = value
        .trim()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");

    return GENERIC_IMPORT_BASE_NAMES.has(normalized);
}

function padDatePart(value: number): string {
    return String(value).padStart(2, "0");
}

function timestampParts(date: Date): { date: string; time: string } {
    return {
        date: [
            date.getFullYear(),
            padDatePart(date.getMonth() + 1),
            padDatePart(date.getDate()),
        ].join(""),
        time: [
            padDatePart(date.getHours()),
            padDatePart(date.getMinutes()),
        ].join(""),
    };
}

export function normalizeDatasetBaseName(value: unknown, fallback = FALLBACK_DATASET_NAME): string {
    const fallbackName =
        cleanDatasetFileNameCharacters(String(fallback || FALLBACK_DATASET_NAME)) || FALLBACK_DATASET_NAME;
    const raw = String(value ?? "").trim();
    if (!raw) return fallbackName;

    const cleaned = cleanDatasetFileNameCharacters(
        stripTimestampSuffix(stripBrowserDuplicateSuffix(stripKnownExportExtension(raw)))
    );

    return cleaned || fallbackName;
}

export function getExportFileName(datasetName: string, extension: "json" | "csv" | "zip"): string {
    const base = normalizeDatasetBaseName(datasetName);

    return `${base}.${extension}`;
}

export function getTimestampedExportFileName(
    datasetName: string,
    extension: "json" | "csv" | "zip",
    exportedAt: Date = new Date()
): string {
    const base = normalizeDatasetBaseName(datasetName);
    const { date, time } = timestampParts(exportedAt);

    return `${base} ${date} - ${time}.${extension}`;
}

export function readDatasetNameFromPayload(value: unknown): string | undefined {
    if (!value || typeof value !== "object") return undefined;
    const datasetName = (value as { datasetName?: unknown }).datasetName;
    if (typeof datasetName !== "string" || !datasetName.trim()) return undefined;

    return normalizeDatasetBaseName(datasetName);
}

export function resolveImportedDatasetName({
    currentDatasetName,
    fileName,
    payloadDatasetName,
}: ResolveImportedDatasetNameInput): string {
    const payloadName = readDatasetNameFromPayload({ datasetName: payloadDatasetName });
    if (payloadName) return payloadName;

    const currentBaseName = normalizeDatasetBaseName(currentDatasetName);
    const fileBaseName = normalizeDatasetBaseName(fileName);
    if (isGenericImportBaseName(fileBaseName)) return currentBaseName;

    return fileBaseName;
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

export function createMediaPrintPackagePath(asset: MediaAsset, dpi: number): string {
    const safeId = safePackageFileName(asset.id, "media");
    const safeName = safePackageFileName(asset.fileName || asset.title || asset.id, "imagen");
    const hasExtension = /\.[a-z0-9]{2,8}$/i.test(safeName);
    const extension = hasExtension
        ? ""
        : extensionFromFileName(asset.fileName) || extensionFromMimeType(asset.mimeType) || ".bin";

    return validateZipPath(`media-documento/${dpi}dpi/${safeId}-${safeName}${extension}`);
}

export function toPortableMediaAsset(
    asset: MediaAsset,
    packagePath?: string,
    print?: { printPackagePath: string; printDpi: number }
): MediaAsset {
    const {
        storageKey: _storageKey,
        packagePath: _packagePath,
        printPackagePath: _printPackagePath,
        printDpi: _printDpi,
        ...portable
    } = asset;

    return {
        ...portable,
        ...(packagePath ? { packagePath } : {}),
        ...(print ? { printPackagePath: print.printPackagePath, printDpi: print.printDpi } : {}),
    };
}

export function createDatasetPayload(
    rows: RawRow[],
    mediaAssets: MediaAsset[],
    exportedAt = new Date().toISOString(),
    datasetName = FALLBACK_DATASET_NAME
): DatasetPackagePayload {
    return {
        version: DATASET_PACKAGE_VERSION,
        datasetName: normalizeDatasetBaseName(datasetName),
        exportedAt,
        datos: cleanRowsForExport(rows),
        // Las imágenes subidas llevan su ruta estable (packagePath), aunque el JSON
        // suelto no contenga el archivo: así la referencia no depende del nombre editable.
        mediaAssets: mediaAssets.map((asset) =>
            asset.kind === "uploaded-file"
                ? toPortableMediaAsset(
                    asset,
                    asset.packagePath || createMediaPackagePath(asset),
                    asset.printPackagePath && typeof asset.printDpi === "number"
                        ? { printPackagePath: asset.printPackagePath, printDpi: asset.printDpi }
                        : undefined
                )
                : toPortableMediaAsset(asset)
        ),
    };
}

export function createUploadedMediaPackage(
    asset: MediaAsset,
    data: Uint8Array,
    printProfile: ImagePrintResolutionProfile = "original"
): UploadedMediaPackageResult {
    const packagePath = createMediaPackagePath(asset);
    const entries: MediaPackageEntry[] = [{ path: packagePath, data }];
    const printDpi = dpiForPrintResolutionProfile(printProfile);
    let printPackage: { printPackagePath: string; printDpi: number } | undefined;
    let skippedPrintVariant = false;

    if (printDpi !== null) {
        const printResult = setPrintResolutionDpi(data, asset.mimeType, printDpi);
        if (printResult.ok) {
            const printPackagePath = createMediaPrintPackagePath(asset, printDpi);
            entries.push({ path: printPackagePath, data: printResult.data });
            printPackage = { printPackagePath, printDpi };
        } else {
            skippedPrintVariant = true;
        }
    }

    return {
        entries,
        portableAsset: toPortableMediaAsset(asset, packagePath, printPackage),
        skippedPrintVariant,
    };
}
