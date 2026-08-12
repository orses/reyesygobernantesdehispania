// ---------------------------------------------------------------------------
// Casos de uso puros para interpretar importaciones CSV, JSON y ZIP.
// ---------------------------------------------------------------------------

import { normalizeDatasetImport, getStandaloneJsonMediaAssets } from "./dataset-import";
import { readDatasetNameFromPayload } from "./dataset-package";
import { parseCsv, safeJsonParse } from "./data";
import {
    applyMediaImportRepairs,
    diagnoseMediaImportReferences,
    prepareImportedMediaAssets,
    type MediaImportRepair,
    type MediaImportReview,
    type RuntimeIdFactory,
} from "./media-import";
import type { DatasetStorageEntry } from "./dataset-persistence";
import type { MediaAsset, RawRow } from "./types";
import { validateZipPath, type ZipEntryOutput } from "./zip";

export type {
    MediaImportPersonCandidate,
    MediaImportRepair,
    MediaImportReview,
    OrphanMediaImportIssue,
} from "./media-import";

export interface PreparedDatasetImport {
    rows: RawRow[];
    mediaAssets?: MediaAsset[];
    blobEntries?: DatasetStorageEntry[];
    rawText: string;
    detectedDelimiter: string | null;
    detectedQuotes: boolean | null;
    payloadDatasetName?: string;
}

export type DatasetImportPreparationResult =
    | { ok: true; value: PreparedDatasetImport }
    | { ok: false; error: string; review?: MediaImportReview };

export interface PrepareDatasetZipImportOptions {
    entries: readonly ZipEntryOutput[];
    createRuntimeId: RuntimeIdFactory;
    reservedStorageKeys?: Iterable<unknown>;
    maxTextBytes?: number;
    repairs?: readonly MediaImportRepair[];
}

export const MAX_DATASET_TEXT_FILE_BYTES = 32 * 1024 * 1024;

const DATASET_IMPORT_ERROR_PREFIX = "Importación: ";
const DATASET_TEXT_TOO_LARGE_SUFFIX = "supera el tamaño permitido.";

/** Impide materializar en memoria archivos de texto desproporcionados. */
export function assertDatasetTextFileSize(
    size: number,
    maxBytes = MAX_DATASET_TEXT_FILE_BYTES,
    fileDescription = "el archivo CSV o JSON"
): void {
    if (!Number.isSafeInteger(size) || size < 0) {
        throw new Error("Importación: el tamaño del archivo no es válido.");
    }
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
        throw new Error("Importación: el límite de tamaño no es válido.");
    }
    if (size > maxBytes) {
        throw new Error(
            `${DATASET_IMPORT_ERROR_PREFIX}${fileDescription} ${DATASET_TEXT_TOO_LARGE_SUFFIX}`
        );
    }
}

function formatZipImportError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    const detail = message.startsWith(DATASET_IMPORT_ERROR_PREFIX)
        ? message.slice(DATASET_IMPORT_ERROR_PREFIX.length)
        : message;
    return `ZIP inválido: ${detail}`;
}

function prepareJsonImport(
    text: string,
    source: "json" | "zip"
): DatasetImportPreparationResult {
    const parsed = safeJsonParse(text);
    if (!parsed.ok) {
        const prefix = source === "zip" ? "JSON inválido dentro del ZIP" : "JSON inválido";
        return { ok: false, error: `${prefix}: ${parsed.error}` };
    }

    const normalized = normalizeDatasetImport(parsed.value);
    if (!normalized.ok) return normalized;

    return {
        ok: true,
        value: {
            rows: normalized.value.rows,
            mediaAssets: source === "json"
                ? getStandaloneJsonMediaAssets(normalized.value.mediaAssets)
                : normalized.value.mediaAssets,
            rawText: text,
            detectedDelimiter: null,
            detectedQuotes: null,
            payloadDatasetName: readDatasetNameFromPayload(parsed.value),
        },
    };
}

/** Interpreta un archivo de texto sin acceder al DOM ni mutar estado. */
export function prepareDatasetTextImport(
    text: string,
    format: "csv" | "json"
): DatasetImportPreparationResult {
    if (format === "json") return prepareJsonImport(text, "json");

    const parsed = parseCsv(text);
    if (!parsed.ok || !parsed.value) {
        return {
            ok: false,
            error: parsed.error ?? "CSV no válido: no se han podido interpretar las filas.",
        };
    }

    return {
        ok: true,
        value: {
            rows: parsed.value,
            rawText: text,
            detectedDelimiter: parsed.delimiter ?? null,
            detectedQuotes: parsed.usesQuotes ?? false,
        },
    };
}

/**
 * Interpreta las entradas ya descomprimidas de un ZIP y prepara sus blobs en
 * memoria. No escribe en IndexedDB ni publica estado parcial.
 */
export function prepareDatasetZipImport({
    entries,
    createRuntimeId,
    reservedStorageKeys,
    maxTextBytes = MAX_DATASET_TEXT_FILE_BYTES,
    repairs,
}: PrepareDatasetZipImportOptions): DatasetImportPreparationResult {
    try {
        const dataEntries = entries.filter(
            (entry) => validateZipPath(entry.path) === "datos.json"
        );
        if (dataEntries.length === 0) {
            return { ok: false, error: "ZIP inválido: falta datos.json." };
        }
        if (dataEntries.length > 1) {
            return { ok: false, error: "ZIP inválido: datos.json está duplicado." };
        }

        const dataEntry = dataEntries[0];
        assertDatasetTextFileSize(dataEntry.data.byteLength, maxTextBytes, "datos.json");

        const text = new TextDecoder().decode(dataEntry.data);
        const preparedJson = prepareJsonImport(text, "zip");
        if (!preparedJson.ok) return preparedJson;

        let packageMediaAssets = preparedJson.value.mediaAssets ?? [];
        const review = diagnoseMediaImportReferences(
            packageMediaAssets,
            preparedJson.value.rows
        );
        if (review && repairs === undefined) {
            return {
                ok: false,
                error: formatZipImportError(review.summary),
                review,
            };
        }
        if (repairs !== undefined) {
            const repairResult = applyMediaImportRepairs(
                packageMediaAssets,
                preparedJson.value.rows,
                repairs
            );
            if (!repairResult.ok) {
                return {
                    ok: false,
                    error: formatZipImportError(repairResult.error),
                    ...(repairResult.review ? { review: repairResult.review } : {}),
                };
            }
            packageMediaAssets = repairResult.mediaAssets;
        }

        const preparedMedia = prepareImportedMediaAssets({
            packageMediaAssets,
            entries,
            rows: preparedJson.value.rows,
            createRuntimeId,
            reservedStorageKeys,
        });

        return {
            ok: true,
            value: {
                ...preparedJson.value,
                mediaAssets: preparedMedia.mediaAssets,
                blobEntries: preparedMedia.blobEntries,
            },
        };
    } catch (error) {
        return { ok: false, error: formatZipImportError(error) };
    }
}
